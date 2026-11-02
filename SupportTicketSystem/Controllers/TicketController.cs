using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;
using System.Text.Json;
using SupportTicketSystem.Data;
using SupportTicketSystem.Models;
using SupportTicketSystem.DTOs;
using Microsoft.EntityFrameworkCore;
using SupportTicketSystem.Services;
namespace SupportTicketSystem.Controllers;

[ApiController]
[Route("api/tickets")]
public class TicketController : ControllerBase {
   private readonly AppDbContext _context;
   private readonly IRagServiceClient _ragServiceClient;
   private readonly IRagGenerationClient _ragGenerationClient;
   private readonly IAuditLogger _auditLogger;
   private readonly INotificationService _notificationService;
   private const string KnowledgeBaseId = "support-kb";

   public TicketController(
       AppDbContext context,
       IRagServiceClient ragServiceClient,
       IRagGenerationClient ragGenerationClient,
       IAuditLogger auditLogger,
       INotificationService notificationService) {
    _context = context;
    _ragServiceClient = ragServiceClient;
    _ragGenerationClient = ragGenerationClient;
    _auditLogger = auditLogger;
    _notificationService = notificationService;
   }

    [HttpPost]
    [Authorize(Roles = "User")]
    public async Task<IActionResult> CreateTicket(CreateTicketDto dto) {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        var currentUser = await _context.Users.FindAsync(userId);
        if(currentUser == null) {
            return Unauthorized();
        }
        var ticket = new Ticket {
            Title = dto.Title,
            Description = dto.Description,
            Category = dto.Category,
            Priority = dto.Priority,
            Status = TicketStatus.New,
            CreatedByUser = currentUser,
            CreatedByUserId = userId,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        if(string.IsNullOrWhiteSpace(ticket.Category) || string.IsNullOrWhiteSpace(ticket.Priority)) {
            var (category, priority) = await _ragServiceClient.ClassifyAsync(dto.Title, dto.Description);
            ticket.Category ??= category;
            ticket.Priority ??= priority;
        }

        _context.Tickets.Add(ticket);
        await _context.SaveChangesAsync();

        return Ok(ticket);
    }

    [HttpGet("{id}")]
    [Authorize]
    public async Task<IActionResult> GetTicketById(int id) {
        var ticket = await _context.Tickets
            .Where(t => t.Id == id)
            .Select(t => new {
                t.Id,
                t.Title,
                t.Description,
                t.Status,
                t.Category,
                t.Priority,
                t.CreatedAt,
                t.UpdatedAt,
                t.CreatedByUserId,
                t.AssignedAgentId,
                t.IsAutoResolveSuggested,
                CreatedByEmail = t.CreatedByUser.Email,
                AssignedAgentEmail = t.AssignedAgent != null ? t.AssignedAgent.Email : null
            })
            .FirstOrDefaultAsync();

        if(ticket == null) {
            return NotFound();
        }

        if(User.IsInRole("User")) {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if(ticket.CreatedByUserId != userId) {
                return Forbid();
            }
        }

        return Ok(ticket);
    }

    [HttpGet("{id}/comments")]
    [Authorize]
    public async Task<IActionResult> GetComments(int id) {
        var ticket = await _context.Tickets.FindAsync(id);
        if(ticket == null) {
            return NotFound();
        }

        if(User.IsInRole("User")) {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if(ticket.CreatedByUserId != userId) {
                return Forbid();
            }
        }

        var comments = await _context.TicketComments
            .Where(c => c.TicketId == id)
            .OrderBy(c => c.CreatedAt)
            .Select(c => new {
                c.Id,
                c.Content,
                c.CreatedAt,
                c.AuthorUserId,
                AuthorEmail = c.AuthorUser.Email
            })
            .ToListAsync();

        return Ok(comments);
    }

    [HttpGet("mine")]
    [Authorize(Roles = "User")]
    public async Task<IActionResult> GetMyTickets() {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);

        var tickets = await _context.Tickets
                        .Where(t => t.CreatedByUserId == userId)
                        .ToListAsync();
        return Ok(tickets);
    }

    [HttpGet]
    [Authorize(Roles = "Admin, Agent")]
    public async Task<IActionResult> GetAllTickets([FromQuery] TicketStatus? status, [FromQuery] string? priority) {
        var query = _context.Tickets.AsQueryable();

        if(status.HasValue) {
            query = query.Where(t => t.Status == status.Value);
        }

        if(!string.IsNullOrEmpty(priority)){
            query = query.Where(t => t.Priority == priority);
        }

        var tickets = await query.ToListAsync();
        return Ok(tickets);
    }

    [HttpPut("{id}/status")]
    [Authorize(Roles = "Agent, Admin")]
    public async Task<IActionResult> UpdateStatus(int id, UpdateTicketStatusDto dto) {
        var ticket = await _context.Tickets.FindAsync(id);

        if(ticket == null) {
            return NotFound();
        }

        var previousStatus = ticket.Status;

        // Track when a ticket first becomes Resolved, and clear it if
        // reopened - see the comment on Ticket.ResolvedAt for why this
        // can't just be UpdatedAt.
        if (dto.Status == TicketStatus.Resolved && ticket.Status != TicketStatus.Resolved) {
            ticket.ResolvedAt = DateTime.UtcNow;
        } else if (dto.Status != TicketStatus.Resolved) {
            ticket.ResolvedAt = null;
        }

        ticket.Status = dto.Status;
        ticket.UpdatedAt = DateTime.UtcNow;

        // Only log/notify on an actual change - saving the same status
        // back (e.g. a no-op form submit) isn't a "manual status change"
        // worth an audit entry or a redundant "your ticket was resolved"
        // notification.
        if (previousStatus != dto.Status) {
            var actorId = User.FindFirstValue(ClaimTypes.NameIdentifier)!;
            _auditLogger.Log(AuditActions.TicketStatusChanged, actorId, ticket.Id.ToString(), new {
                oldStatus = previousStatus.ToString(),
                newStatus = dto.Status.ToString(),
            });

            if (dto.Status == TicketStatus.Resolved) {
                _notificationService.Notify(
                    ticket.CreatedByUserId,
                    $"Your ticket #{ticket.Id} \"{ticket.Title}\" has been resolved.",
                    ticket.Id);
            }
        }

        await _context.SaveChangesAsync();

        return Ok(ticket);
    }

    [HttpPost("{id}/comments")]
    [Authorize(Roles = "User, Agent")]
    public async Task<IActionResult> AddComment(int id, CreateCommentDto dto) {
        var ticket = await _context.Tickets.FindAsync(id);
        if(ticket == null) {
            return NotFound();
        }

        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        var currentUser = await _context.Users.FindAsync(userId);
        if(currentUser == null) {
            return Unauthorized();
        }

        var comment = new TicketComment {
            TicketId = ticket.Id,
            Ticket = ticket,
            AuthorUserId = userId,
            AuthorUser = currentUser,
            Content = dto.Content,
            CreatedAt = DateTime.UtcNow
        };

        _context.TicketComments.Add(comment);
        await _context.SaveChangesAsync();

        return Ok(comment); 
    }

    [HttpGet("queue")]
    [Authorize(Roles = "Agent")]
    public async Task<IActionResult> GetQueue() {
        var tickets = await _context.Tickets
                        .Where(t => t.AssignedAgentId == null)
                        .OrderBy(t => t.CreatedAt)
                        .ToListAsync();
        return Ok(tickets);
    }

    [HttpPut("{id}/assign")]
    [Authorize(Roles = "Agent")]
    public async Task<IActionResult> AssignTicket(int id) {
        var ticket = await _context.Tickets.FindAsync(id);

        if(ticket == null) {
            return NotFound();
        }

        if(ticket.AssignedAgentId != null) {
            return Conflict("Ticket is already assigned.");
        }

        var agentId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        ticket.AssignedAgentId = agentId;
        ticket.UpdatedAt = DateTime.UtcNow;

        // Note: today an Agent can only assign a ticket to themselves
        // (there's no "Admin assigns Agent X" flow), so this notifies the
        // same user who just clicked "Assign to me" - a little redundant
        // right now, but it's the right place for this once an
        // Admin-assigns-someone-else flow exists, and it costs nothing to
        // have in place already.
        _notificationService.Notify(
            agentId!,
            $"Ticket #{ticket.Id} \"{ticket.Title}\" was assigned to you.",
            ticket.Id);

        await _context.SaveChangesAsync();

        return Ok(ticket);
    }

    [HttpGet("assigned-to-me")]
    [Authorize(Roles = "Agent")]
    public async Task<IActionResult> GetAssignedToMe() {
        var agentId = User.FindFirstValue(ClaimTypes.NameIdentifier);

        var tickets = await _context.Tickets
                        .Where(t => t.AssignedAgentId == agentId)
                        .ToListAsync();
        return Ok(tickets);
    }

    [HttpPut("{id}/classification")]
    [Authorize(Roles="Agent, Admin")]
    public async Task<IActionResult> UpdateClassification(int id, UpdateTicketClassificationDto dto) {
        var ticket = await _context.Tickets.FindAsync(id);

        if(ticket == null) {
            return NotFound();
        }

        if(dto.Category != null) {
            ticket.Category = dto.Category;
        }
        if(dto.Priority != null) {
            ticket.Priority = dto.Priority;
        }

        ticket.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();
        return Ok(ticket);
    }

    // Called when an Agent/Admin opens a ticket's detail page, and again
    // whenever they click "Regenerate". `regenerate=false` (the default)
    // returns the cached reply if one already exists instead of calling
    // the Python service again.
    //
    // Why caching matters here: every generation call chains an
    // embedding call + a FAISS search + an LLM completion call - real
    // latency (seconds, not milliseconds) and, for the LLM step, real
    // dollar cost per call. Without caching, simply opening/reloading a
    // ticket's page repeatedly would re-run that whole chain every time
    // for no reason, since the ticket's title/description (the only
    // inputs) haven't changed. Caching turns an expensive "regenerate
    // from scratch" operation into a cheap "read a column" operation for
    // every page load after the first, while still letting the agent
    // force a fresh generation on demand.
    [HttpPost("{id}/suggested-reply")]
    [Authorize(Roles = "Agent, Admin")]
    public async Task<IActionResult> GetSuggestedReply(int id, [FromQuery] bool regenerate = false) {
        var ticket = await _context.Tickets.FindAsync(id);
        if (ticket == null) {
            return NotFound();
        }

        var hasCachedReply = ticket.SuggestedReply != null && ticket.SuggestedReplyGeneratedAt != null;

        if (!regenerate && hasCachedReply) {
            return Ok(BuildSuggestedReplyResponse(ticket));
        }

        try {
            var result = await _ragGenerationClient.GenerateAsync(
                KnowledgeBaseId, ticket.Title, ticket.Description);

            ticket.SuggestedReply = result.SuggestedReply;
            ticket.SuggestedReplyConfidence = result.Confidence;
            ticket.SuggestedReplySourcesJson = JsonSerializer.Serialize(result.Sources);
            ticket.SuggestedReplyGeneratedAt = DateTime.UtcNow;
            ticket.IsAutoResolveSuggested = result.AutoResolvable;

            await _context.SaveChangesAsync();

            return Ok(BuildSuggestedReplyResponse(ticket));
        }
        catch (RagGenerationException e) {
            return StatusCode(502, e.Message);
        }
    }

    private static SuggestedReplyResponseDto BuildSuggestedReplyResponse(Ticket ticket) {
        var sources = ticket.SuggestedReplySourcesJson != null
            ? JsonSerializer.Deserialize<List<RagSourceDto>>(ticket.SuggestedReplySourcesJson) ?? new()
            : new List<RagSourceDto>();

        return new SuggestedReplyResponseDto {
            SuggestedReply = ticket.SuggestedReply ?? string.Empty,
            Confidence = ticket.SuggestedReplyConfidence ?? 0.0,
            Sources = sources,
            GeneratedAt = ticket.SuggestedReplyGeneratedAt ?? DateTime.MinValue,
            AutoResolvable = ticket.IsAutoResolveSuggested,
        };
    }

    // One-click "Accept & Resolve": posts the cached AI suggestion as a
    // comment (verbatim - the agent is explicitly accepting it as-is) and
    // marks the ticket Resolved, atomically.
    //
    // Why this is a human click and NOT something the system does by
    // itself: a high retrieval score only proves the ticket *matched* KB
    // content well - it cannot prove the generated reply is correct, or
    // that it addresses this specific customer's nuance. Auto-sending a
    // wrong answer isn't just unhelpful, it actively harms trust and can
    // hide a real unresolved incident behind a "Resolved" status. So the
    // Python side computes `auto_resolvable` purely as a *signal* for the
    // UI ("this one is probably safe to accept quickly"), and the final
    // decision - and accountability - always stays with an agent.
    //
    // Why it's a single endpoint rather than "comment + status change"
    // as two frontend calls: splitting them would allow a partial state
    // (reply posted but ticket left open, or closed with no reply sent).
    // Here both mutations plus the audit row are saved in one
    // SaveChangesAsync call, which EF Core runs as a single transaction -
    // either the whole action lands or none of it does.
    //
    // Note: we deliberately do NOT hard-require IsAutoResolveSuggested
    // here. The flag drives which tickets get the prominent UI affordance,
    // but an agent who has actually *read* a lower-confidence suggestion
    // and verified it's correct shouldn't be blocked from the shortcut -
    // and the audit log captures the confidence at action time either
    // way, so any such use is reviewable later.
    [HttpPut("{id}/auto-resolve")]
    [Authorize(Roles = "Agent, Admin")]
    public async Task<IActionResult> AutoResolve(int id) {
        var ticket = await _context.Tickets.FindAsync(id);
        if (ticket == null) {
            return NotFound();
        }

        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        var currentUser = await _context.Users.FindAsync(userId);
        if (currentUser == null) {
            return Unauthorized();
        }

        // Accepting "the suggested reply" is meaningless if none has been
        // generated yet - the client should call POST suggested-reply
        // first (the page does this automatically on load).
        if (ticket.SuggestedReply == null) {
            return Conflict("No suggested reply exists for this ticket yet.");
        }

        if (ticket.Status == TicketStatus.Resolved) {
            return Conflict("Ticket is already resolved.");
        }

        _context.TicketComments.Add(new TicketComment {
            TicketId = ticket.Id,
            Ticket = ticket,
            AuthorUserId = userId!,
            AuthorUser = currentUser,
            Content = ticket.SuggestedReply,
            CreatedAt = DateTime.UtcNow,
        });

        ticket.Status = TicketStatus.Resolved;
        ticket.ResolvedAt = DateTime.UtcNow;
        ticket.UpdatedAt = DateTime.UtcNow;

        // Phase 7 originally logged this to its own AutoResolveAuditLog
        // table; it now goes through the same IAuditLogger every other
        // sensitive action uses (Phase 9), so an Admin reviewing the
        // audit log sees this alongside manual status changes, role
        // changes, etc. in one place instead of a separate table.
        _auditLogger.Log(AuditActions.TicketAutoResolved, userId!, ticket.Id.ToString(), new {
            confidence = ticket.SuggestedReplyConfidence ?? 0.0,
        });

        _notificationService.Notify(
            ticket.CreatedByUserId,
            $"Your ticket #{ticket.Id} \"{ticket.Title}\" has been resolved.",
            ticket.Id);

        await _context.SaveChangesAsync();

        return Ok(new {
            ticket.Id,
            ticket.Status,
            ticket.UpdatedAt,
        });
    }
}