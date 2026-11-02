from pydantic import BaseModel


class CategoryCount(BaseModel):
    name: str
    count: int


class PriorityCount(BaseModel):
    name: str
    count: int


# Mirrors .NET's WeeklyInsightsStatsDto exactly (snake_case field names,
# since .NET builds this request body manually - same convention as
# GenerateRequest/IngestRequest). All these numbers are computed by .NET
# directly from the database - this service never touches raw ticket
# text or PII, only pre-aggregated counts, which is what keeps this
# feature low-risk (see the comment on /insights/summarize below).
class WeeklyStats(BaseModel):
    window_start: str
    window_end: str
    total_created: int
    by_category: list[CategoryCount]
    by_priority: list[PriorityCount]
    resolved_count: int
    open_count: int
    average_resolution_hours: float | None
    auto_resolved_count: int
    manually_resolved_count: int

    # The previous 7-day period's numbers, included specifically so the
    # LLM has a baseline to compare against. Without this, "flag any
    # notable trend or spike" is an impossible ask - a single snapshot of
    # counts has no notion of "usual" vs "unusual" on its own.
    previous_period_total_created: int
    previous_period_by_category: list[CategoryCount]


class SummarizeRequest(BaseModel):
    stats: WeeklyStats


class SummarizeResponse(BaseModel):
    summary: str
