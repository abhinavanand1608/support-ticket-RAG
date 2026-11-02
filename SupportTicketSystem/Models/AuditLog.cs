namespace SupportTicketSystem.Models;

// Centralized constants so every call site (TicketController,
// AdminController, ...) agrees on exact action-name strings - both for
// writing entries and for the frontend's filter dropdown to have a
// known, stable set of values to offer.
public static class AuditActions {
    public const string TicketAutoResolved = "TicketAutoResolved";
    public const string TicketStatusChanged = "TicketStatusChanged";
    public const string UserRoleChanged = "UserRoleChanged";
    public const string UserDeactivated = "UserDeactivated";
}

// One consistent audit trail for every sensitive action in the app.
// This generalizes what started in Phase 7 as a one-off
// AutoResolveAuditLog table (used only for the AI accept-and-resolve
// action) into a table that also covers manual ticket status changes,
// role changes, and deactivations - so an Admin has a single place to
// answer "who did what, and when" instead of hunting across several
// action-specific tables (or nothing at all, for actions that
// previously weren't audited at all).
public class AuditLog {
    public int Id { get; set; }

    // One of the AuditActions constants above. A plain string (not an
    // enum) so new action types can be added without an EF migration
    // to widen an enum's backing column, and so `Details` for very
    // different action shapes doesn't need a shared schema.
    public required string Action { get; set; }

    public required string PerformedByUserId { get; set; }

    // The id of whatever was acted on - a ticket id for ticket actions,
    // a user id for account actions. Stored as a string since both are
    // valid targets and there's no single foreign key that fits both.
    public string? TargetId { get; set; }

    // Action-specific context as a JSON blob (e.g. { "oldStatus": "New",
    // "newStatus": "Resolved" } or { "confidence": 0.68 }) - kept
    // unstructured like SuggestedReplySourcesJson elsewhere in this
    // codebase, since nothing queries *into* these details; they're
    // for a human reading the audit log, not for further filtering.
    public string? Details { get; set; }

    public DateTime CreatedAt { get; set; }
}
