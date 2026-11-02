"""
Local, in-process vector storage using FAISS.

FAISS itself only stores vectors + lets you search them - it has no concept
of "metadata" (doc_id, title, chunk text, etc). FAISS assigns each vector a
sequential integer id in the order it was added (0, 1, 2, ...), so metadata
is tracked in a plain Python list stored alongside the index, where
metadata[i] describes the vector that FAISS knows as id i. Whenever we get
ids back from a FAISS search, we look them up in this parallel list.

One index (and one metadata list) is kept per kb_id, so different knowledge
bases never mix their vectors together.
"""
import json
import os
import threading

import faiss
import numpy as np

from embeddings import EMBEDDING_DIMENSIONS

KB_DATA_DIR = os.path.join(os.path.dirname(__file__), "kb_data")

# Guards the in-memory dicts below and the read-modify-write to disk.
# FAISS's IndexFlatIP is not thread-safe for concurrent add()/search(), and
# FastAPI can run multiple requests concurrently even on a single worker.
_lock = threading.Lock()
_indexes: dict[str, faiss.Index] = {}
_metadata: dict[str, list[dict]] = {}


def _index_path(kb_id: str) -> str:
    return os.path.join(KB_DATA_DIR, kb_id, "index.faiss")


def _metadata_path(kb_id: str) -> str:
    return os.path.join(KB_DATA_DIR, kb_id, "metadata.json")


def _load_kb(kb_id: str) -> None:
    """Loads a KB's index + metadata into memory on first use, either from
    disk (if this kb_id has been ingested into before, even in a previous
    run of the service) or as a brand new empty index."""
    if kb_id in _indexes:
        return

    index_path = _index_path(kb_id)
    metadata_path = _metadata_path(kb_id)

    if os.path.exists(index_path) and os.path.exists(metadata_path):
        _indexes[kb_id] = faiss.read_index(index_path)
        with open(metadata_path, "r", encoding="utf-8") as f:
            _metadata[kb_id] = json.load(f)
    else:
        # IndexFlatIP does an exact (brute-force) inner-product search over
        # every stored vector - no approximation, so results are always
        # the true top-k. Combined with L2-normalized vectors (see
        # _normalize below), inner product is mathematically equivalent to
        # cosine similarity.
        _indexes[kb_id] = faiss.IndexFlatIP(EMBEDDING_DIMENSIONS)
        _metadata[kb_id] = []


def _save_kb(kb_id: str) -> None:
    os.makedirs(os.path.join(KB_DATA_DIR, kb_id), exist_ok=True)
    faiss.write_index(_indexes[kb_id], _index_path(kb_id))
    with open(_metadata_path(kb_id), "w", encoding="utf-8") as f:
        json.dump(_metadata[kb_id], f)


def _normalize(vectors: np.ndarray) -> np.ndarray:
    norms = np.linalg.norm(vectors, axis=1, keepdims=True)
    return vectors / norms


def add_chunks(kb_id: str, vectors: list[list[float]], metadatas: list[dict]) -> None:
    """Embeds+stores are kept separate: this function just persists
    already-computed vectors and their metadata. len(vectors) must equal
    len(metadatas) - metadatas[i] describes vectors[i]."""
    with _lock:
        _load_kb(kb_id)

        matrix = np.array(vectors, dtype="float32")
        matrix = _normalize(matrix)

        _indexes[kb_id].add(matrix)
        _metadata[kb_id].extend(metadatas)

        _save_kb(kb_id)


def search(kb_id: str, query_vector: list[float], top_k: int) -> list[dict]:
    with _lock:
        _load_kb(kb_id)

        if _indexes[kb_id].ntotal == 0:
            return []

        query = np.array([query_vector], dtype="float32")
        query = _normalize(query)

        k = min(top_k, _indexes[kb_id].ntotal)
        scores, ids = _indexes[kb_id].search(query, k)

        results = []
        for score, idx in zip(scores[0], ids[0]):
            if idx == -1:
                continue
            meta = _metadata[kb_id][idx]
            results.append({**meta, "score": float(score)})
        return results
