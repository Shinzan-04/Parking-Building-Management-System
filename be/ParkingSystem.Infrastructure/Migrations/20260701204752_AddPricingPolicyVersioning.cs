using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ParkingSystem.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddPricingPolicyVersioning : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "PricingPolicyId",
                table: "Reservations",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "EffectiveDate",
                table: "PricingPolicies",
                type: "timestamp with time zone",
                nullable: false,
                defaultValue: new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified));

            migrationBuilder.AddColumn<bool>(
                name: "IsActive",
                table: "PricingPolicies",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<Guid>(
                name: "PreviousVersionId",
                table: "PricingPolicies",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "Version",
                table: "PricingPolicies",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<Guid>(
                name: "PricingPolicyId",
                table: "ParkingSessions",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Reservations_PricingPolicyId",
                table: "Reservations",
                column: "PricingPolicyId");

            migrationBuilder.CreateIndex(
                name: "IX_ParkingSessions_PricingPolicyId",
                table: "ParkingSessions",
                column: "PricingPolicyId");

            migrationBuilder.AddForeignKey(
                name: "FK_ParkingSessions_PricingPolicies_PricingPolicyId",
                table: "ParkingSessions",
                column: "PricingPolicyId",
                principalTable: "PricingPolicies",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_Reservations_PricingPolicies_PricingPolicyId",
                table: "Reservations",
                column: "PricingPolicyId",
                principalTable: "PricingPolicies",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_ParkingSessions_PricingPolicies_PricingPolicyId",
                table: "ParkingSessions");

            migrationBuilder.DropForeignKey(
                name: "FK_Reservations_PricingPolicies_PricingPolicyId",
                table: "Reservations");

            migrationBuilder.DropIndex(
                name: "IX_Reservations_PricingPolicyId",
                table: "Reservations");

            migrationBuilder.DropIndex(
                name: "IX_ParkingSessions_PricingPolicyId",
                table: "ParkingSessions");

            migrationBuilder.DropColumn(
                name: "PricingPolicyId",
                table: "Reservations");

            migrationBuilder.DropColumn(
                name: "EffectiveDate",
                table: "PricingPolicies");

            migrationBuilder.DropColumn(
                name: "IsActive",
                table: "PricingPolicies");

            migrationBuilder.DropColumn(
                name: "PreviousVersionId",
                table: "PricingPolicies");

            migrationBuilder.DropColumn(
                name: "Version",
                table: "PricingPolicies");

            migrationBuilder.DropColumn(
                name: "PricingPolicyId",
                table: "ParkingSessions");
        }
    }
}
