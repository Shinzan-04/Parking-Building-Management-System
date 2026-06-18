using ParkingSystem.Domain.Enums;

namespace ParkingSystem.Domain.Entities;

public class ReservationLog : BaseEntity
{
    public Guid ReservationId { get; set; }
    
    /// <summary>
    /// Hành động hoặc trạng thái vừa được cập nhật (ví dụ: Create, PaymentSuccess, Approve, CheckedIn, v.v.)
    /// </summary>
    public string Action { get; set; } = string.Empty;
    
    /// <summary>
    /// Trạng thái của Reservation tại thời điểm ghi log
    /// </summary>
    public ReservationStatus StatusSnapshot { get; set; }
    
    /// <summary>
    /// Ghi chú thêm (lý do từ chối, lý do AI, v.v.)
    /// </summary>
    public string? Note { get; set; }

    public Reservation Reservation { get; set; } = null!;
}
