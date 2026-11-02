

using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using SupportTicketSystem.Models;

namespace SupportTicketSystem.Data;

public class AppDbContext : IdentityDbContext<ApplicationUser>
{
    protected override void OnModelCreating(ModelBuilder modelBuilder) {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<TicketComment> ()
        .HasOne(tc => tc.AuthorUser)
        .WithMany()
        .HasForeignKey(tc => tc.AuthorUserId)
        .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<ApplicationUser> ()
            .Property(u => u.IsActive)
            .HasDefaultValue(true);
    }
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options)
    {
        
    }
    public DbSet<Ticket> Tickets {get; set;}
    public DbSet<TicketComment> TicketComments {get; set;}
    public DbSet<AuditLog> AuditLogs {get; set;}
    public DbSet<Notification> Notifications {get; set;}

    
}