using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ParkingSystem.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddReservationRejectReason : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "RejectReason",
                table: "Reservations",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "ReviewedByStaffId",
                table: "Reservations",
                type: "uuid",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "RejectReason",
                table: "Reservations");

            migrationBuilder.DropColumn(
                name: "ReviewedByStaffId",
                table: "Reservations");
        }
    }
}
