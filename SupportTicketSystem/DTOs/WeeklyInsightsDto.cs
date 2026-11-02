namespace SupportTicketSystem.DTOs;

public class CategoryCountDto {
    public required string Name { get; set; }
    public int Count { get; set; }
}

public class PriorityCountDto {
    public required string Name { get; set; }
    public int Count { get; set; }
}

// The raw, server-computed aggregates - these are what the frontend
// renders as cards/bars, independent of whatever the LLM says. Keeping
// this as its own DTO (rather than inlining fields into the response)
// makes it a clean 1:1 match with Python's WeeklyStats model, which is
// what gets forwarded to POST /insights/summarize almost unchanged.
public class WeeklyInsightsStatsDto {
    public DateTime WindowStart { get; set; }
    public DateTime WindowEnd { get; set; }

    public int TotalCreated { get; set; }
    public required List<CategoryCountDto> ByCategory { get; set; }
    public required List<PriorityCountDto> ByPriority { get; set; }

    // "Resolved vs still open" is scoped to tickets *created* in this
    // window - i.e. "of this week's new tickets, how many are already
    // handled?" This is a different (and deliberately separate) question
    // from AverageResolutionHours below, which looks at *resolution*
    // activity in the window regardless of when those tickets were
    // originally created.
    public int ResolvedCount { get; set; }
    public int OpenCount { get; set; }

    // Null when nothing was resolved in the window - there's no
    // meaningful average of zero data points, and reporting 0.0 would
    // misleadingly suggest "instant resolutions" rather than "no data".
    public double? AverageResolutionHours { get; set; }

    public int AutoResolvedCount { get; set; }
    public int ManuallyResolvedCount { get; set; }

    // Baseline from the prior 7-day period, purely so the LLM (and later,
    // a human) can tell whether this week's numbers are normal or a
    // spike - a single week's counts have no meaning in isolation.
    public int PreviousPeriodTotalCreated { get; set; }
    public required List<CategoryCountDto> PreviousPeriodByCategory { get; set; }
}

public class WeeklyInsightsResponseDto {
    public required string Summary { get; set; }
    public required WeeklyInsightsStatsDto Stats { get; set; }
    public DateTime GeneratedAt { get; set; }
}
