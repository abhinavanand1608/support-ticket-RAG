using System.Net.Http.Json;
using System.Text.Json.Serialization;
using SupportTicketSystem.DTOs;

namespace SupportTicketSystem.Services;

// Unlike ticket classification (RagServiceClient), there is no sensible
// "fallback" value for a failed ingestion - returning e.g. 0 chunks would
// look like a successful-but-empty upload rather than a failure, silently
// hiding the problem from the Admin who uploaded the document. So this
// throws instead, letting the controller turn it into a clear error
// response.
public class KnowledgeBaseIngestException : Exception {
    public KnowledgeBaseIngestException(string message) : base(message) { }
    public KnowledgeBaseIngestException(string message, Exception inner) : base(message, inner) { }
}

public class KnowledgeBaseClient : IKnowledgeBaseClient {
    private readonly HttpClient _httpClient;

    public KnowledgeBaseClient(HttpClient httpClient) {
        _httpClient = httpClient;
    }

    public async Task<int> IngestAsync(string kbId, string docId, string title, string content) {
        try {
            var requestBody = new { kb_id = kbId, doc_id = docId, title, content };

            var response = await _httpClient.PostAsJsonAsync("/kb/ingest", requestBody);

            if (!response.IsSuccessStatusCode) {
                var errorBody = await response.Content.ReadAsStringAsync();
                throw new KnowledgeBaseIngestException(
                    $"Ingestion service returned {(int)response.StatusCode}: {errorBody}");
            }

            var result = await response.Content.ReadFromJsonAsync<IngestResult>();
            if (result == null) {
                throw new KnowledgeBaseIngestException("Ingestion service returned an unexpected response");
            }

            return result.ChunksCreated;
        }
        catch (HttpRequestException e) {
            throw new KnowledgeBaseIngestException("Could not reach the knowledge base ingestion service", e);
        }
        catch (TaskCanceledException e) {
            throw new KnowledgeBaseIngestException("Knowledge base ingestion service timed out", e);
        }
    }

    // Python's response key is "chunks_created" (snake_case) - the default
    // System.Text.Json case-insensitive matching only ignores letter case,
    // not the underscore, so without this attribute ChunksCreated would
    // silently stay 0 instead of binding to the actual value.
    private class IngestResult {
        [JsonPropertyName("chunks_created")]
        public int ChunksCreated { get; set; }
    }

    public async Task<List<KbDocumentDto>> ListDocumentsAsync(string kbId) {
        try {
            var response = await _httpClient.GetAsync($"/kb/documents?kb_id={Uri.EscapeDataString(kbId)}");

            if (!response.IsSuccessStatusCode) {
                var errorBody = await response.Content.ReadAsStringAsync();
                throw new KnowledgeBaseIngestException(
                    $"Knowledge base service returned {(int)response.StatusCode}: {errorBody}");
            }

            var result = await response.Content.ReadFromJsonAsync<ListDocumentsResult>();
            if (result == null) {
                throw new KnowledgeBaseIngestException("Knowledge base service returned an unexpected response");
            }

            return result.Documents.Select(d => new KbDocumentDto {
                DocId = d.DocId,
                Title = d.Title,
                ChunkCount = d.ChunkCount,
                CreatedAt = d.CreatedAt,
            }).ToList();
        }
        catch (HttpRequestException e) {
            throw new KnowledgeBaseIngestException("Could not reach the knowledge base service", e);
        }
        catch (TaskCanceledException e) {
            throw new KnowledgeBaseIngestException("Knowledge base service timed out", e);
        }
    }

    public async Task<int> DeleteDocumentAsync(string kbId, string docId) {
        try {
            var response = await _httpClient.DeleteAsync(
                $"/kb/documents/{Uri.EscapeDataString(docId)}?kb_id={Uri.EscapeDataString(kbId)}");

            if (response.StatusCode == System.Net.HttpStatusCode.NotFound) {
                throw new KnowledgeBaseDocumentNotFoundException(docId);
            }

            if (!response.IsSuccessStatusCode) {
                var errorBody = await response.Content.ReadAsStringAsync();
                throw new KnowledgeBaseIngestException(
                    $"Knowledge base service returned {(int)response.StatusCode}: {errorBody}");
            }

            var result = await response.Content.ReadFromJsonAsync<DeleteDocumentResult>();
            return result?.ChunksRemoved ?? 0;
        }
        catch (HttpRequestException e) {
            throw new KnowledgeBaseIngestException("Could not reach the knowledge base service", e);
        }
        catch (TaskCanceledException e) {
            throw new KnowledgeBaseIngestException("Knowledge base service timed out", e);
        }
    }

    private class ListDocumentsResult {
        public List<DocumentResult> Documents { get; set; } = new();
    }

    private class DocumentResult {
        [JsonPropertyName("doc_id")]
        public string DocId { get; set; } = string.Empty;

        public string Title { get; set; } = string.Empty;

        [JsonPropertyName("chunk_count")]
        public int ChunkCount { get; set; }

        [JsonPropertyName("created_at")]
        public DateTime? CreatedAt { get; set; }
    }

    private class DeleteDocumentResult {
        [JsonPropertyName("chunks_removed")]
        public int ChunksRemoved { get; set; }
    }
}

// Distinct from KnowledgeBaseIngestException so the controller can map a
// "no such document" 404 from Python into a 404 here too, rather than
// the generic 502 used for every other failure mode.
public class KnowledgeBaseDocumentNotFoundException : Exception {
    public KnowledgeBaseDocumentNotFoundException(string docId)
        : base($"Document '{docId}' was not found in the knowledge base.") { }
}
