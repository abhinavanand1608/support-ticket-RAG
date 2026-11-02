using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using SupportTicketSystem.Data;

namespace SupportTicketSystem.Controllers;

// Any authenticated role can have notifications (a User gets notified
// their ticket was resolved, an Agent gets notified they were assigned
// one) - unlike TicketController/AdminController there's no single role
// restriction here, only "you can only ever see/modify your own".
[ApiController]
[Route("api/notifications")]
[Authorize]
public class NotificationsController : ControllerBase {
    private readonly AppDbContext _context;

    public NotificationsController(AppDbContext context) {
        _context = context;
    }

    // Most-recent-first, capped at 50 - this backs a lightweight bell
    // dropdown, not a full paginated inbox, so a hard cap is simpler
    // than building pagination for a feature that doesn't need it yet.
    [HttpGet]
    public async Task<IActionResult> GetMyNotifications() {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);

        var notifications = await _context.Notifications
            .Where(n => n.UserId == userId)
            .OrderByDescending(n => n.CreatedAt)
            .Take(50)
            .Select(n => new {
                n.Id,
                n.Message,
                n.TicketId,
                n.IsRead,
                n.CreatedAt,
            })
            .ToListAsync();

        return Ok(notifications);
    }

    [HttpPut("{id}/read")]
    public async Task<IActionResult> MarkAsRead(int id) {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);

        // Scoped to the current user in the query itself (not just
        // checked after fetching) - so a user can't mark someone else's
        // notification as read even by guessing an id.
        var notification = await _context.Notifications
            .FirstOrDefaultAsync(n => n.Id == id && n.UserId == userId);

        if (notification == null) {
            return NotFound();
        }

        notification.IsRead = true;
        await _context.SaveChangesAsync();

        return Ok(notification);
    }

    [HttpPut("read-all")]
    public async Task<IActionResult> MarkAllAsRead() {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);

        var unread = await _context.Notifications
            .Where(n => n.UserId == userId && !n.IsRead)
            .ToListAsync();

        foreach (var notification in unread) {
            notification.IsRead = true;
        }

        await _context.SaveChangesAsync();

        return Ok(new { updated = unread.Count });
    }
}
