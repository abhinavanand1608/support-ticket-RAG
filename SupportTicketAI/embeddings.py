import os

import httpx
from dotenv import load_dotenv

# Loaded here too (not just in main.py) so this module works correctly
# regardless of import order - Python only executes a module's top-level
# code once, so whichever import runs first determines when env vars
# become available if only main.py called load_dotenv().
load_dotenv()

API_KEY = os.environ["GEMINI_API_KEY"]
EMBED_URL = (
    "https://generativelanguage.googleapis.com/v1beta/models/"
    "gemini-embedding-001:embedContent"
)
EMBEDDING_DIMENSIONS = 3072


class EmbeddingError(Exception):
    """Raised when the embedding provider fails or times out.

    Unlike ticket classification (which has a meaningful fallback -
    "Uncategorized"/"Medium"), there is no sensible fallback embedding
    vector - a zero vector or random vector would corrupt the FAISS
    index's similarity search. So this is allowed to propagate up to the
    caller (the /kb/ingest and /kb/retrieve endpoints), which turns it
    into a clear HTTP error instead of silently storing garbage data.
    """


async def get_embedding(text: str) -> list[float]:
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(
                EMBED_URL,
                params={"key": API_KEY},
                json={"content": {"parts": [{"text": text}]}},
            )
            response.raise_for_status()
            return response.json()["embedding"]["values"]
    except httpx.TimeoutException as e:
        raise EmbeddingError("Embedding service timed out") from e
    except httpx.HTTPStatusError as e:
        raise EmbeddingError(
            f"Embedding service returned an error: {e.response.status_code}"
        ) from e
    except httpx.RequestError as e:
        raise EmbeddingError("Could not reach embedding service") from e
