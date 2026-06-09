using ParkingSystem.Domain.Enums;

namespace ParkingSystem.Application.DTOs.Reservation;

public class CreateReservationRequest
{
    public Guid ParkingSlotId { get; set; }
    public Guid VehicleTypeId { get; set; }
    public string LicensePlate { get; set; } = string.Empty;
    public DateTime StartTime { get; set; }
    public DateTime EndTime { get; set; }
}

public class ReservationResponse
{
    public Guid Id { get; set; }
    public Guid DriverId { get; set; }
    public Guid ParkingSlotId { get; set; }
    public string SlotNumber { get; set; } = string.Empty;
    public string BookingCode { get; set; } = string.Empty;
    public string QrCodeBase64 { get; set; } = string.Empty;
    public string LicensePlate { get; set; } = string.Empty;
    public DateTime StartTime { get; set; }
    public DateTime EndTime { get; set; }
    public ReservationStatus Status { get; set; }
    public string? RejectReason { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class ReviewReservationRequest
{
    public bool IsAccepted { get; set; }
    public string? Reason { get; set; }
}
