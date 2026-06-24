namespace ParkingSystem.Application.DTOs.PricingPolicy;

public class CreatePricingPolicyRequest
{
    public Guid VehicleTypeId { get; set; }
    
    // Cũ
    public decimal HourlyRate { get; set; }
    public decimal BlockPrice { get; set; }
    public decimal DailyMaxRate { get; set; }

    // Mới
    public int BlockDurationHours { get; set; } = 4;
    public decimal DayBlockRate { get; set; }
    public decimal NightBlockRate { get; set; }
    public int NightStartHour { get; set; } = 22;
    public int NightEndHour { get; set; } = 6;
    public decimal DailyRate { get; set; }
    public decimal OvertimeMultiplier { get; set; } = 1.5m;
}

public class UpdatePricingPolicyRequest
{
    // Cũ
    public decimal HourlyRate { get; set; }
    public decimal BlockPrice { get; set; }
    public decimal DailyMaxRate { get; set; }

    // Mới
    public int BlockDurationHours { get; set; } = 4;
    public decimal DayBlockRate { get; set; }
    public decimal NightBlockRate { get; set; }
    public int NightStartHour { get; set; } = 22;
    public int NightEndHour { get; set; } = 6;
    public decimal DailyRate { get; set; }
    public decimal OvertimeMultiplier { get; set; } = 1.5m;
}

public class PricingPolicyResponse
{
    public Guid Id { get; set; }
    public Guid VehicleTypeId { get; set; }
    public string VehicleTypeName { get; set; } = string.Empty;

    // Cũ
    public decimal HourlyRate { get; set; }
    public decimal BlockPrice { get; set; }
    public decimal DailyMaxRate { get; set; }

    // Mới
    public int BlockDurationHours { get; set; }
    public decimal DayBlockRate { get; set; }
    public decimal NightBlockRate { get; set; }
    public int NightStartHour { get; set; }
    public int NightEndHour { get; set; }
    public decimal DailyRate { get; set; }
    public decimal OvertimeMultiplier { get; set; }
    public DateTime CreatedAt { get; set; }
}
