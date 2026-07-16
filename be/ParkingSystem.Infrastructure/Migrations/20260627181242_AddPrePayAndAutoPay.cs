using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ParkingSystem.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddPrePayAndAutoPay : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "AutoPayEnabled",
                table: "Users",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<DateTime>(
                name: "GracePeriodEndTime",
                table: "ParkingSessions",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "GraceWarningSent",
                table: "ParkingSessions",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<decimal>(
                name: "PrePaidAmount",
                table: "ParkingSessions",
                type: "numeric",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<DateTime>(
                name: "PrePaidTime",
                table: "ParkingSessions",
                type: "timestamp with time zone",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "AutoPayEnabled",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "GracePeriodEndTime",
                table: "ParkingSessions");

            migrationBuilder.DropColumn(
                name: "GraceWarningSent",
                table: "ParkingSessions");

            migrationBuilder.DropColumn(
                name: "PrePaidAmount",
                table: "ParkingSessions");

            migrationBuilder.DropColumn(
                name: "PrePaidTime",
                table: "ParkingSessions");
        }
    }
}
