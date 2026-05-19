using ParkingSystem.Domain.Entities;

namespace ParkingSystem.Application.Interfaces;

public interface ISlotAssignmentService
{
    /// <summary>
    /// Gợi ý danh sách slot phù hợp nhất cho loại xe (sắp xếp theo AI scoring)
    /// Thuật toán ưu tiên: Trong ra ngoài → Gần lối vào → Tầng thấp → Gom cụm xe cùng loại
    /// </summary>
    Task<List<SlotRecommendation>> GetRecommendedSlotsAsync(Guid vehicleTypeId, int topN = 5);

    /// <summary>
    /// Tự động chọn slot tốt nhất (slot đầu tiên trong danh sách gợi ý)
    /// </summary>
    Task<SlotRecommendation?> GetBestSlotAsync(Guid vehicleTypeId);
}

/// <summary>
/// Kết quả gợi ý vị trí đỗ xe kèm điểm đánh giá (score)
/// </summary>
public class SlotRecommendation
{
    public Guid SlotId { get; set; }
    public string SlotNumber { get; set; } = string.Empty;
    public string FloorName { get; set; } = string.Empty;
    public int FloorIndex { get; set; }
    public int Row { get; set; }
    public int Column { get; set; }
    public int DistanceToEntry { get; set; }

    /// <summary>
    /// Điểm đánh giá: càng cao càng tốt (thuật toán AI scoring)
    /// </summary>
    public double Score { get; set; }

    /// <summary>
    /// Lý do gợi ý slot này (giải thích cho Staff)
    /// </summary>
    public string Reason { get; set; } = string.Empty;
}
