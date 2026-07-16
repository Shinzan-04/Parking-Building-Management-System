using ParkingSystem.Application.DTOs.User;

namespace ParkingSystem.Application.Interfaces;

public interface IUserService
{
    Task<IEnumerable<UserResponse>> GetAllAsync();
    Task<UserResponse?> GetByIdAsync(Guid id);
    Task<UserResponse> CreateAsync(CreateUserRequest request);
    Task<UserResponse?> UpdateAsync(Guid id, UpdateUserRequest request);
    Task<bool> DeleteAsync(Guid id);
    Task<bool> AssignRoleAsync(Guid id, AssignRoleRequest request);
    Task<IEnumerable<UserResponse>> GetStaffByBuildingAsync(Guid buildingId);
    Task<bool> AssignStaffToBuildingAsync(Guid staffId, Guid buildingId);
    Task<bool> UnassignStaffFromBuildingAsync(Guid staffId);
    Task<bool> UnlockAsync(Guid id);
}
