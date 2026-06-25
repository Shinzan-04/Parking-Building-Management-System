using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Configuration;
using ParkingSystem.Application.Interfaces;
using ParkingSystem.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace ParkingSystem.Infrastructure.Services;

public class GeminiChatService : IAiChatService
{
    private readonly HttpClient _httpClient;
    private readonly IConfiguration _config;
    private readonly ApplicationDbContext _context;

    public GeminiChatService(HttpClient httpClient, IConfiguration config, ApplicationDbContext context)
    {
        _httpClient = httpClient;
        _config = config;
        _context = context;
    }

    public async Task<string> GetReplyAsync(string userMessage, Guid? buildingId = null)
    {
        var apiKey = _config["OpenRouter:ApiKey"];
        var model = _config["OpenRouter:Model"] ?? "google/gemini-2.5-flash";

        // Fetch real-time data from DB to provide context for AI (RAG technique)
        string buildingContext = "Hệ thống bãi đỗ xe chung.";
        
        // Nếu không truyền BuildingId, tự động lấy Tòa nhà đầu tiên trong DB làm mặc định
        var buildingQuery = _context.Buildings
            .Include(b => b.Floors)
                .ThenInclude(f => f.ParkingSlots)
                    .ThenInclude(s => s.VehicleType);
                    
        var building = buildingId.HasValue 
            ? await buildingQuery.FirstOrDefaultAsync(b => b.Id == buildingId.Value)
            : await buildingQuery.FirstOrDefaultAsync();

        if (building != null)
        {
            var slots = building.Floors.SelectMany(f => f.ParkingSlots).ToList();
                int totalSlots = slots.Count;
                int availableSlots = slots.Count(s => s.Status == ParkingSystem.Domain.Enums.SlotStatus.Available);

                var availableByType = slots
                    .Where(s => s.Status == ParkingSystem.Domain.Enums.SlotStatus.Available && s.VehicleType != null)
                    .GroupBy(s => s.VehicleType.Name)
                    .Select(g => $"{g.Key}: {g.Count()} chỗ");

                var pricingPolicies = await _context.Set<ParkingSystem.Domain.Entities.PricingPolicy>()
                    .Include(p => p.VehicleType)
                    .ToListAsync();

                buildingContext = $"Bạn đang tư vấn cho tòa nhà: {building.Name}, địa chỉ: {building.Address}.\n";
                buildingContext += $"THÔNG TIN REAL-TIME TỪ DATABASE:\n";
                buildingContext += $"- Sức chứa: Tổng {totalSlots} chỗ, còn trống {availableSlots} chỗ.\n";
                
                if (availableByType.Any())
                {
                    buildingContext += $"- Chi tiết chỗ trống theo loại xe: {string.Join(", ", availableByType)}.\n";
                }

                buildingContext += "- Bảng giá đỗ xe:\n";
                foreach(var p in pricingPolicies.Where(p => p.VehicleType != null))
                {
                    buildingContext += $"  + Xe {p.VehicleType.Name}: {p.DayBlockRate:N0} VNĐ / {p.BlockDurationHours} giờ (Ban ngày), {p.NightBlockRate:N0} VNĐ / {p.BlockDurationHours} giờ (Ban đêm {p.NightStartHour}h-{p.NightEndHour}h). Tối đa: {p.DailyRate:N0} VNĐ/ngày.\n";
                }
        }

        var systemPrompt = $@"Bạn là 'ParkAssist', một trợ lý AI chăm sóc khách hàng tận tâm của Hệ thống Quản lý Bãi đỗ xe thông minh.
{buildingContext}

THÔNG TIN QUY ĐỊNH BÃI XE (BUSINESS RULES):
- Mở cửa: 24/7 (Xuyên đêm).
- Thanh toán: Hỗ trợ thanh toán tự động không tiền mặt qua Ví điện tử nội bộ (Wallet) hoặc các cổng thanh toán online (PayOS).
- Quy trình Đặt chỗ trước (Reservation/Booking):
  + Bước 1: Khách hàng nhập biển số xe, chọn khung giờ (StartTime, EndTime) và chọn ô đỗ (Có thể tự chọn hoặc để AI tự động gợi ý ô tốt nhất).
  + Bước 2: Hệ thống tính phí và tạo mã Booking Code (Ví dụ: BK-123456).
  + Bước 3: Khách hàng có 15 phút để thanh toán (Payment Pending). Nếu không thanh toán, đơn tự hủy.
  + Bước 4: Sau khi thanh toán, đơn sẽ ở trạng thái Chờ duyệt (Pending Review) hoặc Đã xác nhận (Confirmed) tùy cài đặt của tòa nhà.
- Các quy định và Giới hạn Đặt chỗ:
  + Giới hạn (Anti-Spam): Mỗi khách hàng (Driver) chỉ được phép có tối đa 3 đơn đặt chỗ đang hoạt động cùng lúc. Một biển số xe không thể đặt 2 ô đỗ trong cùng một khung giờ.
  + Giữ chỗ: Hệ thống tự động khóa ô đỗ (Reserve) cho khách 30 phút trước giờ hẹn (StartTime).
  + Đến trễ (No-Show): Nếu trễ quá 30 phút so với giờ hẹn mà chưa Check-in, đơn sẽ bị hủy và KHÔNG HOÀN TIỀN.
  + Không thể đặt chỗ vào các ô đỗ đang trong trạng thái Bảo trì (Maintenance).
- Mất thẻ xe hoặc sự cố kỹ thuật: Khách cần xuất trình giấy tờ xe tại bốt bảo vệ để xử lý.

TUÂN THỦ NGHIÊM NGẶT 3 QUY TẮC SAU:
1. Trả lời ngắn gọn, lịch sự, chuyên nghiệp bằng tiếng Việt.
2. Nếu khách hàng hỏi một vấn đề về bãi xe nhưng bạn không chắc chắn, hoặc gặp sự cố (mất đồ, quẹt xe), hoặc khách CÓ NHU CẦU GẶP NHÂN VIÊN/NHÂN SỰ/NGƯỜI THẬT, hãy nói chính xác câu sau:
""Dạ, rất xin lỗi bạn, hiện tại tôi chưa có đủ dữ liệu để trả lời chính xác vấn đề này. Bạn có muốn kết nối trực tiếp với nhân viên hỗ trợ của chúng tôi không ạ? [SUGGEST_LIVECHAT]""
3. Từ chối các câu hỏi ngoài luồng (Out-of-domain) như thời tiết, chính trị, viết code... Tuy nhiên, yêu cầu ""Gặp nhân sự / nhân viên"" KHÔNG PHẢI là ngoài luồng, hãy dùng Rule 2. Câu từ chối mẫu:
""Xin lỗi, tôi là trợ lý ảo của Bãi đỗ xe. Tôi chỉ có thể hỗ trợ bạn các vấn đề liên quan đến đỗ xe. Tôi không thể giúp bạn chủ đề này.""";

        var requestBody = new
        {
            model = model,
            max_tokens = 1000,
            messages = new[]
            {
                new { role = "system", content = systemPrompt },
                new { role = "user", content = userMessage }
            }
        };

        var json = JsonSerializer.Serialize(requestBody);
        var content = new StringContent(json, Encoding.UTF8, "application/json");

        _httpClient.DefaultRequestHeaders.Clear();
        _httpClient.DefaultRequestHeaders.Add("Authorization", $"Bearer {apiKey}");
        
        var requestUrl = "https://openrouter.ai/api/v1/chat/completions";

        var response = await _httpClient.PostAsync(requestUrl, content);

        if (!response.IsSuccessStatusCode)
        {
            var error = await response.Content.ReadAsStringAsync();
            Console.WriteLine("OpenRouter Error: " + error);
            return "Xin lỗi, hệ thống AI đang bảo trì. Vui lòng thử lại sau. [SUGGEST_LIVECHAT]";
        }

        var responseJson = await response.Content.ReadAsStringAsync();
        using var doc = JsonDocument.Parse(responseJson);
        
        try 
        {
            var text = doc.RootElement
                .GetProperty("choices")[0]
                .GetProperty("message")
                .GetProperty("content").GetString();

            return text ?? "Xin lỗi, tôi không hiểu ý bạn.";
        }
        catch
        {
            return "Xin lỗi, tôi gặp lỗi khi xử lý câu trả lời. [SUGGEST_LIVECHAT]";
        }
    }
}
