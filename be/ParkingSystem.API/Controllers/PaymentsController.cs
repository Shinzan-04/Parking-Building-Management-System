using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ParkingSystem.Application.DTOs.Payment;
using ParkingSystem.Application.Interfaces;

namespace ParkingSystem.API.Controllers;

[ApiController]
[Route("api/payments")]
public class PaymentsController : ControllerBase
{
    private readonly IPaymentService _paymentService;

    public PaymentsController(IPaymentService paymentService)
    {
        _paymentService = paymentService;
    }

    [HttpPost("payos/create")]
    [ProducesResponseType(typeof(PayOSCheckoutResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status500InternalServerError)]
    public async Task<IActionResult> CreatePayOSPayment([FromBody] CreatePayOSPaymentRequest request)
    {
        try
        {
            if (request.Amount <= 0)
                return BadRequest(new { message = "Amount must be greater than 0." });

            var result = await _paymentService.CreatePayOSPaymentAsync(request);
            return Ok(result);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return StatusCode(StatusCodes.Status500InternalServerError,
                new { message = ex.Message });
        }
    }

    [HttpPost("payos/webhook")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> PayOSWebhook([FromBody] System.Text.Json.JsonElement webhookData)
    {
        try
        {
            var success = await _paymentService.ProcessPayOSWebhookAsync(webhookData);
            if (!success)
            {
                // Tạm thời trả về 200 OK để PayOS cho phép Lưu Webhook URL
                return Ok(new { message = "Webhook test received (signature or data invalid but ignored for setup)." });
            }

            return Ok(new { message = "Webhook processed successfully." });
        }
        catch (Exception)
        {
            return StatusCode(StatusCodes.Status500InternalServerError,
                new { message = "Internal server error." });
        }
    }

    [HttpGet("status/{sessionId}")]
    public async Task<IActionResult> GetPaymentStatus(Guid sessionId)
    {
        var result = await _paymentService.GetPaymentStatusBySessionIdAsync(sessionId);
        if (result == null)
            return NotFound(new { message = "Khong tim thay thanh toan PayOS cho phien nay." });
        return Ok(result);
    }

    [HttpGet("verify/{orderCode}")]
    public async Task<IActionResult> VerifyPayment(
        long orderCode,
        [FromServices] IReservationService reservationService,
        [FromServices] ParkingSystem.Infrastructure.Data.ApplicationDbContext context)
    {
        try
        {
            var (success, status) = await _paymentService.VerifyPayOSPaymentAsync(orderCode);
            
            if (status == ParkingSystem.Domain.Enums.PaymentStatus.Success)
            {
                var payment = await context.Payments.FirstOrDefaultAsync(p => p.PayOSOrderCode == orderCode);
                if (payment != null)
                {
                    if (payment.ReservationId.HasValue)
                    {
                        var reservation = await context.Reservations.FindAsync(payment.ReservationId.Value);
                        if (reservation != null && reservation.Status == ParkingSystem.Domain.Enums.ReservationStatus.PaymentPending)
                        {
                            await reservationService.ConfirmPaymentAsync(payment.ReservationId.Value);
                        }
                    }
                    else if (payment.UserId.HasValue && !payment.ReservationId.HasValue && !payment.ParkingSessionId.HasValue && payment.Status == ParkingSystem.Domain.Enums.PaymentStatus.Pending)
                    {
                        // Xử lý nạp tiền vào ví
                        var user = await context.Users.FindAsync(payment.UserId.Value);
                        if (user != null)
                        {
                            user.Balance += payment.Amount;
                            context.WalletTransactions.Add(new ParkingSystem.Domain.Entities.WalletTransaction
                            {
                                Id = Guid.NewGuid(),
                                UserId = user.Id,
                                Amount = payment.Amount,
                                Type = "Deposit",
                                Status = "Success",
                                Description = $"Nạp tiền vào ví qua PayOS (Order: {payment.PayOSOrderCode})",
                                ReferenceId = payment.PayOSOrderCode.ToString(),
                                CreatedAt = DateTime.UtcNow
                            });
                            payment.Status = ParkingSystem.Domain.Enums.PaymentStatus.Success;
                            payment.UpdatedAt = DateTime.UtcNow;
                            await context.SaveChangesAsync();
                        }
                    }
                }
            }
            else if (status == ParkingSystem.Domain.Enums.PaymentStatus.Failed)
            {
                var payment = await context.Payments.FirstOrDefaultAsync(p => p.PayOSOrderCode == orderCode);
                if (payment != null && payment.ReservationId.HasValue)
                {
                    var reservation = await context.Reservations.FindAsync(payment.ReservationId.Value);
                    if (reservation != null && reservation.Status == ParkingSystem.Domain.Enums.ReservationStatus.PaymentPending)
                    {
                        await reservationService.FailPaymentAsync(payment.ReservationId.Value);
                    }
                }
            }

            return Ok(new 
            { 
                orderCode = orderCode,
                status = status.ToString(), 
                isPaid = (status == ParkingSystem.Domain.Enums.PaymentStatus.Success) 
            });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new 
            { 
                error = ex.Message, 
                details = ex.InnerException?.Message,
                stackTrace = ex.StackTrace 
            });
        }
    }

    /// <summary>
    /// Từ chối yêu cầu hoàn tiền, chuyển trạng thái về RefundFailed (Admin/Staff)
    /// </summary>
    [HttpPost("{paymentId}/reject-refund")]
    [Microsoft.AspNetCore.Authorization.Authorize(Roles = "Admin,Staff")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> RejectRefund(Guid paymentId, [FromBody] RejectRefundRequest request)
    {
        try
        {
            await _paymentService.RejectRefundAsync(paymentId, request.Reason);
            return Ok(new { message = "Đã từ chối yêu cầu hoàn tiền." });
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    /// <summary>
    /// Lấy danh sách tất cả giao dịch thanh toán, có thể lọc theo trạng thái (Admin/Staff)
    /// </summary>
    [HttpGet("list")]
    [Microsoft.AspNetCore.Authorization.Authorize(Roles = "Admin,Manager,Staff")]
    [ProducesResponseType(typeof(PaymentListResult), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetPayments([FromQuery] PaymentListQuery query)
    {
        var result = await _paymentService.GetPaymentsAsync(query);
        return Ok(result);
    }

    /// <summary>
    /// Thực hiện hoàn tiền cho giao dịch (Chỉ Admin/Staff)
    /// </summary>
    [HttpPost("{paymentId}/refund")]
    [Microsoft.AspNetCore.Authorization.Authorize(Roles = "Admin,Staff")]
    [ProducesResponseType(typeof(PaymentRefundResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> RefundPayment(Guid paymentId)
    {
        try
        {
            var response = await _paymentService.RefundPaymentAsync(paymentId);
            return Ok(response);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            return StatusCode(StatusCodes.Status500InternalServerError, new { message = "Lỗi hệ thống khi hoàn tiền.", details = ex.Message });
        }
    }
}

