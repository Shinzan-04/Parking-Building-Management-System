using ParkingSystem.Application.DTOs.Reservation;

namespace ParkingSystem.Application.Interfaces;

public interface IReservationService
{
    Task<ReservationResponse> CreateReservationAsync(Guid driverId, CreateReservationRequest request);
    Task<IEnumerable<ReservationResponse>> GetMyReservationsAsync(Guid driverId);
    Task<bool> CancelReservationAsync(Guid reservationId, Guid driverId);
    
    // Payment callbacks
    Task<bool> ConfirmPaymentAsync(Guid reservationId);
    Task<bool> FailPaymentAsync(Guid reservationId);
    
    // For Staff
    Task<IEnumerable<ReservationResponse>> GetPendingReservationsAsync(Guid staffId, Guid? buildingId = null);
    Task<IEnumerable<ReservationResponse>> GetAllActiveReservationsAsync(Guid staffId, Guid? buildingId = null);
    Task<bool> ReviewReservationAsync(Guid reservationId, Guid staffId, ReviewReservationRequest request);
    Task<bool> ReassignSlotAsync(Guid reservationId, Guid newSlotId, Guid staffId);
    
    Task<decimal> EstimateFeeAsync(Guid vehicleTypeId, DateTime startTime, DateTime endTime);
}
