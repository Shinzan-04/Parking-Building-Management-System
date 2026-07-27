using Microsoft.EntityFrameworkCore;
using ParkingSystem.Application.Interfaces;
using ParkingSystem.Domain.Enums;
using ParkingSystem.Infrastructure.Data;

namespace ParkingSystem.Infrastructure.Services;

/// <summary>
/// Thuật toán gợi ý vị trí đỗ xe thông minh (Dành cho Slot đánh số thứ tự).
/// 
/// Chiến lược phân bổ (AI Scoring):
/// 1. Tầng thấp ưu tiên trước (FloorIndex thấp → điểm cao hơn)
/// 2. Số thứ tự ô đỗ nhỏ ưu tiên trước (SlotNumber VD: 1-001 tốt hơn 1-050)
/// 3. Gom cụm xe cùng loại (Có xe đỗ ở ô số kế bên → điểm cao hơn)
/// 
/// Công thức: Score = W1*(1/Floor) + W2*(1/SlotOrder) + W3*ClusterBonus
/// </summary>
public class SlotAssignmentService : ISlotAssignmentService
{
    private readonly ApplicationDbContext _context;

    private const double WeightLowFloor = 30.0;       // Ưu tiên tầng thấp
    private const double WeightSlotOrder = 25.0;      // Ưu tiên số thứ tự nhỏ
    private const double WeightCluster = 15.0;        // Ưu tiên gom cụm

    public SlotAssignmentService(ApplicationDbContext context)
    {
        _context = context;
    }

    private int ParseSlotNumber(string slotNumber)
    {
        if (string.IsNullOrWhiteSpace(slotNumber)) return 999;
        // Trích xuất phần số từ SlotNumber (ví dụ: "1-001" -> 1, "A12" -> 12)
        var numericChars = new string(slotNumber.Where(char.IsDigit).ToArray());
        if (int.TryParse(numericChars, out int number))
        {
            return number > 0 ? number : 999;
        }
        return 999;
    }

    public async Task<List<SlotRecommendation>> GetRecommendedSlotsAsync(Guid vehicleTypeId, int topN = 5, DateTime? startTime = null)
    {
        return await GetRecommendedSlotsAsync(vehicleTypeId, null, topN, startTime);
    }

    public async Task<List<SlotRecommendation>> GetRecommendedSlotsAsync(Guid vehicleTypeId, Guid? buildingId, int topN = 5, DateTime? startTime = null)
    {
        var targetTime = startTime ?? DateTime.UtcNow;
        var limitTime = targetTime.AddHours(4);
        var activeStatuses = new[] 
        { 
            ReservationStatus.PaymentPending, 
            ReservationStatus.Paid,
            ReservationStatus.PendingReview,
            ReservationStatus.Confirmed, 
            ReservationStatus.CheckedIn 
        };

        // Lấy tất cả slot phù hợp với loại xe
        // KHÔNG có Reservation nào (ở trạng thái chiếm giữ) trùng vào khoảng 4 tiếng từ thời điểm chọn
        var query = _context.ParkingSlots
            .Include(s => s.Floor)
                .ThenInclude(f => f.Building)
            .Where(s => s.VehicleTypeId == vehicleTypeId)
            .Where(s => !s.Reservations.Any(r => 
                activeStatuses.Contains(r.Status) && 
                r.StartTime < limitTime && r.EndTime > targetTime));
        
        // Nếu chọn đặt cho tương lai, ta không cần bắt buộc slot phải đang Available ngay bây giờ
        // (vì hiện tại có thể có xe đang đỗ, nhưng đến lúc đó xe đi rồi)
        if (startTime == null || startTime <= DateTime.UtcNow.AddMinutes(30))
        {
            query = query.Where(s => s.Status == SlotStatus.Available);
        }
        else
        {
            query = query.Where(s => s.Status != SlotStatus.Maintenance);
        }

        if (buildingId.HasValue)
            query = query.Where(s => s.Floor.BuildingId == buildingId.Value);

        var availableSlots = await query.ToListAsync();

        if (!availableSlots.Any())
            return new List<SlotRecommendation>();

        // Lấy danh sách xe cùng loại đang Occupied để tính Cluster bonus
        var occupiedSlots = await _context.ParkingSlots
            .Where(s => s.VehicleTypeId == vehicleTypeId && s.Status == SlotStatus.Occupied)
            .Select(s => new { s.FloorId, s.SlotNumber })
            .ToListAsync();

        var occupiedParsed = occupiedSlots
            .Select(o => new { o.FloorId, ParsedNum = ParseSlotNumber(o.SlotNumber) })
            .ToList();

        var recommendations = new List<SlotRecommendation>();

        foreach (var slot in availableSlots)
        {
            double score = 0;
            var reasons = new List<string>();

            int parsedNum = ParseSlotNumber(slot.SlotNumber);

            // Tiêu chí 1: Tầng thấp
            double floorScore = slot.Floor.FloorIndex > 0
                ? WeightLowFloor / slot.Floor.FloorIndex
                : WeightLowFloor;
            score += floorScore;

            // Tiêu chí 2: Số thứ tự ô (Số càng nhỏ càng tốt, ví dụ 1-001 > 1-050)
            double orderScore = WeightSlotOrder / parsedNum;
            score += orderScore;

            // Tiêu chí 3: Gom cụm (Kiểm tra xem có xe đỗ ở ô số N-1 hoặc N+1 không)
            var hasNeighbor = occupiedParsed.Any(o =>
                o.FloorId == slot.FloorId &&
                Math.Abs(o.ParsedNum - parsedNum) == 1);
            
            if (hasNeighbor)
            {
                score += WeightCluster;
                reasons.Add("Gom cụm xe cùng loại");
            }

            // Xây dựng lý do gợi ý
            if (slot.Floor.FloorIndex <= 1) reasons.Add("Tầng thấp tiện lợi");
            if (parsedNum <= 10) reasons.Add("Vị trí gần đầu bãi");

            recommendations.Add(new SlotRecommendation
            {
                SlotId = slot.Id,
                FloorId = slot.FloorId,
                SlotNumber = slot.SlotNumber,
                FloorName = slot.Floor.Name,
                FloorIndex = slot.Floor.FloorIndex,
                Row = 0,
                Column = 0,
                DistanceToEntry = 0,
                Score = Math.Round(score, 2),
                Reason = reasons.Any() ? string.Join(" | ", reasons) : "Vị trí khả dụng"
            });
        }

        return recommendations
            .OrderByDescending(r => r.Score)
            .Take(topN)
            .ToList();
    }

    public async Task<SlotRecommendation?> GetBestSlotAsync(Guid vehicleTypeId, DateTime? startTime = null)
    {
        return await GetBestSlotAsync(vehicleTypeId, null, startTime);
    }

    public async Task<SlotRecommendation?> GetBestSlotAsync(Guid vehicleTypeId, Guid? buildingId, DateTime? startTime = null)
    {
        var recommendations = await GetRecommendedSlotsAsync(vehicleTypeId, buildingId, 1, startTime);
        return recommendations.FirstOrDefault();
    }
}
