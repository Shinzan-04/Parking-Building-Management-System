using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ParkingSystem.Application.DTOs.User;
using ParkingSystem.Application.Interfaces;

namespace ParkingSystem.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize(Roles = "Admin,Manager")]
public class UsersController : ControllerBase
{
    private readonly IUserService _userService;

    public UsersController(IUserService userService)
    {
        _userService = userService;
    }

    // Admin: all users. Manager: only Staff (role=2)
    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var users = await _userService.GetAllAsync();
        if (User.IsInRole("Manager"))
            users = users.Where(u => u.Role == Domain.Enums.Role.Staff);
        return Ok(users);
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetById(Guid id)
    {
        var user = await _userService.GetByIdAsync(id);
        if (user == null) return NotFound();
        if (User.IsInRole("Manager") && user.Role != Domain.Enums.Role.Staff)
            return Forbid();
        return Ok(user);
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateUserRequest request)
    {
        // Manager can only create Staff accounts
        if (User.IsInRole("Manager") && request.Role != Domain.Enums.Role.Staff)
            return BadRequest(new { message = "Manager chỉ được tạo tài khoản Staff." });
        var user = await _userService.CreateAsync(request);
        return CreatedAtAction(nameof(GetById), new { id = user.Id }, user);
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateUserRequest request)
    {
        var existing = await _userService.GetByIdAsync(id);
        if (existing == null) return NotFound();
        if (User.IsInRole("Manager") && existing.Role != Domain.Enums.Role.Staff)
            return Forbid();
        var user = await _userService.UpdateAsync(id, request);
        return user == null ? NotFound() : Ok(user);
    }

    [HttpDelete("{id}")]
    [Authorize(Roles = "Admin,Manager")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var existing = await _userService.GetByIdAsync(id);
        if (existing == null) return NotFound();
        if (User.IsInRole("Manager") && existing.Role != Domain.Enums.Role.Staff)
            return Forbid();
        var result = await _userService.DeleteAsync(id);
        return result ? NoContent() : NotFound();
    }

    [HttpPatch("{id}/role")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> AssignRole(Guid id, [FromBody] AssignRoleRequest request)
    {
        var result = await _userService.AssignRoleAsync(id, request);
        if (!result) return NotFound(new { message = "User not found." });
        return Ok(new { message = $"Cấp quyền {request.Role} thành công." });
    }

    [HttpPatch("{id}/unlock")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Unlock(Guid id)
    {
        var result = await _userService.UnlockAsync(id);
        if (!result) return NotFound(new { message = "User not found." });
        return Ok(new { message = "Tài khoản đã được mở khóa." });
    }
}
