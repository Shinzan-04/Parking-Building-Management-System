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
    /// [THỪA THEO RULE] — Nằm ngoài 3 flow cơ bản.
    /// Kịch bản Booking/Reservation không thuộc giới hạn của dự án.
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
    /// [THỪA THEO RULE] — Nằm ngoài 3 flow cơ bản.
    /// Flow quét QR của tài xế không thuộc giới hạn yêu cầu.
    /// </summary>
    [HttpPost("driver-qr")]
    [Authorize(Roles = "Staff,Manager,Admin")]
    public async Task<IActionResult> CheckInWithDriverQr([FromBody] CheckInDriverQrRequest request)
    {
        try
        {
            var result = await _checkInService.CheckInWithDriverQrAsync(request);
            return Ok(result);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    /// <summary>
    /// [THỪA THEO RULE] — API này sẽ bị thay thế bằng API chuẩn hóa duy nhất.
    /// </summary>
    [HttpPost("walk-in")]
    [Authorize(Roles = "Staff,Manager,Admin")]
    public async Task<IActionResult> CheckInWalkIn([FromBody] CheckInWalkInRequest request)
    {
        try
        {
            if (!request.StaffId.HasValue)
            {
                var userIdClaim = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier);
                if (userIdClaim != null && Guid.TryParse(userIdClaim.Value, out var userId))
                {
                    request.StaffId = userId;
                }
            }

            var result = await _checkInService.CheckInWalkInAsync(request);
            return Ok(result);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    /// <summary>
    /// [THỪA THEO RULE] — Tính năng xử lý mâu thuẫn Booking nằm ngoài 3 flow cơ bản.
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
    /// [API CHÍNH THỨC THEO RULE 1] — Vehicle Check-in Flow
    /// Tiếp nhận biển số/loại xe -> Tìm ParkingSlot -> Đổi trạng thái Occupied -> Tạo ParkingSession Active
    /// (Lưu ý: Logic kiểm tra Booking bên trong Service hiện đang là THỪA và cần được gỡ bỏ)
    /// </summary>
    [HttpPost("smart")]
    [Authorize(Roles = "Staff,Manager,Admin")]
    public async Task<IActionResult> SmartCheckIn([FromBody] SmartCheckInRequest request)
    {
        try
        {
            // Tự lấy StaffId từ JWT nếu FE không truyền
            if (!request.StaffId.HasValue)
            {
                var userIdClaim = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier);
                if (userIdClaim != null && Guid.TryParse(userIdClaim.Value, out var userId))
                {
                    request.StaffId = userId;
                }
            }

            var result = await _checkInService.SmartCheckInAsync(request);
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
