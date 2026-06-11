using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ParkingSystem.Application.DTOs.PriceSetting;
using ParkingSystem.Application.Interfaces;

namespace ParkingSystem.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize(Roles = "Admin,Manager")]
public class PriceSettingsController : ControllerBase
{
    private readonly IPriceSettingService _service;

    public PriceSettingsController(IPriceSettingService service)
    {
        _service = service;
    }

    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var settings = await _service.GetAllAsync();
        return Ok(settings);
    }

    [HttpGet("{vehicleTypeId}")]
    public async Task<IActionResult> GetByVehicleType(Guid vehicleTypeId)
    {
        var setting = await _service.GetByVehicleTypeIdAsync(vehicleTypeId);
        return setting == null ? NotFound() : Ok(setting);
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreatePriceSettingRequest request)
    {
        var setting = await _service.CreateAsync(request);
        return CreatedAtAction(nameof(GetByVehicleType),
            new { vehicleTypeId = setting.VehicleTypeId }, setting);
    }

    [HttpPut("{vehicleTypeId}")]
    public async Task<IActionResult> Update(Guid vehicleTypeId, [FromBody] UpdatePriceSettingRequest request)
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(userIdClaim) || !Guid.TryParse(userIdClaim, out var updatedBy))
            return Unauthorized("Invalid user token.");

        var setting = await _service.UpdateAsync(vehicleTypeId, request, updatedBy);
        return setting == null ? NotFound() : Ok(setting);
    }

    [HttpDelete("{vehicleTypeId}")]
    public async Task<IActionResult> Delete(Guid vehicleTypeId)
    {
        var result = await _service.DeleteAsync(vehicleTypeId);
        return result ? NoContent() : NotFound();
    }
}
