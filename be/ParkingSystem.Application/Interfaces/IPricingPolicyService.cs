using ParkingSystem.Application.DTOs.PricingPolicy;

namespace ParkingSystem.Application.Interfaces;

public interface IPricingPolicyService
{
    Task<IEnumerable<PricingPolicyResponse>> GetAllAsync();
    Task<PricingPolicyResponse?> GetByIdAsync(Guid id);
    Task<PricingPolicyResponse?> GetByVehicleTypeIdAsync(Guid vehicleTypeId);
    Task<PricingPolicyResponse> CreateAsync(CreatePricingPolicyRequest request);
    Task<PricingPolicyResponse?> UpdateAsync(Guid id, UpdatePricingPolicyRequest request);
    Task<bool> DeleteAsync(Guid id);
}
