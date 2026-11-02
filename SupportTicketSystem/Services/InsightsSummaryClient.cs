using System.Net.Http.Json;
using System.Text.Json.Serialization;
using SupportTicketSystem.DTOs;

namespace SupportTicketSystem.Services;

// Same reasoning as RagGenerationException: throw rather than return a
// silent fallback placeholder text from *this* layer. The controller is
// the right place to decide what a failed summary should look like to
// an admin (see AdminController.GetWeeklyInsights) - this client's job
// is only to report "the call failed" accurately.
public class InsightsSummaryException : Exception {
    public InsightsSummaryException(string message) : base(message) { }
    public InsightsSummaryException(string message, Exception inner) : base(message, inner) { }
}

public class InsightsSummaryClient : IInsightsSummaryClient {
    private readonly HttpClient _httpClient;

    public InsightsSummaryClient(HttpClient httpClient) {
        _httpClient = httpClient;
    }

    public async Task<string> SummarizeAsync(WeeklyInsightsStatsDto stats) {
        try {
            // Built as an explicit anonymous object (snake_case keys)
            // rather than serializing the DTO directly, matching the
            // same convention RagGenerationClient uses - .NET's DTOs are
            // PascalCase, Python's Pydantic models are snake_case, and
            // there's no shared serializer config between the two
            // services to bridge that automatically.
            var requestBody = new {
                stats = new {
                    window_start = stats.WindowStart,
                    window_end = stats.WindowEnd,
                    total_created = stats.TotalCreated,
                    by_category = stats.ByCategory.Select(c => new { name = c.Name, count = c.Count }),
                    by_priority = stats.ByPriority.Select(p => new { name = p.Name, count = p.Count }),
                    resolved_count = stats.ResolvedCount,
                    open_count = stats.OpenCount,
                    average_resolution_hours = stats.AverageResolutionHours,
                    auto_resolved_count = stats.AutoResolvedCount,
                    manually_resolved_count = stats.ManuallyResolvedCount,
                    previous_period_total_created = stats.PreviousPeriodTotalCreated,
                    previous_period_by_category = stats.PreviousPeriodByCategory
                        .Select(c => new { name = c.Name, count = c.Count }),
                },
            };

            var response = await _httpClient.PostAsJsonAsync("/insights/summarize", requestBody);

            if (!response.IsSuccessStatusCode) {
                var errorBody = await response.Content.ReadAsStringAsync();
                throw new InsightsSummaryException(
                    $"Insights service returned {(int)response.StatusCode}: {errorBody}");
            }

            var result = await response.Content.ReadFromJsonAsync<SummarizeResult>();
            if (result == null) {
                throw new InsightsSummaryException("Insights service returned an unexpected response");
            }

            return result.Summary;
        }
        catch (HttpRequestException e) {
            throw new InsightsSummaryException("Could not reach the insights service", e);
        }
        catch (TaskCanceledException e) {
            throw new InsightsSummaryException("Insights service timed out", e);
        }
    }

    private class SummarizeResult {
        public string Summary { get; set; } = string.Empty;
    }
}
