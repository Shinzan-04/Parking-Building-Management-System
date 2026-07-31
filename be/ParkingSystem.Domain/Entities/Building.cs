namespace ParkingSystem.Domain.Entities;

public class Building : BaseEntity
{
    public string Name { get; set; } = string.Empty;
    public string Address { get; set; } = string.Empty;
    public int TotalCapacity { get; set; }
    
    public double? Latitude { get; set; }
    public double? Longitude { get; set; }

    public ICollection<Floor> Floors { get; set; } = new List<Floor>();
    public ICollection<User> AssignedStaffs { get; set; } = new List<User>();

    /// <summary>
    /// Chế độ duyệt đơn đặt chỗ cho tòa nhà này
    /// </summary>
    public ParkingSystem.Domain.Enums.ReservationApprovalMode ApprovalMode { get; set; } = ParkingSystem.Domain.Enums.ReservationApprovalMode.Manual;
}
