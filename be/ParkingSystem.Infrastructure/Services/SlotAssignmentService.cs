using Microsoft.EntityFrameworkCore;
using ParkingSystem.Application.Interfaces;
using ParkingSystem.Domain.Enums;
using ParkingSystem.Infrastructure.Data;

namespace ParkingSystem.Infrastructure.Services;

/// <summary>
/// Thuật toán gợi ý vị trí đỗ xe thông minh.
/// 
/// Chiến lược phân bổ (AI Scoring):
/// 1. Ưu tiên đỗ từ trong ra ngoài (Row thấp = trong cùng → điểm cao hơn)
/// 2. Gần lối vào/ra tiện hơn (DistanceToEntry thấp → điểm cao hơn)
/// 3. Tầng thấp ưu tiên trước (FloorIndex thấp → điểm cao hơn)
/// 4. Gom cụm xe cùng loại (có xe cạnh bên → điểm cao hơn, giảm phân mảnh)
/// 
/// Công thức: Score = W1*(1/Row) + W2*(1/Distance) + W3*(1/Floor) + W4*ClusterBonus
/// </summary>
public class SlotAssignmentService : ISlotAssignmentService
{
    private readonly ApplicationDbContext _context;

    // Trọng số cho từng tiêu chí (điều chỉnh theo nhu cầu thực tế)
    private const double WeightInnerFirst = 30.0;     // Ưu tiên trong ra ngoài
    private const double WeightNearEntry = 25.0;      // Ưu tiên gần lối vào
    private const double WeightLowFloor = 20.0;       // Ưu tiên tầng thấp
    private const double WeightCluster = 15.0;        // Ưu tiên gom cụm
    private const double WeightSlotOrder = 10.0;      // Ưu tiên ô đầu dãy

    public SlotAssignmentService(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<List<SlotRecommendation>> GetRecommendedSlotsAsync(Guid vehicleTypeId, int topN = 5)
    {
        // Lấy tất cả slot trống phù hợp với loại xe
        var availableSlots = await _context.ParkingSlots
            .Include(s => s.Floor)
            .Where(s => s.VehicleTypeId == vehicleTypeId && s.Status == SlotStatus.Available)
            .ToListAsync();

        if (!availableSlots.Any())
            return new List<SlotRecommendation>();

        // Lấy danh sách slot đang Occupied cùng tầng (để tính cluster bonus)
        var occupiedSlotIds = await _context.ParkingSlots
            .Where(s => s.VehicleTypeId == vehicleTypeId && s.Status == SlotStatus.Occupied)
            .Select(s => new { s.FloorId, s.Row, s.Column })
            .ToListAsync();

        var recommendations = new List<SlotRecommendation>();

        foreach (var slot in availableSlots)
        {
            double score = 0;
            var reasons = new List<string>();

            // Tiêu chí 1: Ưu tiên trong ra ngoài (Row càng nhỏ càng tốt)
            double rowScore = slot.Row > 0 ? WeightInnerFirst / slot.Row : WeightInnerFirst;
            score += rowScore;

            // Tiêu chí 2: Gần lối vào (DistanceToEntry càng nhỏ càng tốt)
            double distScore = slot.DistanceToEntry > 0
                ? WeightNearEntry / slot.DistanceToEntry
                : WeightNearEntry;
            score += distScore;

            // Tiêu chí 3: Tầng thấp (FloorIndex càng nhỏ càng tốt)
            double floorScore = slot.Floor.FloorIndex > 0
                ? WeightLowFloor / slot.Floor.FloorIndex
                : WeightLowFloor;
            score += floorScore;

            // Tiêu chí 4: Gom cụm - kiểm tra có xe cùng loại đỗ cạnh bên không
            var hasNeighbor = occupiedSlotIds.Any(o =>
                o.FloorId == slot.FloorId &&
                Math.Abs(o.Row - slot.Row) <= 1 &&
                Math.Abs(o.Column - slot.Column) <= 1);
            if (hasNeighbor)
            {
                score += WeightCluster;
                reasons.Add("Gom cụm cùng loại xe");
            }

            // Tiêu chí 5: Ưu tiên ô đầu dãy (Column thấp)
            double colScore = slot.Column > 0 ? WeightSlotOrder / slot.Column : WeightSlotOrder;
            score += colScore;

            // Xây dựng lý do gợi ý
            if (slot.Floor.FloorIndex <= 1) reasons.Add("Tầng thấp tiện lợi");
            if (slot.Row <= 2) reasons.Add("Vị trí trong cùng");
            if (slot.DistanceToEntry <= 3) reasons.Add("Gần lối vào/ra");

            recommendations.Add(new SlotRecommendation
            {
                SlotId = slot.Id,
                SlotNumber = slot.SlotNumber,
                FloorName = slot.Floor.Name,
                FloorIndex = slot.Floor.FloorIndex,
                Row = slot.Row,
                Column = slot.Column,
                DistanceToEntry = slot.DistanceToEntry,
                Score = Math.Round(score, 2),
                Reason = reasons.Any() ? string.Join(" | ", reasons) : "Vị trí khả dụng"
            });
        }

        // Sắp xếp theo điểm từ cao → thấp, trả về top N
        return recommendations
            .OrderByDescending(r => r.Score)
            .Take(topN)
            .ToList();
    }

    public async Task<SlotRecommendation?> GetBestSlotAsync(Guid vehicleTypeId)
    {
        var recommendations = await GetRecommendedSlotsAsync(vehicleTypeId, 1);
        return recommendations.FirstOrDefault();
    }
}
