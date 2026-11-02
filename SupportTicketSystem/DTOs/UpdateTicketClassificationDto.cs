using System.ComponentModel.DataAnnotations;
namespace SupportTicketSystem.DTOs;

public class UpdateTicketClassificationDto {
    [RegularExpression("^(Billing|Technical|Bug|Feature)$", ErrorMessage="Category must be one of: Billing, Technical, Bug, Feature")]
    public string? Category {get; set;}

    [RegularExpression("^(Low|Medium|High|Critical)$", ErrorMessage="Priority must be one of: Low, Medium, High, Critical")]
    public string? Priority {get; set;}
}