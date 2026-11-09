using SupportTicketSystem.DTOs;

namespace SupportTicketSystem.Services;

public interface IKnowledgeBaseClient {
    Task<int> IngestAsync(string kbId, string docId, string title, string content);
    Task<List<KbDocumentDto>> ListDocumentsAsync(string kbId);
    Task<int> DeleteDocumentAsync(string kbId, string docId);
}
