using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ParkingSystem.Infrastructure.Migrations
{
    [Microsoft.EntityFrameworkCore.Infrastructure.DbContext(typeof(ParkingSystem.Infrastructure.Data.ApplicationDbContext))]
    [Migration("20260622053000_AddRelatedPaymentId")]
    public partial class AddRelatedPaymentId : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "RelatedPaymentId",
                table: "WalletTransactions",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "DummyTest",
                table: "WalletTransactions",
                type: "text",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_WalletTransactions_RelatedPaymentId",
                table: "WalletTransactions",
                column: "RelatedPaymentId");

            migrationBuilder.AddForeignKey(
                name: "FK_WalletTransactions_Payments_RelatedPaymentId",
                table: "WalletTransactions",
                column: "RelatedPaymentId",
                principalTable: "Payments",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_WalletTransactions_Payments_RelatedPaymentId",
                table: "WalletTransactions");

            migrationBuilder.DropIndex(
                name: "IX_WalletTransactions_RelatedPaymentId",
                table: "WalletTransactions");

            migrationBuilder.DropColumn(
                name: "RelatedPaymentId",
                table: "WalletTransactions");

            migrationBuilder.DropColumn(
                name: "DummyTest",
                table: "WalletTransactions");
        }
    }
}
