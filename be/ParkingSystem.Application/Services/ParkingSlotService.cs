using ParkingSystem.Application.DTOs.ParkingSlot;
using ParkingSystem.Application.Interfaces;
using ParkingSystem.Domain.Entities;
using ParkingSystem.Domain.Enums;
using ParkingSystem.Domain.Interfaces;

namespace ParkingSystem.Application.Services;

public class ParkingSlotService : IParkingSlotService
{
    private readonly IGenericRepository<ParkingSlot> _repository;

    public ParkingSlotService(IGenericRepository<ParkingSlot> repository)
    {
        _repository = repository;
    }

    public async Task<IEnumerable<ParkingSlotResponse>> GetAllAsync()
    {
        var slots = await _repository.GetAllAsync();
        return slots.Select(s => MapToResponse(s));
    }

    public async Task<IEnumerable<ParkingSlotResponse>> GetByFloorIdAsync(Guid floorId)
    {
        var slots = await _repository.FindAsync(s => s.FloorId == floorId);
        return slots.Select(s => MapToResponse(s));
    }

    public async Task<IEnumerable<ParkingSlotResponse>> GetAvailableByVehicleTypeAsync(Guid vehicleTypeId)
    {
        var slots = await _repository.FindAsync(s => s.VehicleTypeId == vehicleTypeId && s.Status == SlotStatus.Available);
        return slots.Select(s => MapToResponse(s));
    }

    public async Task<ParkingSlotResponse?> GetByIdAsync(Guid id)
    {
        var slot = await _repository.GetByIdAsync(id);
        return slot == null ? null : MapToResponse(slot);
    }

    public async Task<ParkingSlotResponse> CreateAsync(CreateParkingSlotRequest request)
    {
        var slot = new ParkingSlot
        {
            Id = Guid.NewGuid(),
            FloorId = request.FloorId,
            VehicleTypeId = request.VehicleTypeId,
            SlotNumber = request.SlotNumber,
            Status = SlotStatus.Available
        };

        await _repository.AddAsync(slot);
        return MapToResponse(slot);
    }

    public async Task<ParkingSlotResponse?> UpdateStatusAsync(Guid id, UpdateParkingSlotStatusRequest request)
    {
        var slot = await _repository.GetByIdAsync(id);
        if (slot == null) return null;

        slot.Status = request.Status;
        slot.UpdatedAt = DateTime.UtcNow;

        await _repository.UpdateAsync(slot);
        return MapToResponse(slot);
    }

    public async Task<bool> DeleteAsync(Guid id)
    {
        var slot = await _repository.GetByIdAsync(id);
        if (slot == null) return false;

        await _repository.DeleteAsync(slot);
        return true;
    }

    private static ParkingSlotResponse MapToResponse(ParkingSlot s) => new()
    {
        Id = s.Id,
        FloorId = s.FloorId,
        FloorName = s.Floor?.Name ?? string.Empty,
        VehicleTypeId = s.VehicleTypeId,
        VehicleTypeName = s.VehicleType?.Name ?? string.Empty,
        SlotNumber = s.SlotNumber,
        Status = s.Status,
        Row = s.Row,
        Column = s.Column,
        DistanceToEntry = s.DistanceToEntry,
        CreatedAt = s.CreatedAt
    };
}
