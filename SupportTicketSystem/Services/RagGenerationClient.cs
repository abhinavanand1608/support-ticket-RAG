using System.Net.Http.Json;
using System.Text.Json.Serialization;
using SupportTicketSystem.DTOs;

namespace SupportTicketSystem.Services;

// Like KnowledgeBaseIngestException, this throws rather than returning a
// silent fallback (contrast with RagServiceClient's classification
// fallback of "Uncategorized"/"Medium"). A half-generated or empty
// suggested reply would be actively misleading to an agent - better to
// surface the failure clearly so they know to write their own reply
// instead of trusting a blank/broken suggestion.
public class RagGenerationException : Exception {
    public RagGenerationException(string message) : base(message) { }
    public RagGenerationException(string message, Exception inner) : base(message, inner) { }
}

public class RagGenerationClient : IRagGenerationClient {
    private readonly HttpClient _httpClient;

    public RagGenerationClient(HttpClient httpClient) {
        _httpClient = httpClient;
    }

    public async Task<RagGenerationResult> GenerateAsync(
        string kbId, string title, string description, int topK = 5) {
        try {
            var requestBody = new {
                kb_id = kbId,
                ticket_title = title,
                ticket_description = description,
                top_k = topK,
            };

            var response = await _httpClient.PostAsJsonAsync("/rag/generate", requestBody);

            if (!response.IsSuccessStatusCode) {
                var errorBody = await response.Content.ReadAsStringAsync();
                throw new RagGenerationException(
                    $"Generation service returned {(int)response.StatusCode}: {errorBody}");
            }

            var result = await response.Content.ReadFromJsonAsync<GenerateResult>();
            if (result == null) {
                throw new RagGenerationException("Generation service returned an unexpected response");
            }

            var sources = result.Sources.Select(s => new RagSourceDto {
                DocId = s.DocId,
                Title = s.Title,
                Score = s.Score,
            }).ToList();

            return new RagGenerationResult(
                result.SuggestedReply, result.Confidence, sources, result.AutoResolvable);
        }
        catch (HttpRequestException e) {
            throw new RagGenerationException("Could not reach the generation service", e);
        }
        catch (TaskCanceledException e) {
            throw new RagGenerationException("Generation service timed out", e);
        }
    }

    // Mirrors Python's GenerateResponse/Source shapes (snake_case JSON
    // keys), same reasoning as KnowledgeBaseClient's IngestResult.
    private class GenerateResult {
        [JsonPropertyName("suggested_reply")]
        public string SuggestedReply { get; set; } = string.Empty;

        public double Confidence { get; set; }

        public List<SourceResult> Sources { get; set; } = new();

        [JsonPropertyName("auto_resolvable")]
        public bool AutoResolvable { get; set; }
    }

    private class SourceResult {
        [JsonPropertyName("doc_id")]
        public string DocId { get; set; } = string.Empty;

        public string Title { get; set; } = string.Empty;

        public double Score { get; set; }
    }
}
