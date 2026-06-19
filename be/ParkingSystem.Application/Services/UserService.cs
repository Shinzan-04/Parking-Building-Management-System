using ParkingSystem.Application.DTOs.User;
using ParkingSystem.Application.Interfaces;
using ParkingSystem.Domain.Entities;
using ParkingSystem.Domain.Interfaces;

namespace ParkingSystem.Application.Services;

public class UserService : IUserService
{
    private readonly IGenericRepository<User> _repository;
    private readonly IQrCodeService _qrCodeService;

    public UserService(IGenericRepository<User> repository, IQrCodeService qrCodeService)
    {
        _repository = repository;
        _qrCodeService = qrCodeService;
    }

    public async Task<IEnumerable<UserResponse>> GetAllAsync()
    {
        var users = await _repository.GetAllAsync();
        return users.Select(u => MapToResponse(u));
    }

    public async Task<UserResponse?> GetByIdAsync(Guid id)
    {
        var user = await _repository.GetByIdAsync(id);
        return user == null ? null : MapToResponse(user);
    }

    public async Task<UserResponse> CreateAsync(CreateUserRequest request)
    {
        var driverCode = "DRV-" + _qrCodeService.GenerateUniqueCode(5);
        var user = new User
        {
            Id = Guid.NewGuid(),
            Username = request.Username,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password),
            FullName = request.FullName,
            Role = request.Role,
            PhoneNumber = request.PhoneNumber,
            Email = request.Email,
            DriverCode = driverCode
        };

        await _repository.AddAsync(user);
        return MapToResponse(user);
    }

    public async Task<UserResponse?> UpdateAsync(Guid id, UpdateUserRequest request)
    {
        var user = await _repository.GetByIdAsync(id);
        if (user == null) return null;

        user.FullName = request.FullName;
        user.Role = request.Role;
        user.PhoneNumber = request.PhoneNumber;
        user.Email = request.Email;
        user.UpdatedAt = DateTime.UtcNow;

        await _repository.UpdateAsync(user);
        return MapToResponse(user);
    }

    public async Task<bool> DeleteAsync(Guid id)
    {
        var user = await _repository.GetByIdAsync(id);
        if (user == null) return false;

        await _repository.DeleteAsync(user);
        return true;
    }

    public async Task<bool> AssignRoleAsync(Guid id, AssignRoleRequest request)
    {
        var user = await _repository.GetByIdAsync(id);
        if (user == null) return false;

        user.Role = request.Role;
        user.UpdatedAt = DateTime.UtcNow;

        await _repository.UpdateAsync(user);
        return true;
    }

    public async Task<IEnumerable<UserResponse>> GetStaffByBuildingAsync(Guid buildingId)
    {
        var users = await _repository.FindAsync(u => u.AssignedBuildingId == buildingId && u.Role == Domain.Enums.Role.Staff);
        return users.Select(u => MapToResponse(u));
    }

    public async Task<bool> AssignStaffToBuildingAsync(Guid staffId, Guid buildingId)
    {
        var user = await _repository.GetByIdAsync(staffId);
        if (user == null || user.Role != Domain.Enums.Role.Staff) return false;

        user.AssignedBuildingId = buildingId;
        user.UpdatedAt = DateTime.UtcNow;

        await _repository.UpdateAsync(user);
        return true;
    }

    public async Task<bool> UnassignStaffFromBuildingAsync(Guid staffId)
    {
        var user = await _repository.GetByIdAsync(staffId);
        if (user == null) return false;

        user.AssignedBuildingId = null;
        user.UpdatedAt = DateTime.UtcNow;

        await _repository.UpdateAsync(user);
        return true;
    }

    private static UserResponse MapToResponse(User u) => new()
    {
        Id = u.Id,
        Username = u.Username,
        FullName = u.FullName,
        Role = u.Role,
        PhoneNumber = u.PhoneNumber,
        Email = u.Email,
        QrCode = u.DriverCode,
        CreatedAt = u.CreatedAt,
        AssignedBuildingId = u.AssignedBuildingId
    };
}
