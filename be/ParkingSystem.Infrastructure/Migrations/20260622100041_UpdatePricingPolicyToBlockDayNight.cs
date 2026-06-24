using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ParkingSystem.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class UpdatePricingPolicyToBlockDayNight : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Bỏ bảng PriceSettings cũ (đã được thay bằng PricingPolicy)
            migrationBuilder.DropForeignKey(
                name: "FK_WalletTransactions_Users_UserId",
                table: "WalletTransactions");

            migrationBuilder.DropTable(
                name: "PriceSettings");

            migrationBuilder.RenameColumn(
                name: "GracePeriodMinutes",
                table: "PricingPolicies",
                newName: "NightStartHour");

            migrationBuilder.RenameColumn(
                name: "BlockMinutes",
                table: "PricingPolicies",
                newName: "NightEndHour");

            migrationBuilder.AlterColumn<decimal>(
                name: "Amount",
                table: "WalletTransactions",
                type: "numeric(18,2)",
                nullable: false,
                oldClrType: typeof(decimal),
                oldType: "numeric");

            // RelatedPaymentId đã tồn tại trong DB (đã được thêm trước đó)
            // → bỏ qua AddColumn để tránh lỗi "column already exists"

            // Thêm các cột mới cho PricingPolicy (Block Ngày/Đêm)
            migrationBuilder.AddColumn<int>(
                name: "BlockDurationHours",
                table: "PricingPolicies",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<decimal>(
                name: "DailyRate",
                table: "PricingPolicies",
                type: "numeric(18,2)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "DayBlockRate",
                table: "PricingPolicies",
                type: "numeric(18,2)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "NightBlockRate",
                table: "PricingPolicies",
                type: "numeric(18,2)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "OvertimeMultiplier",
                table: "PricingPolicies",
                type: "numeric(18,2)",
                nullable: false,
                defaultValue: 0m);

            // Index RelatedPaymentId đã tồn tại → bỏ qua CreateIndex
            // FK RelatedPaymentId đã tồn tại → bỏ qua AddForeignKey

            migrationBuilder.AddForeignKey(
                name: "FK_WalletTransactions_Users_UserId",
                table: "WalletTransactions",
                column: "UserId",
                principalTable: "Users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }


        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_WalletTransactions_Payments_RelatedPaymentId",
                table: "WalletTransactions");

            migrationBuilder.DropForeignKey(
                name: "FK_WalletTransactions_Users_UserId",
                table: "WalletTransactions");

            migrationBuilder.DropIndex(
                name: "IX_WalletTransactions_RelatedPaymentId",
                table: "WalletTransactions");

            migrationBuilder.DropColumn(
                name: "RelatedPaymentId",
                table: "WalletTransactions");

            migrationBuilder.DropColumn(
                name: "BlockDurationHours",
                table: "PricingPolicies");

            migrationBuilder.DropColumn(
                name: "DailyRate",
                table: "PricingPolicies");

            migrationBuilder.DropColumn(
                name: "DayBlockRate",
                table: "PricingPolicies");

            migrationBuilder.DropColumn(
                name: "NightBlockRate",
                table: "PricingPolicies");

            migrationBuilder.DropColumn(
                name: "OvertimeMultiplier",
                table: "PricingPolicies");

            migrationBuilder.RenameColumn(
                name: "NightStartHour",
                table: "PricingPolicies",
                newName: "GracePeriodMinutes");

            migrationBuilder.RenameColumn(
                name: "NightEndHour",
                table: "PricingPolicies",
                newName: "BlockMinutes");

            migrationBuilder.AlterColumn<decimal>(
                name: "Amount",
                table: "WalletTransactions",
                type: "numeric",
                nullable: false,
                oldClrType: typeof(decimal),
                oldType: "numeric(18,2)");

            migrationBuilder.CreateTable(
                name: "PriceSettings",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UpdatedBy = table.Column<Guid>(type: "uuid", nullable: true),
                    VehicleTypeId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    DailyMaxPrice = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    DayPassPrice = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    DayStartHour = table.Column<int>(type: "integer", nullable: false),
                    GracePeriodMinutes = table.Column<int>(type: "integer", nullable: false),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    NightPassPrice = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    NightStartHour = table.Column<int>(type: "integer", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
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

            migrationBuilder.AddForeignKey(
                name: "FK_WalletTransactions_Users_UserId",
                table: "WalletTransactions",
                column: "UserId",
                principalTable: "Users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }
    }
}
