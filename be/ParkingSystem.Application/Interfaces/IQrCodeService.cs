namespace ParkingSystem.Application.Interfaces;

public interface IQrCodeService
{
    string GenerateUniqueCode(int length = 5);
    string GenerateQrCodeBase64(string content);
}
