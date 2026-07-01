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

    private Guid GetCurrentUserId()
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier) ?? User.FindFirst("sub");
        if (userIdClaim == null || !Guid.TryParse(userIdClaim.Value, out var userId))
            throw new UnauthorizedAccessException("Không xác định được người dùng.");
        return userId;
    }
}
