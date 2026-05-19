using ParkingSystem.Domain.Enums;

namespace ParkingSystem.Domain.Entities;

public class ParkingSlot : BaseEntity
{
    public Guid FloorId { get; set; }
    public Guid VehicleTypeId { get; set; }
    public string SlotNumber { get; set; } = string.Empty;
    public SlotStatus Status { get; set; } = SlotStatus.Available;

    // Vị trí vật lý trong bãi (dùng cho thuật toán gợi ý thông minh)
    public int Row { get; set; }        // Hàng (1 = hàng trong cùng, tăng dần ra ngoài)
    public int Column { get; set; }     // Cột (vị trí trái/phải)
    public int DistanceToEntry { get; set; } // Khoảng cách tới lối vào (càng nhỏ càng tiện)

    public Floor Floor { get; set; } = null!;
    public VehicleType VehicleType { get; set; } = null!;
    public ICollection<ParkingSession> ParkingSessions { get; set; } = new List<ParkingSession>();
    public ICollection<Reservation> Reservations { get; set; } = new List<Reservation>();
}
