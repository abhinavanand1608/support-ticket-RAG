using System.Net.Http.Json;
using System.Text.Json.Serialization;

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
}
