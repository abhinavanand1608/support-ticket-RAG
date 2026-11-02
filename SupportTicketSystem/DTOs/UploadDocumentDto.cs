namespace SupportTicketSystem.DTOs;

public class UploadDocumentDto {
    public required IFormFile File { get; set; }
    public required string Title { get; set; }

    // Which knowledge base to ingest into. Defaults to "support-kb" if
    // omitted - there is currently only one knowledge base in this app,
    // but the underlying Python service supports multiple, so this is
    // left open for that future case rather than hardcoded end-to-end.
    public string? KbId { get; set; }
}
