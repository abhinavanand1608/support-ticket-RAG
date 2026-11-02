namespace SupportTicketSystem.Models;

public class TicketComment {
    public int Id {get; set;}
    public required int TicketId {get; set;}
    public required Ticket Ticket {get; set;}
    public required string AuthorUserId {get; set;}
    public required ApplicationUser AuthorUser {get; set;}
    public required string Content {get; set;}
    public DateTime CreatedAt {get; set;}
}