namespace ParkingSystem.Application.Interfaces;

public interface ILicensePlateOcrService
{
    /// <summary>
    /// Nhận diện biển số xe từ ảnh Base64
    /// </summary>
    /// <param name="imageBase64">Ảnh chụp từ camera dạng Base64</param>
    /// <returns>Biển số xe dạng text và độ tin cậy</returns>
    Task<LicensePlateResult> DetectPlateAsync(string imageBase64);
}

public class LicensePlateResult
{
    public string LicensePlate { get; set; } = string.Empty;
    public float Confidence { get; set; }
    public bool IsDetected { get; set; }
    public string? CroppedPlateBase64 { get; set; }
    public string Message { get; set; } = string.Empty;
}
