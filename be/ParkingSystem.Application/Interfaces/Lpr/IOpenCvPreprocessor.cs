namespace ParkingSystem.Application.Interfaces.Lpr;

public interface IOpenCvPreprocessor
{
    Task<(byte[] preprocessedImage, string croppedBase64)> CropAndPreprocessAsync(string base64Image, DetectionBox box);
}
