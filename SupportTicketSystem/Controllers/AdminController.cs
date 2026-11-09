using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Caching.Memory;
using System.Security.Claims;
using SupportTicketSystem.Models;
using SupportTicketSystem.Data;
using Microsoft.EntityFrameworkCore;
using SupportTicketSystem.DTOs;
using SupportTicketSystem.Services;

namespace SupportTicketSystem.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize(Roles = "Admin")]
public class AdminController : ControllerBase {
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly RoleManager<IdentityRole> _roleManager;
    private readonly AppDbContext _context;
    private readonly IInsightsSummaryClient _insightsSummaryClient;
    private readonly IMemoryCache _cache;
    private readonly IAuditLogger _auditLogger;

    private const string WeeklyInsightsCacheKey = "admin-weekly-insights";
    private static readonly TimeSpan WeeklyInsightsCacheDuration = TimeSpan.FromHours(1);

    public AdminController(
        UserManager<ApplicationUser> userManager,
        RoleManager<IdentityRole> roleManager,
        AppDbContext context,
        IInsightsSummaryClient insightsSummaryClient,
        IMemoryCache cache,
        IAuditLogger auditLogger) {
        _userManager = userManager;
        _roleManager = roleManager;
        _context = context;
        _insightsSummaryClient = insightsSummaryClient;
        _cache = cache;
        _auditLogger = auditLogger;
    }

    [HttpGet("test")]
    public IActionResult Test() {
        return Ok("You are Admin - access granted");
    }

    [HttpGet("users")]
    public async Task<IActionResult> GetAllUsers() {
        var users = await _userManager.Users.ToListAsync();
        var result = new List<object>();
        
        foreach(var user in users) {
            var roles = await _userManager.GetRolesAsync(user);
            result.Add(new {
                user.Id,
                user.Email,
                user.IsActive,
                Roles = roles
            });
        }

        return Ok(result);
    }

    [HttpPut("users/{id}/role")]
    public async Task<IActionResult> UpdateUserRole(string id, UpdateUserRoleDto dto) {
        var user = await _userManager.FindByIdAsync(id);
        if(user == null) {
            return NotFound();
        }

        var validRoles = new[] {"User", "Agent", "Admin"};
        if(!validRoles.Contains(dto.Role)) {
            return BadRequest("Invalid role");
        }

        var currentRoles = await _userManager.GetRolesAsync(user);

        // Queued onto the same DbContext the UserManager calls below will
        // flush via their own internal SaveChangesAsync - see
        // AuditLogger's comment for why this composes safely instead of
        // needing its own explicit save here.
        var adminId = User.FindFirstValue(ClaimTypes.NameIdentifier)!;
        _auditLogger.Log(AuditActions.UserRoleChanged, adminId, id, new {
            oldRoles = currentRoles,
            newRole = dto.Role,
        });

        await _userManager.RemoveFromRolesAsync(user, currentRoles);

        var result = await _userManager.AddToRoleAsync(user, dto.Role);
        if(!result.Succeeded) {
            return BadRequest(result.Errors);
        }

        return Ok("User role updated successfully");
    }

    // Single toggle endpoint for both directions, rather than separate
    // deactivate/reactivate routes - deactivation is routinely a mistake
    // or a temporary measure (wrong user clicked, someone's on leave),
    // and without a way back short of a manual database edit, the admin
    // UI can't fully undo its own actions. Both directions still get
    // distinct audit actions (UserDeactivated/UserReactivated) so the
    // trail reads naturally even though one endpoint handles both.
    [HttpPut("users/{id}/active")]
    public async Task<IActionResult> UpdateUserActiveStatus(string id, UpdateUserActiveStatusDto dto) {
        var user = await _userManager.FindByIdAsync(id);

        if(user == null) {
            return NotFound();
        }

        // No-op requests (e.g. reactivating an already-active user)
        // shouldn't add a misleading audit entry for an action that
        // didn't actually change anything.
        if (user.IsActive != dto.IsActive) {
            user.IsActive = dto.IsActive;

            var adminId = User.FindFirstValue(ClaimTypes.NameIdentifier)!;
            _auditLogger.Log(
                dto.IsActive ? AuditActions.UserReactivated : AuditActions.UserDeactivated,
                adminId,
                id);

            await _userManager.UpdateAsync(user);
        }

        return Ok(dto.IsActive ? "User reactivated successfully" : "User deactivated successfully");
    }

    [HttpGet("tickets/stats")]
    public async Task<IActionResult> GetTicketStats() {
        var totalTickets = await _context.Tickets.CountAsync();
        var openTickets = await _context.Tickets.CountAsync(t => t.Status != TicketStatus.Closed);
        var closedTickets = await _context.Tickets.CountAsync(t => t.Status == TicketStatus.Closed);

        var byStatus = await _context.Tickets
                        .GroupBy(t => t.Status)
                        .Select(g => new {Status = g.Key, Count = g.Count()})
                        .ToListAsync();
        
        return Ok(new {
            Total = totalTickets,
            Open = openTickets,
            Closed = closedTickets,
            ByStatus = byStatus
        });
    }

    // Called when the Admin opens the Weekly Insights page, and again
    // when they click "Regenerate". `regenerate=false` (default) serves
    // the cached result if one is still fresh (<1 hour old) instead of
    // recomputing stats and calling the LLM again.
    //
    // Why cache at all: the LLM summarization call has the same
    // cost/latency profile as ticket classification or RAG generation -
    // a real network round-trip with a per-call dollar cost. A weekly
    // summary's *inputs* only change meaningfully as new tickets/
    // resolutions accumulate over hours, not seconds, so recomputing on
    // every dashboard visit would burn money and add latency for a
    // result that would usually come back identical. An hour is a
    // reasonable middle ground: fresh enough that new activity shows up
    // same-day, coarse enough to avoid redundant calls from someone
    // refreshing the page repeatedly.
    //
    // Why IMemoryCache (not a DB table): see the comment in Program.cs
    // where it's registered - single-instance app, small cached payload,
    // no correctness requirement that survives a restart.
    [HttpGet("insights/weekly")]
    public async Task<IActionResult> GetWeeklyInsights([FromQuery] bool regenerate = false) {
        if (!regenerate && _cache.TryGetValue(WeeklyInsightsCacheKey, out WeeklyInsightsResponseDto? cached)) {
            return Ok(cached);
        }

        var stats = await ComputeWeeklyStatsAsync();

        string summary;
        try {
            summary = await _insightsSummaryClient.SummarizeAsync(stats);
        }
        catch (InsightsSummaryException) {
            // Deliberately degrade gracefully rather than fail the whole
            // request: the stats below are computed directly from the
            // database and are correct regardless of whether the LLM
            // call succeeded. A dashboard with real numbers and a
            // "summary unavailable" note is far more useful to an Admin
            // than a blank error page.
            summary = "AI summary is temporarily unavailable, but the stats below are accurate and up to date.";
        }

        var response = new WeeklyInsightsResponseDto {
            Summary = summary,
            Stats = stats,
            GeneratedAt = DateTime.UtcNow,
        };

        _cache.Set(WeeklyInsightsCacheKey, response, WeeklyInsightsCacheDuration);

        return Ok(response);
    }

    private async Task<WeeklyInsightsStatsDto> ComputeWeeklyStatsAsync() {
        var windowEnd = DateTime.UtcNow;
        var windowStart = windowEnd.AddDays(-7);
        var previousWindowStart = windowStart.AddDays(-7);

        var createdInWindow = _context.Tickets
            .Where(t => t.CreatedAt >= windowStart && t.CreatedAt < windowEnd);

        var totalCreated = await createdInWindow.CountAsync();

        var byCategory = await createdInWindow
            .GroupBy(t => t.Category ?? "Uncategorized")
            .Select(g => new CategoryCountDto { Name = g.Key, Count = g.Count() })
            .ToListAsync();

        var byPriority = await createdInWindow
            .GroupBy(t => t.Priority ?? "Unset")
            .Select(g => new PriorityCountDto { Name = g.Key, Count = g.Count() })
            .ToListAsync();

        // "Resolved vs open" here is scoped to THIS COHORT (tickets
        // created in the window) - see the comment on
        // WeeklyInsightsStatsDto.ResolvedCount for why this is a
        // different question from resolution-time below.
        var resolvedCount = await createdInWindow.CountAsync(
            t => t.Status == TicketStatus.Resolved || t.Status == TicketStatus.Closed);
        var openCount = totalCreated - resolvedCount;

        // Resolution-time and auto/manual split look at ANY ticket
        // resolved during the window, regardless of when it was created -
        // a ticket opened three weeks ago and closed yesterday is real
        // resolution activity that belongs in this week's numbers.
        var resolvedInWindow = await _context.Tickets
            .Where(t => t.ResolvedAt != null && t.ResolvedAt >= windowStart && t.ResolvedAt < windowEnd)
            .Select(t => new { t.Id, t.CreatedAt, t.ResolvedAt })
            .ToListAsync();

        double? averageResolutionHours = resolvedInWindow.Count > 0
            ? resolvedInWindow.Average(t => (t.ResolvedAt!.Value - t.CreatedAt).TotalHours)
            : null;

        // Phase 9 moved auto-resolve logging into the unified AuditLogs
        // table (Action = TicketAutoResolved, TargetId = the ticket id as
        // a string) - see AuditLog.cs. TargetId is parsed back to int
        // here since the audit table stores it as a generic string to
        // also cover user-id targets from role-change/deactivation logs.
        var autoResolvedTicketIds = await _context.AuditLogs
            .Where(a => a.Action == AuditActions.TicketAutoResolved
                && a.CreatedAt >= windowStart && a.CreatedAt < windowEnd)
            .Select(a => a.TargetId)
            .ToListAsync();
        var autoResolvedTicketIdSet = autoResolvedTicketIds
            .Where(id => id != null)
            .Select(id => int.Parse(id!))
            .ToHashSet();

        var autoResolvedCount = resolvedInWindow.Count(t => autoResolvedTicketIdSet.Contains(t.Id));
        var manuallyResolvedCount = resolvedInWindow.Count - autoResolvedCount;

        // Previous period - purely a comparison baseline for the LLM
        // (and future human eyeballing) to judge "is this normal?".
        var previousPeriod = _context.Tickets
            .Where(t => t.CreatedAt >= previousWindowStart && t.CreatedAt < windowStart);

        var previousPeriodTotalCreated = await previousPeriod.CountAsync();

        var previousPeriodByCategory = await previousPeriod
            .GroupBy(t => t.Category ?? "Uncategorized")
            .Select(g => new CategoryCountDto { Name = g.Key, Count = g.Count() })
            .ToListAsync();

        return new WeeklyInsightsStatsDto {
            WindowStart = windowStart,
            WindowEnd = windowEnd,
            TotalCreated = totalCreated,
            ByCategory = byCategory,
            ByPriority = byPriority,
            ResolvedCount = resolvedCount,
            OpenCount = openCount,
            AverageResolutionHours = averageResolutionHours,
            AutoResolvedCount = autoResolvedCount,
            ManuallyResolvedCount = manuallyResolvedCount,
            PreviousPeriodTotalCreated = previousPeriodTotalCreated,
            PreviousPeriodByCategory = previousPeriodByCategory,
        };
    }

    // Admin-only view over the unified audit trail (Phase 9). All three
    // filters are optional and combine with AND - e.g. action=UserDeactivated
    // plus a date range narrows to deactivations in that window.
    [HttpGet("audit-log")]
    public async Task<IActionResult> GetAuditLog(
        [FromQuery] string? action,
        [FromQuery] DateTime? from,
        [FromQuery] DateTime? to) {
        var query = _context.AuditLogs.AsQueryable();

        if (!string.IsNullOrEmpty(action)) {
            query = query.Where(a => a.Action == action);
        }
        if (from.HasValue) {
            query = query.Where(a => a.CreatedAt >= from.Value.Date);
        }
        if (to.HasValue) {
            // Inclusive of the entire "to" day - callers pass a bare date
            // (e.g. "2026-09-29") from an HTML <input type="date">, and a
            // naive `<= to.Value` would cut off at midnight, excluding
            // everything that happened during that day.
            query = query.Where(a => a.CreatedAt <= to.Value.Date.AddDays(1).AddTicks(-1));
        }

        // Left join to Users (not an inner join) so a log entry still
        // shows up even if the acting user's account was later deleted -
        // an audit trail that silently drops entries because the actor
        // no longer exists would defeat its own purpose.
        var logs = await query
            .OrderByDescending(a => a.CreatedAt)
            .GroupJoin(_context.Users, a => a.PerformedByUserId, u => u.Id, (a, users) => new { a, users })
            .SelectMany(
                x => x.users.DefaultIfEmpty(),
                (x, u) => new {
                    x.a.Id,
                    x.a.Action,
                    x.a.TargetId,
                    x.a.Details,
                    x.a.CreatedAt,
                    PerformedByEmail = u != null ? u.Email : null,
                })
            .ToListAsync();

        return Ok(logs);
    }
}