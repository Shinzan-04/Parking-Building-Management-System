using QRCoder;
using ParkingSystem.Application.Interfaces;

namespace ParkingSystem.Application.Services;

public class QrCodeService : IQrCodeService
{
    private static readonly Random _random = new();
    private const string Chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

    public string GenerateUniqueCode(int length = 5)
    {
        return new string(Enumerable.Range(0, length)
            .Select(_ => Chars[_random.Next(Chars.Length)])
            .ToArray());
    }

    public string GenerateQrCodeBase64(string content)
    {
        using var qrGenerator = new QRCodeGenerator();
        using var qrCodeData = qrGenerator.CreateQrCode(content, QRCodeGenerator.ECCLevel.Q);
        using var qrCode = new PngByteQRCode(qrCodeData);
        var qrCodeBytes = qrCode.GetGraphic(10);
        return Convert.ToBase64String(qrCodeBytes);
    }
}
