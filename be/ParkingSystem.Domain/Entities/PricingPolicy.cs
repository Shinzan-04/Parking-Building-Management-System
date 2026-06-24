namespace ParkingSystem.Domain.Entities;

public class PricingPolicy : BaseEntity
{
    public Guid VehicleTypeId { get; set; }
    
    // Giữ lại các cột cũ để không lỗi hàm CheckOut (Parking thường)
    public decimal HourlyRate { get; set; }
    public decimal BlockPrice { get; set; }
    public decimal DailyMaxRate { get; set; }
    
    // Thuật toán Block Ngày/Đêm (Dùng cho Booking)
    public int BlockDurationHours { get; set; } = 4;
    public decimal DayBlockRate { get; set; }
    public decimal NightBlockRate { get; set; }
    public int NightStartHour { get; set; } = 22;
    public int NightEndHour { get; set; } = 6;
    public decimal DailyRate { get; set; }
    public decimal OvertimeMultiplier { get; set; } = 1.5m;

    public VehicleType VehicleType { get; set; } = null!;
}
