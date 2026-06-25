namespace ParkingSystem.Domain.Enums;

public enum ChatSessionStatus
{
    BotHandling,      // Bot đang trả lời tự động
    Escalated,        // AI đã bó tay, khách đang chờ nhân viên rep
    AgentHandling,    // Nhân viên đang chat với khách
    Closed            // Phiên chat đã kết thúc
}

public enum ChatSenderRole
{
    User,   // Khách hàng (có thể là User đã login hoặc Guest)
    Bot,    // AI Chatbot
    Agent   // Nhân viên hỗ trợ (Staff/Manager/Admin)
}
