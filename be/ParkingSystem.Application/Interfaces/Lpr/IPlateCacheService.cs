namespace ParkingSystem.Application.Interfaces.Lpr;

public interface IPlateCacheService
{
    /// <summary>
    /// Lưu kết quả OCR theo CameraId (hoặc TrackId) trong 1 khoảng thời gian ngắn (ví dụ: 5s)
    /// Tránh xử lý lặp lại với cùng 1 xe đứng trước cổng
    /// </summary>
    void SetCachedPlate(string key, LprResult result, TimeSpan expiration);

    /// <summary>
    /// Lấy kết quả từ Cache nếu còn hiệu lực
    /// </summary>
    LprResult? GetCachedPlate(string key);
}
