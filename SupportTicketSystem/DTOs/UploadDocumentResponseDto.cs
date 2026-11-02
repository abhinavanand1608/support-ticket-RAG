namespace SupportTicketSystem.DTOs;

public class UploadDocumentResponseDto {
    public required string DocId { get; set; }
    public required string Title { get; set; }
    public int ChunksCreated { get; set; }
}
