using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ParkingSystem.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddCheckInFlow : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "BookingCode",
                table: "Reservations",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "LicensePlate",
                table: "Reservations",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<Guid>(
                name: "VehicleTypeId",
                table: "Reservations",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.AddColumn<int>(
                name: "CheckInMethod",
                table: "ParkingSessions",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<Guid>(
                name: "ReservationId",
                table: "ParkingSessions",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "SessionCode",
                table: "ParkingSessions",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.CreateIndex(
                name: "IX_Reservations_VehicleTypeId",
                table: "Reservations",
                column: "VehicleTypeId");

            migrationBuilder.CreateIndex(
                name: "IX_ParkingSessions_ReservationId",
                table: "ParkingSessions",
                column: "ReservationId");

            migrationBuilder.AddForeignKey(
                name: "FK_ParkingSessions_Reservations_ReservationId",
                table: "ParkingSessions",
                column: "ReservationId",
                principalTable: "Reservations",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_Reservations_VehicleTypes_VehicleTypeId",
                table: "Reservations",
                column: "VehicleTypeId",
                principalTable: "VehicleTypes",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_ParkingSessions_Reservations_ReservationId",
                table: "ParkingSessions");

            migrationBuilder.DropForeignKey(
                name: "FK_Reservations_VehicleTypes_VehicleTypeId",
                table: "Reservations");

            migrationBuilder.DropIndex(
                name: "IX_Reservations_VehicleTypeId",
                table: "Reservations");

            migrationBuilder.DropIndex(
                name: "IX_ParkingSessions_ReservationId",
                table: "ParkingSessions");

            migrationBuilder.DropColumn(
                name: "BookingCode",
                table: "Reservations");

            migrationBuilder.DropColumn(
                name: "LicensePlate",
                table: "Reservations");

            migrationBuilder.DropColumn(
                name: "VehicleTypeId",
                table: "Reservations");

            migrationBuilder.DropColumn(
                name: "CheckInMethod",
                table: "ParkingSessions");

            migrationBuilder.DropColumn(
                name: "ReservationId",
                table: "ParkingSessions");

            migrationBuilder.DropColumn(
                name: "SessionCode",
                table: "ParkingSessions");
        }
    }
}
