using System;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using ParkingSystem.Application.DTOs.Wallet;
using ParkingSystem.Application.Interfaces;
using ParkingSystem.Domain.Entities;
using ParkingSystem.Infrastructure.Data;

namespace ParkingSystem.Infrastructure.Services;

public class WalletService : IWalletService
{
    private readonly ApplicationDbContext _context;
    private readonly IPaymentService _paymentService;

    public WalletService(ApplicationDbContext context, IPaymentService paymentService)
    {
        _context = context;
        _paymentService = paymentService;
    }

    public async Task<WalletBalanceDto> GetMyBalanceAsync(Guid userId)
    {
        var user = await _context.Users.FindAsync(userId);
        if (user == null) throw new Exception("Không tìm thấy người dùng.");

        var transactions = await _context.WalletTransactions
            .Where(t => t.UserId == userId)
            .OrderByDescending(t => t.CreatedAt)
            .Take(50)
            .Select(t => new WalletTransactionDto
            {
                Id = t.Id,
                Amount = t.Amount,
                Type = t.Type,
                Status = t.Status,
                Description = t.Description,
                CreatedAt = t.CreatedAt
            })
            .ToListAsync();

        return new WalletBalanceDto
        {
            Balance = user.Balance,
            Transactions = transactions
        };
    }

    public async Task<bool> WithdrawAsync(Guid userId, WithdrawRequestDto request)
    {
        if (request.Amount < 10000)
            throw new Exception("Số tiền rút tối thiểu là 10,000 VND.");

        // Dùng Transaction để tránh race condition trừ tiền quá số dư
        using var transaction = await _context.Database.BeginTransactionAsync();
        try
        {
            // Lock row User để xử lý đồng thời an toàn (nếu DB hỗ trợ, ở đây ta query bthg nhưng có EF transaction)
            var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == userId);
            if (user == null)
                throw new Exception("Không tìm thấy người dùng.");

            if (user.Balance < request.Amount)
                throw new Exception("Số dư không đủ để rút tiền.");

            // Tìm tài khoản ngân hàng mặc định
            var defaultBank = await _context.UserBankAccounts.FirstOrDefaultAsync(b => b.UserId == userId && b.IsDefault);
            if (defaultBank == null)
            {
                defaultBank = await _context.UserBankAccounts.FirstOrDefaultAsync(b => b.UserId == userId);
            }

            if (defaultBank == null)
            {
                throw new Exception("Vui lòng liên kết tài khoản ngân hàng trước khi rút tiền.");
            }

            // 1. Trừ tiền và tạo giao dịch Pending trước
            user.Balance -= request.Amount;

            string referenceId = $"WD_{DateTime.UtcNow:yyyyMMddHHmmss}_{Guid.NewGuid().ToString().Substring(0, 6).ToUpper()}";

            var walletTx = new WalletTransaction
            {
                UserId = user.Id,
                Amount = request.Amount,
                Type = "Withdrawal",
                Status = "Pending",
                Description = $"Rút tiền về ngân hàng {defaultBank.BankName}",
                ReferenceId = referenceId
            };

            _context.WalletTransactions.Add(walletTx);
            await _context.SaveChangesAsync();

            // 2. Gọi API PayOS (bắn thẳng tiền)
            var payoutResult = await _paymentService.ProcessPayoutAsync(request.Amount, referenceId, defaultBank);

            if (payoutResult.Success)
            {
                walletTx.Status = "Success";
                await _context.SaveChangesAsync();
                await transaction.CommitAsync();
                return true;
            }
            else
            {
                // Thất bại: Hoàn tiền lại ví
                user.Balance += request.Amount;
                walletTx.Status = "Failed";
                walletTx.Description += $" (Lỗi: {payoutResult.ErrorMessage})";
                await _context.SaveChangesAsync();
                await transaction.CommitAsync();
                throw new Exception($"Rút tiền qua cổng PayOS thất bại: {payoutResult.ErrorMessage}");
            }
        }
        catch (Exception)
        {
            await transaction.RollbackAsync();
            throw;
        }
    }
}
