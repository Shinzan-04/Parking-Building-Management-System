namespace ParkingSystem.Domain.Enums;

public enum Role { Admin, Manager, Staff, Driver }
public enum SlotStatus { Available, TemporaryHeld, Reserved, Occupied, Maintenance }
public enum SessionStatus { Active, Completed, Overdue }
public enum IssueType { None, LostTicket, WrongPlate, WrongSlot, Unpaid }
public enum ReservationStatus 
{ 
    PaymentPending,  // Mới tạo, chờ thanh toán
    Paid,            // Đã thanh toán thành công
    PendingReview,   // Chờ Staff duyệt (sau khi thanh toán)
    Confirmed,       // Staff đã duyệt, slot = Reserved
    CheckedIn,       // Driver đã check-in
    Completed,       // Check-out xong
    Cancelled,       // Hủy bởi Driver hoặc hệ thống
    Rejected,        // Staff từ chối
    NoShow,          // Driver không đến sau 30 phút
    PaymentFailed    // Thanh toán thất bại
}
public enum PaymentStatus { Pending, Success, Failed, Refunding, Refunded, RefundFailed }
public enum PaymentMethod { Cash, Momo, VNPay, CreditCard, PayOS, Wallet }
public enum CheckInMethod { WalkIn, Booking }
public enum BookingMethod { Manual, AIRecommended }
public enum SubscriptionStatus { PendingPayment, Active, Expired, Canceled }
