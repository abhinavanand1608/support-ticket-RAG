namespace SupportTicketSystem.Models;

public class Ticket {
    public int Id {get; set;}
    public required string Title {get; set;}
    public required string Description {get; set;}
    public TicketStatus Status {get; set;}
    public DateTime CreatedAt {get; set;}
    public string? Category {get; set;}
    public string? Priority {get; set;}
    public DateTime UpdatedAt {get; set;}
    public required string CreatedByUserId { get; set; }
    public string? AssignedAgentId { get; set; }   
    public required ApplicationUser CreatedByUser { get; set; }
    public ApplicationUser? AssignedAgent { get; set; }

    // Cached RAG-generated suggested reply. These are a *cache*, not
    // source-of-truth data - they're only ever recomputed by calling the
    // Python /rag/generate endpoint again, so storing the sources as a
    // single JSON blob column (rather than a normalized child table) is
    // an intentional simplification: nothing else in the app ever needs
    // to query into individual sources, so there's nothing to gain from
    // a relational shape here.
    public string? SuggestedReply { get; set; }
    public double? SuggestedReplyConfidence { get; set; }
    public string? SuggestedReplySourcesJson { get; set; }
    public DateTime? SuggestedReplyGeneratedAt { get; set; }

    // Set from the Python service's `auto_resolvable` flag whenever a
    // suggested reply is (re)generated - true means the top retrieval
    // score cleared the configured confidence threshold. This is only
    // ever a *signal* surfaced to a human agent (see
    // TicketController.AutoResolve) - it never triggers any action by
    // itself.
    public bool IsAutoResolveSuggested { get; set; }

    // Set the moment a ticket's status first becomes Resolved (by either
    // UpdateStatus or AutoResolve), cleared if it's reopened. Distinct
    // from UpdatedAt, which changes on unrelated edits too (assignment,
    // classification correction, etc.) and so can't be used to measure
    // "how long did this ticket take to resolve" - Phase 8's weekly
    // insights depend on this being set only by an actual resolution.
    public DateTime? ResolvedAt { get; set; }
}