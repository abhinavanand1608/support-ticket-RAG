using SupportTicketSystem.Models;
namespace SupportTicketSystem.DTOs;

public class UpdateTicketStatusDto {
    public required TicketStatus Status {get; set;}
}