import asyncio
import json
import os

import openai
from fastapi import FastAPI, HTTPException
from pydantic import ValidationError
from models import ClassifyRequest, ClassifyResponse
from openai import AsyncOpenAI
from dotenv import load_dotenv

import kb_store
from chunking import chunk_text
from embeddings import EmbeddingError, get_embedding
from kb_models import (
    IngestRequest,
    IngestResponse,
    RetrieveRequest,
    RetrieveResponse,
    ListDocumentsResponse,
    DeleteDocumentResponse,
)
from rag_models import GenerateRequest, GenerateResponse, Source
from insights_models import SummarizeRequest, SummarizeResponse
from datetime import datetime, timezone

load_dotenv()

app = FastAPI()

# Groq exposes an OpenAI-compatible API at a different base_url.
# Swap back to AsyncOpenAI() (no args) once real OpenAI credits are added.
client = AsyncOpenAI(
    api_key=os.environ["GROQ_API_KEY"],
    base_url="https://api.groq.com/openai/v1",
)
MODEL = "openai/gpt-oss-20b"

# How high the top retrieval score must be before a suggested reply is
# flagged as "auto-resolvable" (safe for a one-click accept, rather than
# requiring the agent to read/edit it first). Read from an env var - not
# hardcoded - specifically so this can be tuned based on real-world
# accuracy after launch without a code change/redeploy. 0.9 is a
# deliberately conservative starting point: it's better to under-flag
# (agent reviews a good answer manually - mildly inefficient) than to
# over-flag (a wrong answer gets auto-sent to a customer - a real
# incident). Tune this down over time only once you've measured that
# high-scoring answers are consistently trustworthy.
AUTO_RESOLVE_THRESHOLD = float(os.environ.get("AUTO_RESOLVE_THRESHOLD", "0.9"))

SYSTEM_PROMPT = (
    "You are a support ticket triage assistant. "
    "Classify the ticket into a category and priority. "
    "Categories: Billing (payments, invoices, refunds, subscriptions), "
    "Technical (how-to, configuration, connectivity), "
    "Bug (something is broken, errors, crashes), "
    "Feature (requests for new functionality). "
    "Priorities: Critical (system down, security issue), "
    "High (major functionality broken, no workaround), "
    "Medium (impaired but workaround exists), "
    "Low (minor or cosmetic). "
    'Respond with ONLY a JSON object of the exact shape {"category": "...", "priority": "..."}, '
    "using exactly one of the allowed values for each field."
)

@app.get("/")
def read_root():
    return {"status":"ok"}

@app.post("/triage/classify", response_model=ClassifyResponse)
async def classify(request: ClassifyRequest):
    try:
        completion = await client.chat.completions.create(
            model=MODEL,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {
                    "role": "user",
                    "content": f"Title: {request.title}\nDescription: {request.description}",
                },
            ],
            response_format={"type": "json_object"},
            timeout=10.0,
        )
    except openai.APITimeoutError:
        raise HTTPException(status_code=502, detail="Classification service timed out")
    except openai.RateLimitError:
        raise HTTPException(status_code=502, detail="Classification service rate limited or out of quota")
    except openai.APIStatusError as e:
        raise HTTPException(status_code=502, detail=f"Classification service returned an error: {e.status_code}")
    except openai.APIConnectionError:
        raise HTTPException(status_code=502, detail="Could not reach classification service")

    raw_content = completion.choices[0].message.content

    # JSON mode only guarantees valid JSON, not our schema -- so we
    # parse then validate against ClassifyResponse ourselves.
    try:
        data = json.loads(raw_content)
        return ClassifyResponse(**data)
    except (json.JSONDecodeError, ValidationError):
        raise HTTPException(status_code=502, detail="Classification service returned an unexpected response")


@app.post("/kb/ingest", response_model=IngestResponse)
async def ingest(request: IngestRequest):
    chunks = chunk_text(request.content)
    if not chunks:
        raise HTTPException(status_code=400, detail="No content to ingest")

    try:
        # Chunks are independent of each other, so their embedding calls
        # can run concurrently instead of one-at-a-time - asyncio.gather
        # awaits every coroutine in the list and returns results in the
        # same order they were passed in.
        vectors = await asyncio.gather(*(get_embedding(c) for c in chunks))
    except EmbeddingError as e:
        raise HTTPException(status_code=502, detail=str(e))

    # Stamped once per ingest call (not per chunk) so every chunk from
    # this upload shares the same timestamp - used by /kb/documents to
    # show an Admin when each document was added.
    created_at = datetime.now(timezone.utc).isoformat()

    metadatas = [
        {
            "doc_id": request.doc_id,
            "title": request.title,
            "chunk_index": i,
            "text": chunk,
            "created_at": created_at,
        }
        for i, chunk in enumerate(chunks)
    ]

    kb_store.add_chunks(request.kb_id, vectors, metadatas)

    return IngestResponse(chunks_created=len(chunks))


@app.get("/kb/documents", response_model=ListDocumentsResponse)
async def list_kb_documents(kb_id: str):
    return ListDocumentsResponse(documents=kb_store.list_documents(kb_id))


@app.delete("/kb/documents/{doc_id}", response_model=DeleteDocumentResponse)
async def delete_kb_document(doc_id: str, kb_id: str):
    removed = kb_store.remove_document(kb_id, doc_id)
    if removed == 0:
        raise HTTPException(status_code=404, detail="Document not found in this knowledge base")
    return DeleteDocumentResponse(chunks_removed=removed)


@app.post("/kb/retrieve", response_model=RetrieveResponse)
async def retrieve(request: RetrieveRequest):
    try:
        query_vector = await get_embedding(request.query)
    except EmbeddingError as e:
        raise HTTPException(status_code=502, detail=str(e))

    results = kb_store.search(request.kb_id, query_vector, request.top_k)

    return RetrieveResponse(results=results)


# --- RAG generation ---------------------------------------------------
#
# This is "retrieval" (kb_store.search, get_embedding - both already built
# and tested via /kb/retrieve) plus one new step: feeding the retrieved
# chunks into an LLM call as *context* so it can generate a grounded reply
# instead of hallucinating from its own training data.

RAG_SYSTEM_PROMPT = (
    "You are a support agent's writing assistant. Your job is to draft a "
    "reply to a customer support ticket, using ONLY the numbered context "
    "sources provided below. Do not use any outside knowledge, and do not "
    "guess or make up policy details that are not present in the sources.\n\n"
    "Rules:\n"
    "- Write a short, direct, professional reply the agent could send "
    "as-is or lightly edit.\n"
    "- Whenever you state a fact that came from a source, cite it inline "
    "using its bracket number, e.g. [1].\n"
    "- If the sources do not contain enough information to answer the "
    "ticket, say so honestly instead of guessing - e.g. 'I don't have "
    "enough information in the knowledge base to answer this; please "
    "escalate or investigate further.'\n\n"
    "Context sources:\n{context}"
)


def _build_context_block(sources: list[dict]) -> str:
    """Turns retrieved chunks into a numbered block the model can cite by
    number (e.g. "[1]", "[2]") in its reply. Numbering starts at 1 to match
    how citations normally read in prose, not 0."""
    if not sources:
        return "(No relevant sources were found in the knowledge base.)"

    blocks = []
    for i, source in enumerate(sources, start=1):
        blocks.append(f"[{i}] {source['title']}:\n{source['text']}")
    return "\n\n".join(blocks)


@app.post("/rag/generate", response_model=GenerateResponse)
async def generate(request: GenerateRequest):
    # Step 1-2: embed the ticket's content and retrieve the most relevant
    # KB chunks - this is exactly what /kb/retrieve does internally.
    query = f"{request.ticket_title}\n{request.ticket_description}"

    try:
        query_vector = await get_embedding(query)
    except EmbeddingError as e:
        raise HTTPException(status_code=502, detail=str(e))

    retrieved = kb_store.search(request.kb_id, query_vector, request.top_k)

    # Step 3: construct the grounded prompt, embedding the retrieved
    # chunks as numbered context the model is instructed to cite from.
    system_prompt = RAG_SYSTEM_PROMPT.format(context=_build_context_block(retrieved))

    try:
        completion = await client.chat.completions.create(
            model=MODEL,
            messages=[
                {"role": "system", "content": system_prompt},
                {
                    "role": "user",
                    "content": (
                        f"Ticket title: {request.ticket_title}\n"
                        f"Ticket description: {request.ticket_description}\n\n"
                        "Draft a reply using the rules above."
                    ),
                },
            ],
            timeout=15.0,
        )
    except openai.APITimeoutError:
        raise HTTPException(status_code=502, detail="Generation service timed out")
    except openai.RateLimitError:
        raise HTTPException(status_code=502, detail="Generation service rate limited or out of quota")
    except openai.APIStatusError as e:
        raise HTTPException(status_code=502, detail=f"Generation service returned an error: {e.status_code}")
    except openai.APIConnectionError:
        raise HTTPException(status_code=502, detail="Could not reach generation service")

    suggested_reply = completion.choices[0].message.content

    # Confidence: derived from the TOP retrieval similarity score, not from
    # asking the LLM to self-report a number. Tradeoffs, briefly:
    #
    #   - Top retrieval score (chosen here): cheap (already computed,
    #     costs no extra LLM call), deterministic, and directly answers
    #     the question that actually matters for an agent: "how relevant
    #     is the best matching KB content to this ticket?" A low top
    #     score honestly means "the KB probably doesn't cover this," which
    #     is exactly when an agent should distrust the draft.
    #   - LLM self-reported confidence (e.g. asking it to output a 0-1
    #     score alongside its answer): LLMs are notoriously poorly
    #     calibrated at this - they tend to report high confidence even
    #     when hallucinating, since the "confidence" is really just more
    #     generated text, not a measured probability. It also costs
    #     nothing extra to compute, but the number itself is unreliable.
    #   - A separate second LLM call purely to grade the first answer's
    #     confidence: more accurate in theory, but doubles latency and
    #     cost for every single suggested-reply generation - a poor
    #     tradeoff for a feature that should feel instant to an agent.
    #
    # Cosine similarity for text embeddings rarely goes negative in
    # practice, but we clamp defensively since confidence is documented
    # as a 0.0-1.0 value.
    confidence = max(0.0, min(1.0, retrieved[0]["score"])) if retrieved else 0.0

    # auto_resolvable is a pure function of confidence vs. the configured
    # threshold - it does NOT, by itself, resolve anything. It's a signal
    # the .NET side surfaces to a human agent, who still has to click a
    # button to actually accept it (see TicketController.AutoResolve).
    # This endpoint has no way to know it produced a *correct* answer,
    # only a *well-matched* one - a high score means "this looks like the
    # right topic," not "this is definitely right."
    auto_resolvable = confidence >= AUTO_RESOLVE_THRESHOLD

    sources = [
        Source(doc_id=r["doc_id"], title=r["title"], score=r["score"])
        for r in retrieved
    ]

    return GenerateResponse(
        suggested_reply=suggested_reply,
        confidence=confidence,
        sources=sources,
        auto_resolvable=auto_resolvable,
    )


# --- Admin weekly insights summarization -------------------------------
#
# Unlike /rag/generate, this endpoint never sees individual ticket
# titles/descriptions - only numbers .NET has already computed from the
# database (counts, breakdowns, an average). That's a deliberate scope
# boundary, not an oversight: it means (a) no customer PII/ticket content
# ever reaches this LLM call, and (b) the LLM literally cannot corrupt
# the *data* shown on the dashboard - the charts/cards are rendered
# straight from the same `stats` object we send here, not from anything
# the LLM outputs. The worst a bad completion can do is produce an
# unhelpful sentence, never a wrong number on the page.

INSIGHTS_SYSTEM_PROMPT = (
    "You are an analytics assistant writing a short summary for an admin "
    "dashboard of a support ticket system. You will be given aggregated "
    "statistics for the current 7-day period and, for comparison, totals "
    "from the previous 7-day period. These numbers have already been "
    "computed and verified - never invent, adjust, or round them "
    "creatively; only reference values that actually appear in the data.\n\n"
    "Write 3-5 sentences, in a factual and professional tone, that a "
    "manager could skim in a few seconds. Cover: how many tickets came "
    "in, the resolved-vs-open split, and the auto-resolved-vs-manual "
    "split. Then, only if a category's count or the total changed by "
    "roughly 30% or more compared to the previous period, explicitly "
    "call that out as a trend or spike (e.g. 'Technical tickets rose "
    "sharply this week, from 4 to 11'). If nothing changed notably, "
    "say so plainly instead of manufacturing a trend - a false alarm is "
    "worse than no alarm."
)


@app.post("/insights/summarize", response_model=SummarizeResponse)
async def summarize_insights(request: SummarizeRequest):
    stats_json = request.stats.model_dump_json()

    try:
        completion = await client.chat.completions.create(
            model=MODEL,
            messages=[
                {"role": "system", "content": INSIGHTS_SYSTEM_PROMPT},
                {"role": "user", "content": stats_json},
            ],
            timeout=15.0,
        )
    except openai.APITimeoutError:
        raise HTTPException(status_code=502, detail="Insights service timed out")
    except openai.RateLimitError:
        raise HTTPException(status_code=502, detail="Insights service rate limited or out of quota")
    except openai.APIStatusError as e:
        raise HTTPException(status_code=502, detail=f"Insights service returned an error: {e.status_code}")
    except openai.APIConnectionError:
        raise HTTPException(status_code=502, detail="Could not reach insights service")

    summary = completion.choices[0].message.content
    return SummarizeResponse(summary=summary)
