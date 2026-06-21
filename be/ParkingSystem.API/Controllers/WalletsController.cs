using System;
using System.Security.Claims;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
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
            return BadRequest(new { Message = ex.Message });
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
            return BadRequest(new { Message = ex.Message });
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

            var payosResult = await paymentService.CreatePayOSPaymentAsync(new ParkingSystem.Application.DTOs.Payment.CreatePayOSPaymentRequest
            {
                Amount = request.Amount,
                Description = "Nap tien vao vi",
                IsWalletDeposit = true,
                UserId = userId
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
                IsDefault = true,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };
            context.UserBankAccounts.Add(account);
            await context.SaveChangesAsync();
            return Ok(new { Message = "Thêm tài khoản ngân hàng thành công." });
        }
        catch (Exception ex)
        {
            return BadRequest(new { Message = ex.Message });
        }
    }
}
