using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ParkingSystem.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddBuildingApprovalMode : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "ApprovalMode",
                table: "Buildings",
                type: "integer",
                nullable: false,
                defaultValue: 0);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ApprovalMode",
                table: "Buildings");
        }
    }
}
