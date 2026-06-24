using Microsoft.AspNetCore.SignalR;
using ParkingSystem.Domain.Enums;
using ParkingSystem.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using ParkingSystem.Application.Interfaces;

namespace ParkingSystem.API.Hubs;

public class ChatHub : Hub
{
    private readonly ApplicationDbContext _context;
    private readonly IAiChatService _aiChatService;

    public ChatHub(ApplicationDbContext context, IAiChatService aiChatService)
    {
        _context = context;
        _aiChatService = aiChatService;
    }

    /// <summary>
    /// Tham gia phòng chat của một Session cụ thể (Khách hoặc Nhân viên đều dùng hàm này)
    /// </summary>
    public async Task JoinSession(string sessionId)
    {
        await Groups.AddToGroupAsync(Context.ConnectionId, sessionId);
    }

    /// <summary>
    /// Gửi tin nhắn từ Frontend lên
    /// </summary>
    public async Task SendMessage(string sessionId, string message, string senderRoleStr)
    {
        if (!Guid.TryParse(sessionId, out var sessionGuid))
            return;

        var session = await _context.ChatSessions.FirstOrDefaultAsync(s => s.Id == sessionGuid);
        if (session == null) return;

        // Ép kiểu Role
        var senderRole = Enum.Parse<ChatSenderRole>(senderRoleStr, true);

        // Lưu tin nhắn vào DB
        var chatMsg = new ParkingSystem.Domain.Entities.ChatMessage
        {
            Id = Guid.NewGuid(),
            ChatSessionId = sessionGuid,
            Sender = senderRole,
            Content = message,
            CreatedAt = DateTime.UtcNow
        };
        _context.ChatMessages.Add(chatMsg);
        await _context.SaveChangesAsync();

        // Gửi tin nhắn cho tất cả những người đang mở phiên chat này (Khách và Nhân viên)
        await Clients.Group(sessionId).SendAsync("ReceiveMessage", chatMsg.Id, senderRoleStr, message, chatMsg.CreatedAt);

        // Nếu người gửi là User/Guest và Session đang ở chế độ BotHandling -> Gọi AI
        if (senderRole == ChatSenderRole.User && session.Status == ChatSessionStatus.BotHandling)
        {
            var botReply = await _aiChatService.GetReplyAsync(message, session.BuildingId);
            
            var botMsg = new ParkingSystem.Domain.Entities.ChatMessage
            {
                Id = Guid.NewGuid(),
                ChatSessionId = sessionGuid,
                Sender = ChatSenderRole.Bot,
                Content = botReply,
                CreatedAt = DateTime.UtcNow
            };
            _context.ChatMessages.Add(botMsg);
            await _context.SaveChangesAsync();

            await Clients.Group(sessionId).SendAsync("ReceiveMessage", botMsg.Id, "Bot", botReply, botMsg.CreatedAt);
        }
    }

    /// <summary>
    /// Nhân viên bấm "Tiếp quản" phiên chat
    /// </summary>
    public async Task TakeoverSession(string sessionId)
    {
        if (!Guid.TryParse(sessionId, out var sessionGuid)) return;

        var userIdClaim = Context.User?.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(userIdClaim)) return;

        var session = await _context.ChatSessions.FirstOrDefaultAsync(s => s.Id == sessionGuid);
        if (session == null) return;

        session.Status = ChatSessionStatus.AgentHandling;
        session.AgentId = Guid.Parse(userIdClaim);
        session.UpdatedAt = DateTime.UtcNow;
        
        await _context.SaveChangesAsync();

        // Báo cho toàn Group biết Nhân viên đã vào
        await Clients.Group(sessionId).SendAsync("SessionStatusChanged", "AgentHandling", session.AgentId);
    }
}
