from pydantic import BaseModel


class IngestRequest(BaseModel):
    kb_id: str
    doc_id: str
    title: str
    content: str


class IngestResponse(BaseModel):
    chunks_created: int


class RetrieveRequest(BaseModel):
    kb_id: str
    query: str
    top_k: int = 5


class RetrievedChunk(BaseModel):
    doc_id: str
    title: str
    chunk_index: int
    text: str
    score: float


class RetrieveResponse(BaseModel):
    results: list[RetrievedChunk]
