using System.ComponentModel.DataAnnotations;

namespace SupportTicketSystem.DTOs;

public class CreateTicketDto {
    public required string Title {get; set;}
    public required string Description {get; set;}

    // Kept in sync with the SupportTicketAI Pydantic Literal values.
    // Null/omitted is still allowed - that's what triggers AI classification.
    [RegularExpression("^(Billing|Technical|Bug|Feature)$",
        ErrorMessage = "Category must be one of: Billing, Technical, Bug, Feature")]
    public string? Category {get; set;}

    [RegularExpression("^(Low|Medium|High|Critical)$",
        ErrorMessage = "Priority must be one of: Low, Medium, High, Critical")]
    public string? Priority {get; set;}
}