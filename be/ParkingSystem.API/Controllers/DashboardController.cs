using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ParkingSystem.Application.Interfaces;

namespace ParkingSystem.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize] // Có thể phân quyền thêm roles = Admin, Manager nếu muốn
public class DashboardController : ControllerBase
{
    private readonly IDashboardService _dashboardService;

    public DashboardController(IDashboardService dashboardService)
    {
        _dashboardService = dashboardService;
    }

    [HttpGet("realtime-stats")]
    public async Task<IActionResult> GetRealtimeStats()
    {
        var result = await _dashboardService.GetRealtimeStatsAsync();
        return Ok(result);
    }

    [HttpGet("traffic")]
    [Authorize(Roles = "Admin,Manager")]
    public async Task<IActionResult> GetTrafficStats([FromQuery] DateTime? fromDate, [FromQuery] DateTime? toDate)
    {
        var result = await _dashboardService.GetTrafficStatsAsync(fromDate, toDate);
        return Ok(result);
    }
}
