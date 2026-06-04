namespace ParkingSystem.Application.DTOs.PriceSetting;

public class CreatePriceSettingRequest
{
    public Guid VehicleTypeId { get; set; }
    public decimal DayPassPrice { get; set; }
    public decimal NightPassPrice { get; set; }
    public decimal DailyMaxPrice { get; set; }
    public int DayStartHour { get; set; } = 6;
    public int NightStartHour { get; set; } = 18;
}

public class UpdatePriceSettingRequest
{
    public decimal DayPassPrice { get; set; }
    public decimal NightPassPrice { get; set; }
    public decimal DailyMaxPrice { get; set; }
    public int DayStartHour { get; set; } = 6;
    public int NightStartHour { get; set; } = 18;
}

public class PriceSettingResponse
{
    public Guid Id { get; set; }
    public Guid VehicleTypeId { get; set; }
    public string VehicleTypeName { get; set; } = string.Empty;
    public decimal DayPassPrice { get; set; }
    public decimal NightPassPrice { get; set; }
    public decimal DailyMaxPrice { get; set; }
    public int DayStartHour { get; set; }
    public int NightStartHour { get; set; }
    public Guid? UpdatedBy { get; set; }
    public string? UpdatedByName { get; set; }
    public DateTime? UpdatedAt { get; set; }
    public DateTime CreatedAt { get; set; }
}
