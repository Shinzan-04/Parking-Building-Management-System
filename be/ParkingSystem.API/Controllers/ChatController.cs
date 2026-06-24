using Microsoft.AspNetCore.Mvc;
using ParkingSystem.Infrastructure.Data;
using ParkingSystem.Domain.Entities;
using ParkingSystem.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace ParkingSystem.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ChatController : ControllerBase
{
    private readonly ApplicationDbContext _context;

    public ChatController(ApplicationDbContext context)
    {
        _context = context;
    }

    [HttpPost("start")]
    public async Task<IActionResult> StartSession([FromBody] StartChatRequest request)
    {
        var session = new ChatSession
        {
            Id = Guid.NewGuid(),
            GuestId = request.GuestId,
            BuildingId = request.BuildingId,
            Status = ChatSessionStatus.BotHandling
        };

        _context.ChatSessions.Add(session);
        await _context.SaveChangesAsync();

        return Ok(new { SessionId = session.Id });
    }

    [HttpGet("{sessionId}/messages")]
    public async Task<IActionResult> GetMessages(Guid sessionId)
    {
        var messages = await _context.ChatMessages
            .Where(m => m.ChatSessionId == sessionId)
            .OrderBy(m => m.CreatedAt)
            .Select(m => new {
                m.Id,
                m.Content,
                Sender = m.Sender.ToString(),
                m.CreatedAt
            })
            .ToListAsync();

        return Ok(messages);
    }

    [HttpGet("sessions")]
    public async Task<IActionResult> GetActiveSessions([FromQuery] Guid buildingId)
    {
        // Lấy các session đang chờ nhân viên (Escalated) hoặc đang được nhân viên xử lý (AgentHandling)
        var sessions = await _context.ChatSessions
            .Where(s => s.BuildingId == buildingId 
                     && (s.Status == ChatSessionStatus.Escalated || s.Status == ChatSessionStatus.AgentHandling))
            .OrderByDescending(s => s.EscalatedAt ?? s.CreatedAt)
            .Select(s => new {
                s.Id,
                s.GuestId,
                s.GuestName,
                Status = s.Status.ToString(),
                s.AgentId,
                s.EscalatedAt,
                s.CreatedAt
            })
            .ToListAsync();

        return Ok(sessions);
    }
}

public class StartChatRequest
{
    public string? GuestId { get; set; }
    public Guid? BuildingId { get; set; }
}
