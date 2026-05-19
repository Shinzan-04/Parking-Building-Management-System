using Microsoft.AspNetCore.Mvc;
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
}
