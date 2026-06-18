using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ParkingSystem.Application.DTOs.Reservation;
using ParkingSystem.Application.Interfaces;
using System.Security.Claims;

namespace ParkingSystem.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize] // Bắt buộc đăng nhập
public class ReservationsController : ControllerBase
{
    private readonly IReservationService _reservationService;

    public ReservationsController(IReservationService reservationService)
    {
        _reservationService = reservationService;
    }

    [HttpPost]
    public async Task<IActionResult> CreateReservation([FromBody] CreateReservationRequest request)
    {
        try
        {
            var driverIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(driverIdClaim)) return Unauthorized();

            var driverId = Guid.Parse(driverIdClaim);

            var result = await _reservationService.CreateReservationAsync(driverId, request);
            return Ok(result);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpGet("my-reservations")]
    public async Task<IActionResult> GetMyReservations()
    {
        var driverIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(driverIdClaim)) return Unauthorized();

        var driverId = Guid.Parse(driverIdClaim);
        var result = await _reservationService.GetMyReservationsAsync(driverId);
        return Ok(result);
    }

    [HttpPut("{id}/cancel")]
    public async Task<IActionResult> CancelReservation(Guid id)
    {
        try
        {
            var driverIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(driverIdClaim)) return Unauthorized();

            var driverId = Guid.Parse(driverIdClaim);

            var success = await _reservationService.CancelReservationAsync(id, driverId);
            if (success) return Ok(new { message = "Hủy đặt chỗ thành công." });
            return BadRequest();
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    // --- API DÀNH CHO STAFF / MANAGER ---

    [HttpGet("pending")]
    [Authorize(Roles = "Staff,Manager,Admin")]
    public async Task<IActionResult> GetPendingReservations()
    {
        var staffIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(staffIdClaim)) return Unauthorized();

        var staffId = Guid.Parse(staffIdClaim);
        var result = await _reservationService.GetPendingReservationsAsync(staffId);
        return Ok(result);
    }

    [HttpPut("{id}/review")]
    [Authorize(Roles = "Staff,Manager,Admin")]
    public async Task<IActionResult> ReviewReservation(Guid id, [FromBody] ReviewReservationRequest request)
    {
        try
        {
            var staffIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(staffIdClaim)) return Unauthorized();

            var staffId = Guid.Parse(staffIdClaim);

            var success = await _reservationService.ReviewReservationAsync(id, staffId, request);
            
            var statusMsg = request.IsAccepted ? "chấp nhận" : "từ chối";
            if (success) return Ok(new { message = $"Đã {statusMsg} yêu cầu đặt chỗ." });
            
            return BadRequest();
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }
}
