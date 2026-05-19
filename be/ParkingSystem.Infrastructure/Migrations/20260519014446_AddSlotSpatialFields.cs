using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ParkingSystem.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddSlotSpatialFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "IsAIRecommended",
                table: "ParkingSlots");

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

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
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

            migrationBuilder.AddColumn<bool>(
                name: "IsAIRecommended",
                table: "ParkingSlots",
                type: "boolean",
                nullable: false,
                defaultValue: false);
        }
    }
}
