from pydantic import BaseModel


class GenerateRequest(BaseModel):
    kb_id: str
    ticket_title: str
    ticket_description: str
    top_k: int = 5


class Source(BaseModel):
    doc_id: str
    title: str
    score: float


class GenerateResponse(BaseModel):
    suggested_reply: str
    confidence: float
    sources: list[Source]
    auto_resolvable: bool
