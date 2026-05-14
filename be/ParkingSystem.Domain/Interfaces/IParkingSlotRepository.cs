using ParkingSystem.Domain.Entities;
using ParkingSystem.Domain.Enums;

namespace ParkingSystem.Domain.Interfaces;

public interface IParkingSlotRepository
{
    Task<ParkingSlot?> GetByIdAsync(Guid id);
    Task<IEnumerable<ParkingSlot>> GetAvailableSlotsAsync(Guid vehicleTypeId);
    Task UpdateSlotStatusAsync(Guid slotId, SlotStatus status);
    Task<IEnumerable<ParkingSlot>> GetSlotsByFloorAsync(Guid floorId);
    Task AddAsync(ParkingSlot slot);
    Task UpdateAsync(ParkingSlot slot);
}
