namespace ParkingSystem.Application.Interfaces.Lpr;

public interface IYoloDetector
{
    Task<DetectionBox?> DetectBestPlateAsync(string base64Image);
}
