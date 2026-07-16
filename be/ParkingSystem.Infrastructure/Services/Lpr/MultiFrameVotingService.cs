using System.Collections.Concurrent;
using ParkingSystem.Application.Interfaces.Lpr;

namespace ParkingSystem.Infrastructure.Services.Lpr;

public class MultiFrameVotingService : IMultiFrameVotingService
{
    // Dictionary lưu trữ danh sách các frame raw text theo TrackId
    private readonly ConcurrentDictionary<string, List<string>> _trackBuffers = new();

    public void AddFrameResult(string trackId, string rawPlate)
    {
        if (string.IsNullOrWhiteSpace(rawPlate)) return;
        
        _trackBuffers.AddOrUpdate(
            trackId,
            new List<string> { rawPlate },
            (key, list) =>
            {
                // Giữ tối đa 10 frame gần nhất để tiết kiệm RAM
                if (list.Count >= 10) list.RemoveAt(0);
                list.Add(rawPlate);
                return list;
            });
    }

    public string GetVotedPlate(string trackId)
    {
        if (!_trackBuffers.TryGetValue(trackId, out var frames) || !frames.Any())
            return string.Empty;

        // Nếu chỉ có 1 frame, trả về chính nó
        if (frames.Count == 1) return frames.First();

        // Xóa khoảng trắng và đồng nhất độ dài trung bình
        var cleanedFrames = frames.Select(f => f.Replace(" ", "").Trim()).ToList();
        
        // 1. Loại bỏ các kết quả có độ dài quá sai lệch (outliers)
        var mostCommonLength = cleanedFrames.GroupBy(f => f.Length)
                                            .OrderByDescending(g => g.Count())
                                            .First().Key;
                                            
        var validFrames = cleanedFrames.Where(f => f.Length == mostCommonLength).ToList();
        if (!validFrames.Any()) validFrames = cleanedFrames; // fallback

        // 2. Character-level Majority Voting
        int maxLength = validFrames.Max(f => f.Length);
        char[] votedPlate = new char[maxLength];

        for (int i = 0; i < maxLength; i++)
        {
            var charFrequencies = new Dictionary<char, int>();
            foreach (var frame in validFrames)
            {
                if (i < frame.Length)
                {
                    char c = frame[i];
                    if (charFrequencies.ContainsKey(c))
                        charFrequencies[c]++;
                    else
                        charFrequencies[c] = 1;
                }
            }

            // Chọn ký tự xuất hiện nhiều nhất ở vị trí i
            if (charFrequencies.Any())
            {
                var bestChar = charFrequencies.OrderByDescending(kvp => kvp.Value).First().Key;
                votedPlate[i] = bestChar;
            }
        }

        return new string(votedPlate).Trim('\0');
    }

    public void ClearTrack(string trackId)
    {
        _trackBuffers.TryRemove(trackId, out _);
    }
}
