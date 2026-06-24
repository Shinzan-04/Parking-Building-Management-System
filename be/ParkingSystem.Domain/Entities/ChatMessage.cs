using ParkingSystem.Domain.Enums;

namespace ParkingSystem.Domain.Entities;

public class ChatMessage : BaseEntity
{
    public Guid ChatSessionId { get; set; }
    
    public ChatSenderRole Sender { get; set; }
    
    public string Content { get; set; } = string.Empty;

    // Navigation property
    public ChatSession ChatSession { get; set; } = null!;
}
