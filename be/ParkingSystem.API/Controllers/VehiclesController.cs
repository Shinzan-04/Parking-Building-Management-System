using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ParkingSystem.Application.DTOs.Vehicle;
using ParkingSystem.Application.Interfaces;

namespace ParkingSystem.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize(Roles = "Driver")]
public class VehiclesController : ControllerBase
{
    private readonly IVehicleService _vehicleService;

    public VehiclesController(IVehicleService vehicleService)
    {
        _vehicleService = vehicleService;
    }

    [HttpGet("my-vehicles")]
    public async Task<IActionResult> GetMyVehicles()
    {
        var driverIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(driverIdClaim)) return Unauthorized();

        var driverId = Guid.Parse(driverIdClaim);
        var result = await _vehicleService.GetMyVehiclesAsync(driverId);
        return Ok(result);
    }

    [HttpPost]
    public async Task<IActionResult> CreateVehicle([FromBody] CreateVehicleRequest request)
    {
        try
        {
            var driverIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(driverIdClaim)) return Unauthorized();

            var driverId = Guid.Parse(driverIdClaim);
            var result = await _vehicleService.CreateVehicleAsync(driverId, request);
            return Ok(result);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> UpdateVehicle(Guid id, [FromBody] UpdateVehicleRequest request)
    {
        try
        {
            var driverIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(driverIdClaim)) return Unauthorized();

            var driverId = Guid.Parse(driverIdClaim);
            var result = await _vehicleService.UpdateVehicleAsync(id, driverId, request);
            return Ok(result);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteVehicle(Guid id)
    {
        var driverIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(driverIdClaim)) return Unauthorized();

        var driverId = Guid.Parse(driverIdClaim);
        var success = await _vehicleService.DeleteVehicleAsync(id, driverId);
        if (success) return Ok(new { message = "Xóa phương tiện thành công." });
        return BadRequest(new { message = "Xóa phương tiện thất bại." });
    }

    [HttpPut("{id}/set-primary")]
    public async Task<IActionResult> SetPrimaryVehicle(Guid id)
    {
        try
        {
            var driverIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(driverIdClaim)) return Unauthorized();

            var driverId = Guid.Parse(driverIdClaim);
            var success = await _vehicleService.SetPrimaryVehicleAsync(id, driverId);
            if (success) return Ok(new { message = "Thiết lập phương tiện mặc định thành công." });
            return BadRequest();
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }
}
