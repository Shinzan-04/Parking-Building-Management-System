using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ParkingSystem.Application.DTOs.MonthlyPass;
using ParkingSystem.Application.Interfaces;

namespace ParkingSystem.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class SubscriptionsController : ControllerBase
{
    private readonly ISubscriptionService _subscriptionService;

    public SubscriptionsController(ISubscriptionService subscriptionService)
    {
        _subscriptionService = subscriptionService;
    }

    [Authorize]
    [HttpGet("my-subscriptions")]
    public async Task<IActionResult> GetMySubscriptions()
    {
        var driverId = GetCurrentUserId();
        var subs = await _subscriptionService.GetMySubscriptionsAsync(driverId);
        return Ok(subs);
    }

    [Authorize(Roles = "Admin,Manager")]
    [HttpGet]
    public async Task<IActionResult> GetAllSubscriptions()
    {
        var subs = await _subscriptionService.GetAllSubscriptionsAsync();
        return Ok(subs);
    }

    [Authorize]
    [HttpPost("register")]
    public async Task<IActionResult> RegisterSubscription([FromBody] RegisterSubscriptionRequest request)
    {
        try
        {
            var driverId = GetCurrentUserId();
            var result = await _subscriptionService.RegisterSubscriptionAsync(driverId, request);
            return Ok(result);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [Authorize]
    [HttpPost("{id}/cancel")]
    public async Task<IActionResult> CancelSubscription(Guid id)
    {
        var driverId = GetCurrentUserId();
        var result = await _subscriptionService.CancelSubscriptionAsync(id, driverId);
        return result ? Ok(new { message = "Đã hủy vé tháng." }) : NotFound();
    }

    [Authorize(Roles = "Driver")]
    [HttpPost("{id}/request-cancel")]
    public async Task<IActionResult> RequestCancel(Guid id, [FromBody] RequestCancelSubscriptionRequest request)
    {
        var driverId = GetCurrentUserId();
        var result = await _subscriptionService.RequestCancelAsync(id, driverId, request.Reason);
        return result ? Ok(new { message = "Đã gửi yêu cầu hủy vé tháng." }) : BadRequest("Không thể gửi yêu cầu hủy (vé không tồn tại hoặc không ở trạng thái Active).");
    }

    [Authorize(Roles = "Admin,Manager")]
    [HttpPost("{id}/process-cancel")]
    public async Task<IActionResult> ProcessCancel(Guid id, [FromBody] ProcessCancelSubscriptionRequest request)
    {
        var adminId = GetCurrentUserId();
        var result = await _subscriptionService.ProcessCancelRequestAsync(id, adminId, request.IsApproved, request.RefundAmount, request.RejectReason);
        return result ? Ok(new { message = "Đã xử lý yêu cầu hủy vé tháng." }) : BadRequest("Không thể xử lý (yêu cầu không tồn tại hoặc đã được xử lý).");
    }

    [Authorize(Roles = "Admin,Manager")]
    [HttpPost("{id}/admin-cancel")]
    public async Task<IActionResult> AdminForceCancel(Guid id, [FromBody] AdminForceCancelRequest request)
    {
        var adminId = GetCurrentUserId();
        var result = await _subscriptionService.AdminForceCancelAsync(id, adminId, request.RefundAmount, request.Reason);
        return result ? Ok(new { message = "Đã hủy vé tháng thành công." }) : BadRequest("Không thể hủy vé này.");
    }

    private Guid GetCurrentUserId()
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier) ?? User.FindFirst("sub");
        if (userIdClaim == null || !Guid.TryParse(userIdClaim.Value, out var userId))
            throw new UnauthorizedAccessException("Không xác định được người dùng.");
        return userId;
    }
}
