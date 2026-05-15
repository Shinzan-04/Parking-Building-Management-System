using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ParkingSystem.Application.DTOs.VehicleType;
using ParkingSystem.Application.Interfaces;

namespace ParkingSystem.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class VehicleTypesController : ControllerBase
{
    private readonly IVehicleTypeService _vehicleTypeService;

    public VehicleTypesController(IVehicleTypeService vehicleTypeService)
    {
        _vehicleTypeService = vehicleTypeService;
    }

    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var types = await _vehicleTypeService.GetAllAsync();
        return Ok(types);
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetById(Guid id)
    {
        var type = await _vehicleTypeService.GetByIdAsync(id);
        return type == null ? NotFound() : Ok(type);
    }

    [HttpPost]
    [Authorize(Roles = "Admin,Manager")]
    public async Task<IActionResult> Create([FromBody] CreateVehicleTypeRequest request)
    {
        var type = await _vehicleTypeService.CreateAsync(request);
        return CreatedAtAction(nameof(GetById), new { id = type.Id }, type);
    }

    [HttpPut("{id}")]
    [Authorize(Roles = "Admin,Manager")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateVehicleTypeRequest request)
    {
        var type = await _vehicleTypeService.UpdateAsync(id, request);
        return type == null ? NotFound() : Ok(type);
    }

    [HttpDelete("{id}")]
    [Authorize(Roles = "Admin,Manager")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var result = await _vehicleTypeService.DeleteAsync(id);
        return result ? NoContent() : NotFound();
    }
}
