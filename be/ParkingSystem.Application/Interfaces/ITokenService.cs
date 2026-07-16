using ParkingSystem.Domain.Entities;

namespace ParkingSystem.Application.Interfaces;

public interface ITokenService
{
    string GenerateToken(User user);
    string GenerateDriverQrToken(Guid driverId, string driverCode);

    /// <summary>
    /// Parse JWT từ QR Driver → trả về (DriverId, DriverCode).
    /// Trả null nếu token không hợp lệ hoặc type != "driver".
    /// </summary>
    (Guid DriverId, string DriverCode)? ParseDriverQrToken(string token);
}
