using System;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ParkingSystem.Application.DTOs.Wallet;
using ParkingSystem.Application.Interfaces;

namespace ParkingSystem.API.Controllers;

[Route("api/[controller]")]
[ApiController]
[Authorize] // Yêu cầu đăng nhập mới được xem/rút ví
public class WalletsController : ControllerBase
{
    private readonly IWalletService _walletService;

    public WalletsController(IWalletService walletService)
    {
        _walletService = walletService;
    }

    private Guid GetUserId()
    {
        return Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
    }

    [HttpGet("me")]
    public async Task<IActionResult> GetMyBalance()
    {
        try
        {
            var balance = await _walletService.GetMyBalanceAsync(GetUserId());
            return Ok(balance);
        }
        catch (Exception ex)
        {
            var msg = ex.Message;
            if (ex.InnerException != null) msg += " | Inner: " + ex.InnerException.Message;
            return BadRequest(new { Message = msg });
        }
    }

    [HttpPost("withdraw")]
    public async Task<IActionResult> Withdraw([FromBody] WithdrawRequestDto request)
    {
        try
        {
            var result = await _walletService.WithdrawAsync(GetUserId(), request);
            return Ok(new { Message = "Rút tiền thành công. Tiền đang được chuyển về ngân hàng của bạn." });
        }
        catch (Exception ex)
        {
            var msg = ex.Message;
            if (ex.InnerException != null) msg += " | Inner: " + ex.InnerException.Message;
            return BadRequest(new { Message = msg });
        }
    }
    [HttpPost("deposit")]
    public async Task<IActionResult> Deposit([FromBody] DepositRequestDto request, [FromServices] IPaymentService paymentService)
    {
        try
        {
            if (request.Amount < 10000)
            {
                return BadRequest(new { Message = "Số tiền nạp tối thiểu là 10,000 VND." });
            }

            var userId = GetUserId();

            // Lấy origin từ Referer hoặc Origin header để build returnUrl về /wallet
            var origin = Request.Headers["Origin"].FirstOrDefault()
                      ?? Request.Headers["Referer"].FirstOrDefault()?.Split('/').Take(3).Aggregate((a, b) => a + "/" + b)
                      ?? "http://localhost:5173";

            var payosResult = await paymentService.CreatePayOSPaymentAsync(new ParkingSystem.Application.DTOs.Payment.CreatePayOSPaymentRequest
            {
                Amount = request.Amount,
                Description = "Nap tien vao vi",
                IsWalletDeposit = true,
                UserId = userId,
                ReturnUrl = $"{origin}/wallet?deposited=1",
                CancelUrl = $"{origin}/wallet?deposited=0",
            });

            return Ok(new 
            { 
                Message = "Tạo yêu cầu nạp tiền thành công.",
                CheckoutUrl = payosResult.CheckoutUrl,
                OrderCode = payosResult.OrderCode
            });
        }
        catch (Exception ex)
        {
            return BadRequest(new { Message = ex.Message });
        }
    }

    [HttpPost("bank-account")]
    public async Task<IActionResult> AddBankAccount([FromBody] ParkingSystem.Application.DTOs.Wallet.AddBankAccountDto request, [FromServices] ParkingSystem.Infrastructure.Data.ApplicationDbContext context)
    {
        try
        {
            var userId = GetUserId();
            var account = new ParkingSystem.Domain.Entities.UserBankAccount
            {
                Id = Guid.NewGuid(),
                UserId = userId,
                BankName = request.BankName,
                BankBin = request.BankBin,
                AccountNumber = request.AccountNumber,
                AccountHolderName = request.AccountName,
                IsDefault = true, // Mặc định cái đầu tiên hoặc mới thêm là true
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };

            // Nếu đây là tài khoản đầu tiên, tự động là Default
            var hasOther = await context.UserBankAccounts.AnyAsync(b => b.UserId == userId);
            if (hasOther)
            {
                // Nếu muốn tài khoản mới là mặc định thì bỏ Default các tài khoản cũ
                var oldDefaults = await context.UserBankAccounts.Where(b => b.UserId == userId && b.IsDefault).ToListAsync();
                foreach (var old in oldDefaults) old.IsDefault = false;
            }

            context.UserBankAccounts.Add(account);
            await context.SaveChangesAsync();
            return Ok(new { Message = "Thêm tài khoản ngân hàng thành công.", Id = account.Id });
        }
        catch (Exception ex)
        {
            return BadRequest(new { Message = ex.Message });
        }
    }

    [HttpGet("bank-accounts")]
    public async Task<IActionResult> GetBankAccounts([FromServices] ParkingSystem.Infrastructure.Data.ApplicationDbContext context)
    {
        try
        {
            var userId = GetUserId();
            var accounts = await context.UserBankAccounts
                .Where(b => b.UserId == userId)
                .OrderByDescending(b => b.IsDefault)
                .ThenByDescending(b => b.CreatedAt)
                .Select(b => new
                {
                    b.Id,
                    b.BankName,
                    b.BankBin,
                    b.AccountNumber,
                    b.AccountHolderName,
                    b.IsDefault,
                    b.CreatedAt
                })
                .ToListAsync();

            return Ok(accounts);
        }
        catch (Exception ex)
        {
            return BadRequest(new { Message = ex.Message });
        }
    }

    [HttpPut("bank-account/{id}")]
    public async Task<IActionResult> UpdateBankAccount(Guid id, [FromBody] ParkingSystem.Application.DTOs.Wallet.UpdateBankAccountDto request, [FromServices] ParkingSystem.Infrastructure.Data.ApplicationDbContext context)
    {
        try
        {
            var userId = GetUserId();
            var account = await context.UserBankAccounts.FirstOrDefaultAsync(b => b.Id == id && b.UserId == userId);
            
            if (account == null)
                return NotFound(new { Message = "Không tìm thấy tài khoản ngân hàng." });

            account.BankName = request.BankName;
            account.BankBin = request.BankBin;
            account.AccountNumber = request.AccountNumber;
            account.AccountHolderName = request.AccountName;
            account.UpdatedAt = DateTime.UtcNow;

            if (request.IsDefault && !account.IsDefault)
            {
                var oldDefaults = await context.UserBankAccounts.Where(b => b.UserId == userId && b.IsDefault).ToListAsync();
                foreach (var old in oldDefaults) old.IsDefault = false;
                account.IsDefault = true;
            }

            await context.SaveChangesAsync();
            return Ok(new { Message = "Cập nhật tài khoản ngân hàng thành công." });
        }
        catch (Exception ex)
        {
            return BadRequest(new { Message = ex.Message });
        }
    }

    [HttpDelete("bank-account/{id}")]
    public async Task<IActionResult> DeleteBankAccount(Guid id, [FromServices] ParkingSystem.Infrastructure.Data.ApplicationDbContext context)
    {
        try
        {
            var userId = GetUserId();
            var account = await context.UserBankAccounts.FirstOrDefaultAsync(b => b.Id == id && b.UserId == userId);
            
            if (account == null)
                return NotFound(new { Message = "Không tìm thấy tài khoản ngân hàng." });

            context.UserBankAccounts.Remove(account);
            await context.SaveChangesAsync();

            // Nếu xoá cái Default, tự động set cái cũ nhất thành Default
            if (account.IsDefault)
            {
                var nextDefault = await context.UserBankAccounts.Where(b => b.UserId == userId).OrderBy(b => b.CreatedAt).FirstOrDefaultAsync();
                if (nextDefault != null)
                {
                    nextDefault.IsDefault = true;
                    await context.SaveChangesAsync();
                }
            }

            return Ok(new { Message = "Đã xoá tài khoản ngân hàng." });
        }
        catch (Exception ex)
        {
            return BadRequest(new { Message = ex.Message });
        }
    }
}
