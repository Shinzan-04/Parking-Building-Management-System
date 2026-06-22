namespace ParkingSystem.Application.DTOs.Payment;

public class PaymentListItemDto
{
    public Guid PaymentId { get; set; }
    public long PayOSOrderCode { get; set; }
    public decimal Amount { get; set; }
    public string? Description { get; set; }
    public string Status { get; set; } = string.Empty;
    public string PaymentMethod { get; set; } = string.Empty;
    public DateTime PaymentDate { get; set; }

    // Liên kết
    public Guid? ReservationId { get; set; }
    public Guid? ParkingSessionId { get; set; }
    public Guid? UserId { get; set; }
    public string? UserFullName { get; set; }
    public string? UserEmail { get; set; }

    // Refund info
    public DateTime? RefundedAt { get; set; }
    public string? RefundReferenceId { get; set; }
    public string? RefundProvider { get; set; }
    public string? RefundTransactionId { get; set; }
    public string? RefundFailureReason { get; set; }
}

public class PaymentListQuery
{
    public string? Status { get; set; }       // filter: Pending, Success, Refunding, Refunded, RefundFailed
    public int Page { get; set; } = 1;
    public int PageSize { get; set; } = 20;
}

public class PaymentListResult
{
    public List<PaymentListItemDto> Items { get; set; } = new();
    public int TotalCount { get; set; }
    public int Page { get; set; }
    public int PageSize { get; set; }
}

public class RejectRefundRequest
{
    public string Reason { get; set; } = string.Empty;
}

public class CreatePayOSPaymentRequest
{
    public decimal Amount { get; set; }
    public string Description { get; set; } = string.Empty;
    public Guid? ParkingSessionId { get; set; }
    public Guid? ReservationId { get; set; }
    public Guid? UserId { get; set; }
    public bool IsWalletDeposit { get; set; }
    public string? ReturnUrl { get; set; }
    public string? CancelUrl { get; set; }
}

public class PaymentStatusResult
{
    public Guid SessionId { get; set; }
    public string PaymentStatus { get; set; } = string.Empty;
    public string PaymentMethod { get; set; } = string.Empty;
    public decimal? Amount { get; set; }
    public DateTime? PaymentDate { get; set; }
    public long PayOSOrderCode { get; set; }
    public string StatusLabel { get; set; } = string.Empty;
}
