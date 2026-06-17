using Microsoft.Extensions.Caching.Memory;
using ParkingSystem.Application.Interfaces.Lpr;

namespace ParkingSystem.Infrastructure.Services.Lpr;

public class PlateCacheService : IPlateCacheService
{
    private readonly IMemoryCache _cache;

    public PlateCacheService(IMemoryCache cache)
    {
        _cache = cache;
    }

    public void SetCachedPlate(string key, LprResult result, TimeSpan expiration)
    {
        var cacheOptions = new MemoryCacheEntryOptions
        {
            AbsoluteExpirationRelativeToNow = expiration
        };
        _cache.Set(key, result, cacheOptions);
    }

    public LprResult? GetCachedPlate(string key)
    {
        if (_cache.TryGetValue(key, out LprResult? result))
        {
            return result;
        }
        return null;
    }
}
