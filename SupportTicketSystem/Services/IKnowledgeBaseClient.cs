namespace SupportTicketSystem.Services;

public interface IKnowledgeBaseClient {
    Task<int> IngestAsync(string kbId, string docId, string title, string content);
}
