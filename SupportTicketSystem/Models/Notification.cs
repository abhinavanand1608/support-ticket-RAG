namespace SupportTicketSystem.Models;

// Deliberately simple: an in-app row, not an email. Building real email
// delivery (SMTP/provider setup, templates, deliverability) is a
// separate concern from "notify a user something happened," and this
// project has no email provider already configured - a Notifications
// table + a bell dropdown gets the same practical result (the user
// finds out) with none of that infrastructure.
public class Notification {
    public int Id { get; set; }
    public required string UserId { get; set; }
    public required string Message { get; set; }

    // Optional - lets the frontend deep-link "click this notification"
    // straight to the relevant ticket. Null for notifications that
    // aren't ticket-related (none exist yet, but no reason to couple
    // this table permanently to tickets).
    public int? TicketId { get; set; }

    public bool IsRead { get; set; }
    public DateTime CreatedAt { get; set; }
}
