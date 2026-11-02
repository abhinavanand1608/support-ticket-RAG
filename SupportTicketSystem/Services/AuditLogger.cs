using System.Text.Json;
using SupportTicketSystem.Data;
using SupportTicketSystem.Models;

namespace SupportTicketSystem.Services;

// Deliberately synchronous and does NOT call SaveChangesAsync itself.
// The caller (a controller action) queues this onto the same scoped
// AppDbContext it's already using for its primary change (ticket status
// update, role change, etc.), then calls SaveChangesAsync once at the
// end - so the audit row commits atomically with the action it's
// documenting. If this saved independently, a failure partway through
// the caller's own save could leave an audit entry for something that
// never actually happened (or vice versa: an action with no audit trail).
public class AuditLogger : IAuditLogger {
    private readonly AppDbContext _context;

    public AuditLogger(AppDbContext context) {
        _context = context;
    }

    public void Log(string action, string performedByUserId, string? targetId = null, object? details = null) {
        _context.AuditLogs.Add(new AuditLog {
            Action = action,
            PerformedByUserId = performedByUserId,
            TargetId = targetId,
            Details = details != null ? JsonSerializer.Serialize(details) : null,
            CreatedAt = DateTime.UtcNow,
        });
    }
}
