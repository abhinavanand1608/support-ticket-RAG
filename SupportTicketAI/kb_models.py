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


# One row per ingested document (not per chunk) - an Admin managing the
# KB thinks in terms of "documents I uploaded", not the chunks they were
# split into internally.
class DocumentSummary(BaseModel):
    doc_id: str
    title: str
    chunk_count: int
    created_at: str | None = None


class ListDocumentsResponse(BaseModel):
    documents: list[DocumentSummary]


class DeleteDocumentResponse(BaseModel):
    chunks_removed: int
