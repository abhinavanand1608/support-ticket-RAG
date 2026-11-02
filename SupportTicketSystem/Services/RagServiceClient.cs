using System.Net.Http.Json;
namespace SupportTicketSystem.Services;

public class RagServiceClient : IRagServiceClient {
    private readonly HttpClient _httpClient;

    public RagServiceClient(HttpClient httpClient) {
        _httpClient = httpClient;
    }

    public async Task<(string Category, string Priority)> ClassifyAsync(string title, string description) {
        try {
            var requestBody = new { title, description };

            var response = await _httpClient.PostAsJsonAsync("/triage/classify", requestBody);

            if (!response.IsSuccessStatusCode) {
                return ("Uncategorized", "Medium");
            }

            var result = await response.Content.ReadFromJsonAsync<ClassifyResult>();

            if (result == null) {
                return ("Uncategorized", "Medium");
            }

            return (result.Category, result.Priority);
        }
        catch (HttpRequestException) {
            return ("Uncategorized", "Medium");
        }
        catch (TaskCanceledException) {
            return ("Uncategorized", "Medium");
        }
    }

    private class ClassifyResult {
        public string Category { get; set; } = string.Empty;
        public string Priority { get; set; } = string.Empty;
    }
}