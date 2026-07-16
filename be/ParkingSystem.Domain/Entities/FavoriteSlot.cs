namespace ParkingSystem.Domain.Entities;

/// <summary>
/// Lưu thói quen đỗ xe của Driver — AI dùng để ưu tiên slot yêu thích
/// </summary>
public class FavoriteSlot : BaseEntity
{
    public Guid DriverId { get; set; }
    public Guid ParkingSlotId { get; set; }

    /// <summary>
    /// Số lần Driver đã đỗ tại slot này
    /// </summary>
    public int UsageCount { get; set; } = 0;

    /// <summary>
    /// Lần cuối Driver đỗ tại slot này
    /// </summary>
    public DateTime LastUsedAt { get; set; }

    public User Driver { get; set; } = null!;
    public ParkingSlot ParkingSlot { get; set; } = null!;
}
