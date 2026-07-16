using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ParkingSystem.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AdvancedReservationFlow : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "AIReason",
                table: "Reservations",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<double>(
                name: "AIScore",
                table: "Reservations",
                type: "double precision",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "BookingMethod",
                table: "Reservations",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<Guid>(
                name: "VehicleId",
                table: "Reservations",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "FavoriteSlots",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    DriverId = table.Column<Guid>(type: "uuid", nullable: false),
                    ParkingSlotId = table.Column<Guid>(type: "uuid", nullable: false),
                    UsageCount = table.Column<int>(type: "integer", nullable: false),
                    LastUsedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FavoriteSlots", x => x.Id);
                    table.ForeignKey(
                        name: "FK_FavoriteSlots_ParkingSlots_ParkingSlotId",
                        column: x => x.ParkingSlotId,
                        principalTable: "ParkingSlots",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_FavoriteSlots_Users_DriverId",
                        column: x => x.DriverId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Reservations_VehicleId",
                table: "Reservations",
                column: "VehicleId");

            migrationBuilder.CreateIndex(
                name: "IX_FavoriteSlots_DriverId_ParkingSlotId",
                table: "FavoriteSlots",
                columns: new[] { "DriverId", "ParkingSlotId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_FavoriteSlots_ParkingSlotId",
                table: "FavoriteSlots",
                column: "ParkingSlotId");

            migrationBuilder.AddForeignKey(
                name: "FK_Reservations_Vehicles_VehicleId",
                table: "Reservations",
                column: "VehicleId",
                principalTable: "Vehicles",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Reservations_Vehicles_VehicleId",
                table: "Reservations");

            migrationBuilder.DropTable(
                name: "FavoriteSlots");

            migrationBuilder.DropIndex(
                name: "IX_Reservations_VehicleId",
                table: "Reservations");

            migrationBuilder.DropColumn(
                name: "AIReason",
                table: "Reservations");

            migrationBuilder.DropColumn(
                name: "AIScore",
                table: "Reservations");

            migrationBuilder.DropColumn(
                name: "BookingMethod",
                table: "Reservations");

            migrationBuilder.DropColumn(
                name: "VehicleId",
                table: "Reservations");
        }
    }
}
