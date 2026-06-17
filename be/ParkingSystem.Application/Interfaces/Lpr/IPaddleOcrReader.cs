namespace ParkingSystem.Application.Interfaces.Lpr;

public interface IPaddleOcrReader
{
    Task<(string RawText, float Confidence)> ReadTextAsync(byte[] preprocessedImageBytes);
}
