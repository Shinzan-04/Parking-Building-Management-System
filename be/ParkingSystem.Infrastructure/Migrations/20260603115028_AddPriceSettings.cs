using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ParkingSystem.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddPriceSettings : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Column",
                table: "ParkingSlots");

            migrationBuilder.DropColumn(
                name: "DistanceToEntry",
                table: "ParkingSlots");

            migrationBuilder.DropColumn(
                name: "Row",
                table: "ParkingSlots");

            migrationBuilder.CreateTable(
                name: "PriceSettings",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    VehicleTypeId = table.Column<Guid>(type: "uuid", nullable: false),
                    DayPassPrice = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    NightPassPrice = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    DailyMaxPrice = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    DayStartHour = table.Column<int>(type: "integer", nullable: false),
                    NightStartHour = table.Column<int>(type: "integer", nullable: false),
                    UpdatedBy = table.Column<Guid>(type: "uuid", nullable: true),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PriceSettings", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PriceSettings_Users_UpdatedBy",
                        column: x => x.UpdatedBy,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_PriceSettings_VehicleTypes_VehicleTypeId",
                        column: x => x.VehicleTypeId,
                        principalTable: "VehicleTypes",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_PriceSettings_UpdatedBy",
                table: "PriceSettings",
                column: "UpdatedBy");

            migrationBuilder.CreateIndex(
                name: "IX_PriceSettings_VehicleTypeId",
                table: "PriceSettings",
                column: "VehicleTypeId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "PriceSettings");

            migrationBuilder.AddColumn<int>(
                name: "Column",
                table: "ParkingSlots",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "DistanceToEntry",
                table: "ParkingSlots",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "Row",
                table: "ParkingSlots",
                type: "integer",
                nullable: false,
                defaultValue: 0);
        }
    }
}
