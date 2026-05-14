using ParkingSystem.Domain.Entities;

namespace ParkingSystem.Domain.Interfaces;

public interface IParkingSessionRepository
{
    Task<ParkingSession?> GetByIdAsync(Guid id);
    Task<ParkingSession> CreateSessionAsync(ParkingSession session);
    Task<ParkingSession?> GetActiveSessionByPlateAsync(string licensePlate);
    Task UpdateSessionAsync(ParkingSession session);
    Task<IEnumerable<ParkingSession>> GetActiveSessionsAsync();
}
