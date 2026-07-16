using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ParkingSystem.Application.DTOs.MonthlyPass;
using ParkingSystem.Application.Interfaces;

namespace ParkingSystem.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class MonthlyPassPoliciesController : ControllerBase
{
    private readonly ISubscriptionService _subscriptionService;

    public MonthlyPassPoliciesController(ISubscriptionService subscriptionService)
    {
        _subscriptionService = subscriptionService;
    }

    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var policies = await _subscriptionService.GetAllPoliciesAsync();
        return Ok(policies);
    }

    [HttpGet("vehicle-type/{vehicleTypeId}")]
    public async Task<IActionResult> GetByVehicleType(Guid vehicleTypeId)
    {
        var policy = await _subscriptionService.GetPolicyByVehicleTypeIdAsync(vehicleTypeId);
        return policy == null ? NotFound() : Ok(policy);
    }

    [HttpPost]
    [Authorize(Roles = "Admin,Manager")]
    public async Task<IActionResult> Create([FromBody] CreateMonthlyPassPolicyRequest request)
    {
        var adminId = Guid.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? Guid.Empty.ToString());
        var policy = await _subscriptionService.CreatePolicyAsync(request, adminId);
        return Ok(policy);
    }

    [HttpPut("{id}")]
    [Authorize(Roles = "Admin,Manager")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateMonthlyPassPolicyRequest request)
    {
        var adminId = Guid.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? Guid.Empty.ToString());
        var policy = await _subscriptionService.UpdatePolicyAsync(id, request, adminId);
        return policy == null ? NotFound() : Ok(policy);
    }

    [HttpDelete("{id}")]
    [Authorize(Roles = "Admin,Manager")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var adminId = Guid.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? Guid.Empty.ToString());
        var result = await _subscriptionService.DeletePolicyAsync(id, adminId);
        return result ? NoContent() : NotFound();
    }
}
