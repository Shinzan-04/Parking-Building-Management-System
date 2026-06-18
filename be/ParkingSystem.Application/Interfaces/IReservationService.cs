using ParkingSystem.Application.DTOs.Reservation;

namespace ParkingSystem.Application.Interfaces;

public interface IReservationService
{
    Task<ReservationResponse> CreateReservationAsync(Guid driverId, CreateReservationRequest request);
    Task<IEnumerable<ReservationResponse>> GetMyReservationsAsync(Guid driverId);
    Task<bool> CancelReservationAsync(Guid reservationId, Guid driverId);
    
    // For Staff
    Task<IEnumerable<ReservationResponse>> GetPendingReservationsAsync(Guid staffId);
    Task<bool> ReviewReservationAsync(Guid reservationId, Guid staffId, ReviewReservationRequest request);
}
