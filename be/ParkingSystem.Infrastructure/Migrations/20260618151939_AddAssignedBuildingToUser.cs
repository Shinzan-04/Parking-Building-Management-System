using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ParkingSystem.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddAssignedBuildingToUser : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "AssignedBuildingId",
                table: "Users",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Users_AssignedBuildingId",
                table: "Users",
                column: "AssignedBuildingId");

            migrationBuilder.AddForeignKey(
                name: "FK_Users_Buildings_AssignedBuildingId",
                table: "Users",
                column: "AssignedBuildingId",
                principalTable: "Buildings",
                principalColumn: "Id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Users_Buildings_AssignedBuildingId",
                table: "Users");

            migrationBuilder.DropIndex(
                name: "IX_Users_AssignedBuildingId",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "AssignedBuildingId",
                table: "Users");
        }
    }
}
