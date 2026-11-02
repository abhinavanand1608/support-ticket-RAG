namespace SupportTicketSystem.DTOs;

public class RagSourceDto {
    public required string DocId { get; set; }
    public required string Title { get; set; }
    public double Score { get; set; }
}
