namespace ParkingSystem.Application.Interfaces;

public interface IAiChatService
{
    Task<string> GetReplyAsync(string userMessage, Guid? buildingId = null);
}
