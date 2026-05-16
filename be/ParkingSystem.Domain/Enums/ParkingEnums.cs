namespace ParkingSystem.Domain.Enums;

public enum Role { Admin, Manager, Staff, Driver }
public enum SlotStatus { Available, Occupied, Reserved, Maintenance }
public enum SessionStatus { Active, Completed, Overdue }
public enum IssueType { None, LostTicket, WrongPlate, WrongSlot, Unpaid }
public enum ReservationStatus { Pending, Confirmed, CheckedIn, Cancelled, Completed }
public enum PaymentStatus { Pending, Success, Failed }
public enum PaymentMethod { Cash, Momo, VNPay, CreditCard }
public enum CheckInMethod { WalkIn, Booking }
