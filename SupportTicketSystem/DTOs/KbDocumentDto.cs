namespace SupportTicketSystem.DTOs;

public class KbDocumentDto {
    public required string DocId { get; set; }
    public required string Title { get; set; }
    public int ChunkCount { get; set; }
    public DateTime? CreatedAt { get; set; }
}
