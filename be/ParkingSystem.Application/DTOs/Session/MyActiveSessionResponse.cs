using ParkingSystem.Application.DTOs.CheckOut;

namespace ParkingSystem.Application.DTOs.Session;

public class MyActiveSessionResponse
{
    public Guid Id { get; set; }
    public string SessionCode { get; set; } = string.Empty;
    public string SessionQrCodeBase64 { get; set; } = string.Empty;
    public string LicensePlate { get; set; } = string.Empty;
    public string VehicleTypeName { get; set; } = string.Empty;
    public DateTime EntryTime { get; set; }
    public string BuildingName { get; set; } = string.Empty;
    public string FloorName { get; set; } = string.Empty;
    public string SlotNumber { get; set; } = string.Empty;
    public decimal PricePerHour { get; set; }
    public decimal CurrentFee { get; set; }
    public decimal PrePaidAmount { get; set; }
    public bool IsPrepaid { get; set; }
    public DateTime? PrepaidStartTime { get; set; }
    public DateTime? PrepaidEndTime { get; set; }
    public List<SurchargeLogItemDto>? SurchargeLogs { get; set; }
}
