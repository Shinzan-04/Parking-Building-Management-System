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
    private readonly ISlotAssignmentService _slotAssignmentService;

    public CheckInController(ICheckInService checkInService, ISlotAssignmentService slotAssignmentService)
    {
        _checkInService = checkInService;
        _slotAssignmentService = slotAssignmentService;
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
    /// Nếu SlotId = null → AI tự động gán slot tốt nhất
    /// Nếu SlotId có giá trị → Staff chọn thủ công
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

    /// <summary>
    /// Lấy danh sách gợi ý vị trí đỗ xe thông minh (AI Scoring)
    /// Staff xem trước rồi chọn, hoặc để hệ thống tự gán khi gọi walk-in
    /// </summary>
    [HttpGet("recommend-slots/{vehicleTypeId}")]
    [Authorize(Roles = "Staff,Manager,Admin")]
    public async Task<IActionResult> GetRecommendedSlots(Guid vehicleTypeId, [FromQuery] int top = 5)
    {
        try
        {
            var recommendations = await _slotAssignmentService.GetRecommendedSlotsAsync(vehicleTypeId, top);

            if (!recommendations.Any())
                return NotFound(new { message = "Không còn slot trống cho loại xe này." });

            return Ok(new
            {
                totalRecommendations = recommendations.Count,
                slots = recommendations
            });
        }
        catch (Exception ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }
}
