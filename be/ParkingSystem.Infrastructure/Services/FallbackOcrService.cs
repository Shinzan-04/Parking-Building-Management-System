using ParkingSystem.Application.Interfaces;

namespace ParkingSystem.Infrastructure.Services;

/// <summary>
/// Service dự phòng khi chưa có file model ONNX.
/// Trả về thông báo hướng dẫn cách tải model.
/// </summary>
public class FallbackOcrService : ILicensePlateOcrService
{
    public Task<LicensePlateResult> DetectPlateAsync(string imageBase64)
    {
        return Task.FromResult(new LicensePlateResult
        {
            IsDetected = false,
            Message = "Model ONNX chưa được cài đặt. " +
                      "Chạy lệnh: pip install ultralytics && python download_model.py " +
                      "để tải model YOLOv8n vào thư mục Models/"
        });
    }
}
