using System.ComponentModel.DataAnnotations.Schema;
using ParkingSystem.Domain.Enums;

namespace ParkingSystem.Domain.Entities;

public class ChatSession : BaseEntity
{
    /// <summary>
    /// ID của Khách hàng (nếu đã login)
    /// </summary>
    public Guid? UserId { get; set; }

    /// <summary>
    /// ID Ẩn danh (nếu là khách vãng lai, sinh ở frontend)
    /// </summary>
    public string? GuestId { get; set; }

    /// <summary>
    /// Bối cảnh tòa nhà mà khách đang hỏi (nếu có)
    /// </summary>
    public Guid? BuildingId { get; set; }

    /// <summary>
    /// Trạng thái của phiên chat
    /// </summary>
    public ChatSessionStatus Status { get; set; } = ChatSessionStatus.BotHandling;

    /// <summary>
    /// ID của nhân viên đang tiếp quản phiên chat này (nếu đang AgentHandling)
    /// </summary>
    public Guid? AgentId { get; set; }

    /// <summary>
    /// Khách đã yêu cầu Live Chat lúc mấy giờ
    /// </summary>
    public DateTime? EscalatedAt { get; set; }

    // Thông tin bổ sung cho Guest khi chuyển sang Agent
    public string? GuestName { get; set; }
    public string? GuestPhoneOrEmail { get; set; }

    // Navigation properties
    public User? User { get; set; }
    public User? Agent { get; set; }
    public Building? Building { get; set; }
    
    public ICollection<ChatMessage> Messages { get; set; } = new List<ChatMessage>();
}
