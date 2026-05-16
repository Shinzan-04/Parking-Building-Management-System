using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ParkingSystem.Application.DTOs.CheckIn;
using ParkingSystem.Application.Interfaces;

namespace ParkingSystem.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class CheckInController : ControllerBase
{
    private readonly ICheckInService _checkInService;

    public CheckInController(ICheckInService checkInService)
    {
        _checkInService = checkInService;
    }

    /// <summary>
    /// NHÁNH 1: Check-in bằng mã QR Booking (đã đặt trước)
    /// Trả về CheckInResponse nếu biển số khớp, hoặc CheckInMismatchResponse nếu lệch
    /// </summary>
    [HttpPost("booking")]
    [Authorize(Roles = "Staff,Manager,Admin")]
    public async Task<IActionResult> CheckInWithBooking([FromBody] CheckInBookingRequest request)
    {
        try
        {
            var result = await _checkInService.CheckInWithBookingAsync(request);
            return Ok(result);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    /// <summary>
    /// NHÁNH 2: Check-in trực tiếp (khách vãng lai)
    /// </summary>
    [HttpPost("walk-in")]
    [Authorize(Roles = "Staff,Manager,Admin")]
    public async Task<IActionResult> CheckInWalkIn([FromBody] CheckInWalkInRequest request)
    {
        try
        {
            var result = await _checkInService.CheckInWalkInAsync(request);
            return Ok(result);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    /// <summary>
    /// Staff xác nhận khi biển số OCR không khớp với booking
    /// </summary>
    [HttpPost("staff-override")]
    [Authorize(Roles = "Staff,Manager,Admin")]
    public async Task<IActionResult> StaffOverride([FromBody] StaffOverrideRequest request)
    {
        try
        {
            var result = await _checkInService.StaffOverrideCheckInAsync(request);
            return Ok(result);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }
}
