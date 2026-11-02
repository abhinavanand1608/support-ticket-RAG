namespace SupportTicketSystem.DTOs;

public class SuggestedReplyResponseDto {
    public required string SuggestedReply { get; set; }
    public double Confidence { get; set; }
    public required List<RagSourceDto> Sources { get; set; }
    public DateTime GeneratedAt { get; set; }

    // Mirrors Python's auto_resolvable flag - true means the top
    // retrieval score cleared the configured threshold and the
    // suggestion is a candidate for the one-click "Accept & Resolve"
    // flow rather than mandatory human review/edit.
    public bool AutoResolvable { get; set; }
}
