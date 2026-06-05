namespace ParkingSystem.Domain.Entities;

public class PriceSetting : BaseEntity
{
    public Guid VehicleTypeId { get; set; }
    public decimal DayPassPrice { get; set; }
    public decimal NightPassPrice { get; set; }
    public decimal DailyMaxPrice { get; set; }
    public int DayStartHour { get; set; } = 6;
    public int NightStartHour { get; set; } = 18;
    public Guid? UpdatedBy { get; set; }
    public new DateTime? UpdatedAt { get; set; }

    public VehicleType VehicleType { get; set; } = null!;
    public User? UpdatedByUser { get; set; }
}
