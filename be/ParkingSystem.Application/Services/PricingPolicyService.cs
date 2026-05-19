using ParkingSystem.Application.DTOs.PricingPolicy;
using ParkingSystem.Application.Interfaces;
using ParkingSystem.Domain.Entities;
using ParkingSystem.Domain.Interfaces;

namespace ParkingSystem.Application.Services;

public class PricingPolicyService : IPricingPolicyService
{
    private readonly IGenericRepository<PricingPolicy> _repository;

    public PricingPolicyService(IGenericRepository<PricingPolicy> repository)
    {
        _repository = repository;
    }

    public async Task<IEnumerable<PricingPolicyResponse>> GetAllAsync()
    {
        var policies = await _repository.GetAllAsync();
        return policies.Select(p => MapToResponse(p));
    }

    public async Task<PricingPolicyResponse?> GetByIdAsync(Guid id)
    {
        var policy = await _repository.GetByIdAsync(id);
        return policy == null ? null : MapToResponse(policy);
    }

    public async Task<PricingPolicyResponse?> GetByVehicleTypeIdAsync(Guid vehicleTypeId)
    {
        var policies = await _repository.FindAsync(p => p.VehicleTypeId == vehicleTypeId);
        var policy = policies.FirstOrDefault();
        return policy == null ? null : MapToResponse(policy);
    }

    public async Task<PricingPolicyResponse> CreateAsync(CreatePricingPolicyRequest request)
    {
        var policy = new PricingPolicy
        {
            Id = Guid.NewGuid(),
            VehicleTypeId = request.VehicleTypeId,
            BlockPrice = request.BlockPrice,
            BlockMinutes = request.BlockMinutes,
            HourlyRate = request.HourlyRate,
            DailyMaxRate = request.DailyMaxRate
        };

        await _repository.AddAsync(policy);
        return MapToResponse(policy);
    }

    public async Task<PricingPolicyResponse?> UpdateAsync(Guid id, UpdatePricingPolicyRequest request)
    {
        var policy = await _repository.GetByIdAsync(id);
        if (policy == null) return null;

        policy.BlockPrice = request.BlockPrice;
        policy.BlockMinutes = request.BlockMinutes;
        policy.HourlyRate = request.HourlyRate;
        policy.DailyMaxRate = request.DailyMaxRate;
        policy.UpdatedAt = DateTime.UtcNow;

        await _repository.UpdateAsync(policy);
        return MapToResponse(policy);
    }

    public async Task<bool> DeleteAsync(Guid id)
    {
        var policy = await _repository.GetByIdAsync(id);
        if (policy == null) return false;

        await _repository.DeleteAsync(policy);
        return true;
    }

    private static PricingPolicyResponse MapToResponse(PricingPolicy p) => new()
    {
        Id = p.Id,
        VehicleTypeId = p.VehicleTypeId,
        VehicleTypeName = p.VehicleType?.Name ?? string.Empty,
        BlockPrice = p.BlockPrice,
        BlockMinutes = p.BlockMinutes,
        HourlyRate = p.HourlyRate,
        DailyMaxRate = p.DailyMaxRate,
        CreatedAt = p.CreatedAt
    };
}
