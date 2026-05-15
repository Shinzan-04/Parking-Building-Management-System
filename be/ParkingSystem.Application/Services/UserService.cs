using ParkingSystem.Application.DTOs.User;
using ParkingSystem.Application.Interfaces;
using ParkingSystem.Domain.Entities;
using ParkingSystem.Domain.Interfaces;

namespace ParkingSystem.Application.Services;

public class UserService : IUserService
{
    private readonly IGenericRepository<User> _repository;

    public UserService(IGenericRepository<User> repository)
    {
        _repository = repository;
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
        var user = new User
        {
            Id = Guid.NewGuid(),
            Username = request.Username,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password),
            FullName = request.FullName,
            Role = request.Role,
            PhoneNumber = request.PhoneNumber,
            Email = request.Email
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

    private static UserResponse MapToResponse(User u) => new()
    {
        Id = u.Id,
        Username = u.Username,
        FullName = u.FullName,
        Role = u.Role,
        PhoneNumber = u.PhoneNumber,
        Email = u.Email,
        CreatedAt = u.CreatedAt
    };
}
