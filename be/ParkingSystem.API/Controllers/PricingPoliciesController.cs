using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ParkingSystem.Application.DTOs.PricingPolicy;
using ParkingSystem.Application.Interfaces;

namespace ParkingSystem.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class PricingPoliciesController : ControllerBase
{
    private readonly IPricingPolicyService _pricingService;

    public PricingPoliciesController(IPricingPolicyService pricingService)
    {
        _pricingService = pricingService;
    }

    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var policies = await _pricingService.GetAllAsync();
        return Ok(policies);
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetById(Guid id)
    {
        var policy = await _pricingService.GetByIdAsync(id);
        return policy == null ? NotFound() : Ok(policy);
    }

    [HttpGet("vehicle-type/{vehicleTypeId}")]
    public async Task<IActionResult> GetByVehicleType(Guid vehicleTypeId)
    {
        var policy = await _pricingService.GetByVehicleTypeIdAsync(vehicleTypeId);
        return policy == null ? NotFound() : Ok(policy);
    }

    [HttpPost]
    [Authorize(Roles = "Admin,Manager")]
    public async Task<IActionResult> Create([FromBody] CreatePricingPolicyRequest request)
    {
        var policy = await _pricingService.CreateAsync(request);
        return CreatedAtAction(nameof(GetById), new { id = policy.Id }, policy);
    }

    [HttpPut("{id}")]
    [Authorize(Roles = "Admin,Manager")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdatePricingPolicyRequest request)
    {
        var policy = await _pricingService.UpdateAsync(id, request);
        return policy == null ? NotFound() : Ok(policy);
    }

    [HttpDelete("{id}")]
    [Authorize(Roles = "Admin,Manager")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var result = await _pricingService.DeleteAsync(id);
        return result ? NoContent() : NotFound();
    }
}
