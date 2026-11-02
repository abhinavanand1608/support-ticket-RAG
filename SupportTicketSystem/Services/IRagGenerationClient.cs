using SupportTicketSystem.DTOs;

namespace SupportTicketSystem.Services;

public record RagGenerationResult(
    string SuggestedReply,
    double Confidence,
    List<RagSourceDto> Sources,
    bool AutoResolvable);

public interface IRagGenerationClient {
    Task<RagGenerationResult> GenerateAsync(string kbId, string title, string description, int topK = 5);
}
