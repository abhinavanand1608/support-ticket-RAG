using SupportTicketSystem.Models;

namespace SupportTicketSystem.DTOs;

// Shape returned by GET /api/tickets (the Admin/Agent "all tickets"
// view). Unlike the other ticket endpoints, which return the raw
// Ticket entity, this projects the fields an admin needs to see at a
// glance - who filed the ticket and which agent (if any) it's assigned
// to - as flat email strings rather than nested user objects, so the
// frontend doesn't have to dig into navigation properties (which EF
// wouldn't populate anyway without an Include).
public class TicketListItemDto {
    public int Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public TicketStatus Status { get; set; }
    public string? Priority { get; set; }
    public string? Category { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public DateTime? ResolvedAt { get; set; }
    public string CreatorEmail { get; set; } = string.Empty;
    public string? AssigneeEmail { get; set; }
}
