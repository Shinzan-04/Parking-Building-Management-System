using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ParkingSystem.Application.DTOs.ParkingSlot;
using ParkingSystem.Application.Interfaces;

namespace ParkingSystem.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ParkingSlotsController : ControllerBase
{
    private readonly IParkingSlotService _slotService;

    public ParkingSlotsController(IParkingSlotService slotService)
    {
        _slotService = slotService;
    }

    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var slots = await _slotService.GetAllAsync();
        return Ok(slots);
    }

    [HttpGet("floor/{floorId}")]
    public async Task<IActionResult> GetByFloorId(Guid floorId)
    {
        var slots = await _slotService.GetByFloorIdAsync(floorId);
        return Ok(slots);
    }

    [HttpGet("available/{vehicleTypeId}")]
    public async Task<IActionResult> GetAvailable(Guid vehicleTypeId)
    {
        var slots = await _slotService.GetAvailableByVehicleTypeAsync(vehicleTypeId);
        return Ok(slots);
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetById(Guid id)
    {
        var slot = await _slotService.GetByIdAsync(id);
        return slot == null ? NotFound() : Ok(slot);
    }

    [HttpPost]
    [Authorize(Roles = "Admin,Manager")]
    public async Task<IActionResult> Create([FromBody] CreateParkingSlotRequest request)
    {
        var slot = await _slotService.CreateAsync(request);
        return CreatedAtAction(nameof(GetById), new { id = slot.Id }, slot);
    }

    [HttpPatch("{id}/status")]
    [Authorize(Roles = "Admin,Manager,Staff")]
    public async Task<IActionResult> UpdateStatus(Guid id, [FromBody] UpdateParkingSlotStatusRequest request)
    {
        var slot = await _slotService.UpdateStatusAsync(id, request);
        return slot == null ? NotFound() : Ok(slot);
    }

    [HttpDelete("{id}")]
    [Authorize(Roles = "Admin,Manager")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var result = await _slotService.DeleteAsync(id);
        return result ? NoContent() : NotFound();
    }
}
