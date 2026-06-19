using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ParkingSystem.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class UpdateSchema : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Users_Buildings_AssignedBuildingId",
                table: "Users");

            migrationBuilder.AddForeignKey(
                name: "FK_Users_Buildings_AssignedBuildingId",
                table: "Users",
                column: "AssignedBuildingId",
                principalTable: "Buildings",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Users_Buildings_AssignedBuildingId",
                table: "Users");

            migrationBuilder.AddForeignKey(
                name: "FK_Users_Buildings_AssignedBuildingId",
                table: "Users",
                column: "AssignedBuildingId",
                principalTable: "Buildings",
                principalColumn: "Id");
        }
    }
}
