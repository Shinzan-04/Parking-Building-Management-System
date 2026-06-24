using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ParkingSystem.Application.DTOs.Session;
using ParkingSystem.Application.Interfaces;

namespace ParkingSystem.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize(Roles = "Staff,Manager,Admin")]
public class SessionsController : ControllerBase
{
    private readonly ISessionService _sessionService;

    public SessionsController(ISessionService sessionService)
    {
        _sessionService = sessionService;
    }

    /// <summary>
    /// Lấy danh sách xe đang trong bãi (session Active)
    /// Endpoint chính cho Staff xem dashboard xe đang gửi
    /// </summary>
    [HttpGet("active")]
    public async Task<IActionResult> GetActiveSessions([FromQuery] SessionFilterRequest filter)
    {
        try
        {
            if (User.IsInRole("Staff"))
            {
                var userIdClaim = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier);
                if (userIdClaim != null && Guid.TryParse(userIdClaim.Value, out var userId))
                {
                    filter.StaffId = userId;
                }
            }

            var result = await _sessionService.GetActiveSessionsAsync(filter);
            return Ok(result);
        }
        catch (Exception ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    /// <summary>
    /// Tìm kiếm session theo nhiều tiêu chí
    /// Hỗ trợ: biển số (gần đúng), trạng thái, tòa nhà, tầng, khoảng ngày
    /// </summary>
    [HttpGet("search")]
    public async Task<IActionResult> SearchSessions([FromQuery] SessionFilterRequest filter)
    {
        try
        {
            if (User.IsInRole("Staff"))
            {
                var userIdClaim = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier);
                if (userIdClaim != null && Guid.TryParse(userIdClaim.Value, out var userId))
                {
                    filter.StaffId = userId;
                }
            }

            var result = await _sessionService.SearchSessionsAsync(filter);
            return Ok(result);
        }
        catch (Exception ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    /// <summary>
    /// Xem chi tiết 1 session theo ID
    /// </summary>
    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetSessionById(Guid id)
    {
        try
        {
            var result = await _sessionService.GetSessionByIdAsync(id);
            return Ok(result);
        }
        catch (InvalidOperationException ex)
        {
            return NotFound(new { message = ex.Message });
        }
    }

    /// <summary>
    /// Tra cứu nhanh: Tìm session đang Active theo biển số xe
    /// Dùng khi check-out — Staff quét biển số → tìm session tương ứng
    /// </summary>
    [HttpGet("find-by-plate")]
    public async Task<IActionResult> FindByPlate([FromQuery] string plate)
    {
        if (string.IsNullOrWhiteSpace(plate))
            return BadRequest(new { message = "Vui lòng nhập biển số xe." });

        try
        {
            var result = await _sessionService.FindActiveByPlateAsync(plate);
            
            if (result == null)
                return NotFound(new { message = $"Không tìm thấy xe biển số '{plate}' đang gửi trong bãi." });
            
            return Ok(result);
        }
        catch (Exception ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }
}
