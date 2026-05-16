using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ParkingSystem.Application.DTOs.Floor;
using ParkingSystem.Application.Interfaces;

namespace ParkingSystem.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class FloorsController : ControllerBase
{
    private readonly IFloorService _floorService;

    public FloorsController(IFloorService floorService)
    {
        _floorService = floorService;
    }

    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var floors = await _floorService.GetAllAsync();
        return Ok(floors);
    }

    [HttpGet("building/{buildingId}")]
    public async Task<IActionResult> GetByBuildingId(Guid buildingId)
    {
        var floors = await _floorService.GetByBuildingIdAsync(buildingId);
        return Ok(floors);
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetById(Guid id)
    {
        var floor = await _floorService.GetByIdAsync(id);
        return floor == null ? NotFound() : Ok(floor);
    }

    [HttpPost]
    [Authorize(Roles = "Admin,Manager")]
    public async Task<IActionResult> Create([FromBody] CreateFloorRequest request)
    {
        var floor = await _floorService.CreateAsync(request);
        return CreatedAtAction(nameof(GetById), new { id = floor.Id }, floor);
    }

    [HttpPut("{id}")]
    [Authorize(Roles = "Admin,Manager")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateFloorRequest request)
    {
        var floor = await _floorService.UpdateAsync(id, request);
        return floor == null ? NotFound() : Ok(floor);
    }

    [HttpDelete("{id}")]
    [Authorize(Roles = "Admin,Manager")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var result = await _floorService.DeleteAsync(id);
        return result ? NoContent() : NotFound();
    }
}
