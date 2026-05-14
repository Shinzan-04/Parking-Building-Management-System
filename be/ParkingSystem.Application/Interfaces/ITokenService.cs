using ParkingSystem.Domain.Entities;

namespace ParkingSystem.Application.Interfaces;

public interface ITokenService
{
    string GenerateToken(User user);
}
