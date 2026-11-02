namespace SupportTicketSystem.Services;

public interface IAuditLogger {
    void Log(string action, string performedByUserId, string? targetId = null, object? details = null);
}
