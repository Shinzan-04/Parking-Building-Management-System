using ParkingSystem.Application.DTOs.PricingPolicy;

namespace ParkingSystem.Application.Interfaces;

public interface IPricingPolicyService
{
    Task<IEnumerable<PricingPolicyResponse>> GetAllAsync();
    Task<PricingPolicyResponse?> GetByIdAsync(Guid id);
    Task<PricingPolicyResponse?> GetByVehicleTypeIdAsync(Guid vehicleTypeId);
    Task<PricingPolicyResponse> CreateAsync(CreatePricingPolicyRequest request, Guid adminId);
    Task<PricingPolicyResponse?> UpdateAsync(Guid id, UpdatePricingPolicyRequest request, Guid adminId);
    Task<bool> DeleteAsync(Guid id, Guid adminId);
}
