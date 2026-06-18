using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ParkingSystem.Application.DTOs.Building;
using ParkingSystem.Application.Interfaces;

namespace ParkingSystem.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class BuildingsController : ControllerBase
{
    private readonly IBuildingService _buildingService;
    private readonly IUserService _userService;

    public BuildingsController(IBuildingService buildingService, IUserService userService)
    {
        _buildingService = buildingService;
        _userService = userService;
    }

    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var buildings = await _buildingService.GetAllAsync();
        return Ok(buildings);
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetById(Guid id)
    {
        var building = await _buildingService.GetByIdAsync(id);
        return building == null ? NotFound() : Ok(building);
    }

    [HttpPost]
    [Authorize(Roles = "Admin,Manager")]
    public async Task<IActionResult> Create([FromBody] CreateBuildingRequest request)
    {
        var building = await _buildingService.CreateAsync(request);
        return CreatedAtAction(nameof(GetById), new { id = building.Id }, building);
    }

    [HttpPut("{id}")]
    [Authorize(Roles = "Admin,Manager")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateBuildingRequest request)
    {
        var building = await _buildingService.UpdateAsync(id, request);
        return building == null ? NotFound() : Ok(building);
    }

    [HttpDelete("{id}")]
    [Authorize(Roles = "Admin,Manager")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var result = await _buildingService.DeleteAsync(id);
        return result ? NoContent() : NotFound();
    }

    // ── Staff Assignment ──────────────────────────────────────────────────

    [HttpGet("{id}/staff")]
    [Authorize(Roles = "Admin,Manager")]
    public async Task<IActionResult> GetStaff(Guid id)
    {
        var staff = await _userService.GetStaffByBuildingAsync(id);
        return Ok(staff);
    }

    [HttpPost("{id}/staff/{staffId}")]
    [Authorize(Roles = "Admin,Manager")]
    public async Task<IActionResult> AssignStaff(Guid id, Guid staffId)
    {
        var result = await _userService.AssignStaffToBuildingAsync(staffId, id);
        if (!result) return BadRequest(new { message = "Không tìm thấy nhân viên hoặc người dùng không phải Staff." });
        return Ok(new { message = "Đã phân công nhân viên vào tòa nhà." });
    }

    [HttpDelete("{id}/staff/{staffId}")]
    [Authorize(Roles = "Admin,Manager")]
    public async Task<IActionResult> UnassignStaff(Guid id, Guid staffId)
    {
        var result = await _userService.UnassignStaffFromBuildingAsync(staffId);
        if (!result) return NotFound(new { message = "Không tìm thấy nhân viên." });
        return Ok(new { message = "Đã gỡ nhân viên khỏi tòa nhà." });
    }
}
