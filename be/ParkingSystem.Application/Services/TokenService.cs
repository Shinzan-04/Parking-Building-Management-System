using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.Extensions.Configuration;
using Microsoft.IdentityModel.Tokens;
using ParkingSystem.Application.Interfaces;
using ParkingSystem.Domain.Entities;

namespace ParkingSystem.Application.Services;

public class TokenService : ITokenService
{
    private readonly IConfiguration _configuration;

    public TokenService(IConfiguration configuration)
    {
        _configuration = configuration;
    }

    public string GenerateToken(User user)
    {
        var claims = new List<Claim>
        {
            new Claim(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
            new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new Claim(JwtRegisteredClaimNames.UniqueName, user.Username),
            new Claim(ClaimTypes.Role, user.Role.ToString()),
            new Claim("FullName", user.FullName)
        };

        if (!string.IsNullOrEmpty(user.Email))
        {
            claims.Add(new Claim(JwtRegisteredClaimNames.Email, user.Email));
        }

        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_configuration["JwtSettings:Key"] ?? throw new InvalidOperationException("Jwt Key is missing")));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256Signature);

        var tokenDescriptor = new SecurityTokenDescriptor
        {
            Subject = new ClaimsIdentity(claims),
            Expires = DateTime.UtcNow.AddHours(int.Parse(_configuration["JwtSettings:ExpireHours"] ?? "24")),
            Issuer = _configuration["JwtSettings:Issuer"],
            Audience = _configuration["JwtSettings:Audience"],
            SigningCredentials = creds
        };

        var tokenHandler = new JwtSecurityTokenHandler();
        var token = tokenHandler.CreateToken(tokenDescriptor);

        return tokenHandler.WriteToken(token);
    }

    public string GenerateDriverQrToken(Guid driverId, string driverCode)
    {
        var claims = new List<Claim>
        {
            new Claim(JwtRegisteredClaimNames.Sub, driverId.ToString()),
            new Claim(ClaimTypes.NameIdentifier, driverId.ToString()),
            new Claim("driverCode", driverCode),
            new Claim("type", "driver")
        };

        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_configuration["JwtSettings:Key"] ?? throw new InvalidOperationException("Jwt Key is missing")));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256Signature);

        var tokenDescriptor = new SecurityTokenDescriptor
        {
            Subject = new ClaimsIdentity(claims),
            // Không set Expires vì QR này dùng vĩnh viễn hoặc cấp lại theo yêu cầu
            Issuer = _configuration["JwtSettings:Issuer"],
            Audience = _configuration["JwtSettings:Audience"],
            SigningCredentials = creds
        };

        var tokenHandler = new JwtSecurityTokenHandler();
        var token = tokenHandler.CreateToken(tokenDescriptor);

        return tokenHandler.WriteToken(token);
    }

    public (Guid DriverId, string DriverCode)? ParseDriverQrToken(string token)
    {
        try
        {
            var tokenHandler = new JwtSecurityTokenHandler();
            var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(
                _configuration["JwtSettings:Key"] ?? throw new InvalidOperationException("Jwt Key is missing")));

            var parameters = new TokenValidationParameters
            {
                ValidateIssuerSigningKey = true,
                IssuerSigningKey = key,
                ValidateIssuer = true,
                ValidIssuer = _configuration["JwtSettings:Issuer"],
                ValidateAudience = true,
                ValidAudience = _configuration["JwtSettings:Audience"],
                ValidateLifetime = false // QR Driver không có hạn
            };

            var principal = tokenHandler.ValidateToken(token, parameters, out _);

            // Kiểm tra claim "type" phải là "driver"
            var typeClaim = principal.FindFirst("type")?.Value;
            if (typeClaim != "driver") return null;

            var subClaim = principal.FindFirst(JwtRegisteredClaimNames.Sub)?.Value;
            var driverCodeClaim = principal.FindFirst("driverCode")?.Value;

            if (string.IsNullOrEmpty(subClaim) || string.IsNullOrEmpty(driverCodeClaim))
                return null;

            if (!Guid.TryParse(subClaim, out var driverId))
                return null;

            return (driverId, driverCodeClaim);
        }
        catch
        {
            // Token không hợp lệ, bị giả mạo, hoặc sai format
            return null;
        }
    }
}
