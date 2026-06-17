namespace ParkingSystem.Application.Interfaces.Lpr;

public interface ILicensePlateRecognizer
{
    /// <summary>
    /// Xử lý nhận diện 1 Frame độc lập (Flow truyền thống hoặc Flow cuối cùng sau khi voting)
    /// </summary>
    Task<LprResult> RecognizeFrameAsync(string base64Image, string? trackId = null);

    /// <summary>
    /// Nhận một batch ảnh (nhiều frames) để thực hiện Voting nội bộ
    /// Phù hợp với API thiết kế nhận list các Base64 Images của 1 xe
    /// </summary>
    Task<LprResult> RecognizeBatchAsync(List<string> base64Images);
}
