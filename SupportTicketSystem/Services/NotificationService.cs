using SupportTicketSystem.Data;
using SupportTicketSystem.Models;

namespace SupportTicketSystem.Services;

// Same "queue on the shared DbContext, let the caller's own
// SaveChangesAsync commit it" pattern as AuditLogger - see that class's
// comment for why. A notification about a ticket becoming Resolved
// should never exist if the status change itself failed to save.
public class NotificationService : INotificationService {
    private readonly AppDbContext _context;

    public NotificationService(AppDbContext context) {
        _context = context;
    }

    public void Notify(string userId, string message, int? ticketId = null) {
        _context.Notifications.Add(new Notification {
            UserId = userId,
            Message = message,
            TicketId = ticketId,
            IsRead = false,
            CreatedAt = DateTime.UtcNow,
        });
    }
}
