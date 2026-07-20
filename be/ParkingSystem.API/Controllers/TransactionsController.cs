using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ParkingSystem.Application.DTOs.Payment;
using ParkingSystem.Application.Interfaces;

namespace ParkingSystem.API.Controllers;

[ApiController]
[Route("api/transactions")]
public class TransactionsController : ControllerBase
{
    private readonly IPaymentService _paymentService;

    public TransactionsController(IPaymentService paymentService)
    {
        _paymentService = paymentService;
    }

    /// <summary>
    /// Lấy danh sách lịch sử giao dịch (Transaction History)
    /// Trả về danh sách phân trang kèm theo tổng doanh thu (TotalAmount) của các giao dịch thành công.
    /// Có thể lọc theo ngày (FromDate, ToDate) và phương thức thanh toán (PaymentMethod).
    /// </summary>
    [HttpGet]
    [Authorize(Roles = "Admin,Manager,Staff")]
    [ProducesResponseType(typeof(TransactionHistoryResult), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetTransactions([FromQuery] TransactionHistoryQuery query)
    {
        try
        {
            var result = await _paymentService.GetTransactionHistoryAsync(query);
            return Ok(result);
        }
        catch (Exception ex)
        {
            return StatusCode(StatusCodes.Status500InternalServerError, new { message = "Lỗi khi lấy lịch sử giao dịch", details = ex.Message });
        }
    }
}
