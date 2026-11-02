using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SupportTicketSystem.Migrations
{
    /// <inheritdoc />
    public partial class AddSuggestedReplyToTicket : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "SuggestedReply",
                table: "Tickets",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<double>(
                name: "SuggestedReplyConfidence",
                table: "Tickets",
                type: "float",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "SuggestedReplyGeneratedAt",
                table: "Tickets",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "SuggestedReplySourcesJson",
                table: "Tickets",
                type: "nvarchar(max)",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "SuggestedReply",
                table: "Tickets");

            migrationBuilder.DropColumn(
                name: "SuggestedReplyConfidence",
                table: "Tickets");

            migrationBuilder.DropColumn(
                name: "SuggestedReplyGeneratedAt",
                table: "Tickets");

            migrationBuilder.DropColumn(
                name: "SuggestedReplySourcesJson",
                table: "Tickets");
        }
    }
}
