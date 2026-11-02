namespace SupportTicketSystem.Services;

public interface INotificationService {
    void Notify(string userId, string message, int? ticketId = null);
}
