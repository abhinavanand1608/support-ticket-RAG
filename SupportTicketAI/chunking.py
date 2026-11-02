import tiktoken

_encoder = tiktoken.get_encoding("cl100k_base")


def chunk_text(content: str, chunk_size: int = 500, overlap: int = 75) -> list[str]:
    tokens=_encoder.encode(content)
    chunks=[]
    start=0

    while start < len(tokens):
        chunk_tokens = tokens[start: start + chunk_size]
        chunks.append(_encoder.decode(chunk_tokens))
        start += (chunk_size - overlap)
    return chunks