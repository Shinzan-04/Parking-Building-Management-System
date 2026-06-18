namespace ParkingSystem.Application.Interfaces.Lpr;

public interface IMultiFrameVotingService
{
    /// <summary>
    /// Lưu lại các kết quả biển số (Raw Text) của cùng một xe (TrackId)
    /// </summary>
    void AddFrameResult(string trackId, string rawPlate);

    /// <summary>
    /// Thực hiện Majority Voting ở mức độ Ký tự (Character-level Voting)
    /// </summary>
    string GetVotedPlate(string trackId);
    
    /// <summary>
    /// Xóa dữ liệu sau khi hoàn tất
    /// </summary>
    void ClearTrack(string trackId);
}
