using SupportTicketSystem.DTOs;

namespace SupportTicketSystem.Services;

public interface IInsightsSummaryClient {
    Task<string> SummarizeAsync(WeeklyInsightsStatsDto stats);
}
