using System;

namespace ParkingSystem.Domain.Entities;

public class WalletTransaction : BaseEntity
{
    public Guid UserId { get; set; }
    public User? User { get; set; }

    /// <summary>
    /// Số tiền giao dịch (Số dương)
    /// </summary>
    public decimal Amount { get; set; }

    /// <summary>
    /// Loại giao dịch: Deposit, Withdraw, Payment, Refund
    /// </summary>
    public string Type { get; set; } = string.Empty;

    /// <summary>
    /// Trạng thái: Pending, Success, Failed
    /// </summary>
    public string Status { get; set; } = string.Empty;

    /// <summary>
    /// Mô tả giao dịch
    /// </summary>
    public string Description { get; set; } = string.Empty;

    /// <summary>
    /// ID thanh toán gốc (nếu là hoàn tiền)
    /// </summary>
    public Guid? RelatedPaymentId { get; set; }
    public Payment? RelatedPayment { get; set; }

    /// <summary>
    /// Mã đối soát với cổng thanh toán PayOS (nếu là rút tiền)
    public string? ReferenceId { get; set; }


}
