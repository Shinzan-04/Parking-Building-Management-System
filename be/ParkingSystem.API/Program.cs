using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using ParkingSystem.Application.Interfaces;
using ParkingSystem.Application.Services;
using Microsoft.EntityFrameworkCore;
using ParkingSystem.Infrastructure.Data;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddControllers();
builder.Services.AddOpenApi();

// Add CORS
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAll", builder =>
        builder.AllowAnyOrigin()
               .AllowAnyMethod()
               .AllowAnyHeader());
});

// Setup Entity Framework Core (PostgreSQL)
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection");
builder.Services.AddDbContext<ApplicationDbContext>(options =>
    options.UseNpgsql(connectionString));

// Add Swagger with JWT Support
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new OpenApiInfo { Title = "ParkingSystem API", Version = "v1" });

    var securityScheme = new OpenApiSecurityScheme
    {
        Name = "Authorization",
        Description = "Enter 'Bearer {token}'",
        In = ParameterLocation.Header,
        Type = SecuritySchemeType.ApiKey,
        Scheme = "Bearer",
        BearerFormat = "JWT",
        Reference = new OpenApiReference
        {
            Type = ReferenceType.SecurityScheme,
            Id = "Bearer"
        }
    };

    c.AddSecurityDefinition("Bearer", securityScheme);
    c.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        { securityScheme, new[] { "Bearer" } }
    });
});

// Register Repositories
builder.Services.AddScoped(typeof(ParkingSystem.Domain.Interfaces.IGenericRepository<>), typeof(ParkingSystem.Infrastructure.Repositories.GenericRepository<>));
builder.Services.AddScoped<ParkingSystem.Domain.Interfaces.IUserRepository, ParkingSystem.Infrastructure.Repositories.UserRepository>();

// Register Services
builder.Services.AddScoped<ITokenService, TokenService>();
builder.Services.AddScoped<IQrCodeService, QrCodeService>();
builder.Services.AddScoped<IAuthService, AuthService>();
builder.Services.AddScoped<IBuildingService, BuildingService>();
builder.Services.AddScoped<IFloorService, FloorService>();
builder.Services.AddScoped<IVehicleTypeService, VehicleTypeService>();
builder.Services.AddScoped<IParkingSlotService, ParkingSlotService>();
builder.Services.AddScoped<IPricingPolicyService, PricingPolicyService>();
builder.Services.AddScoped<IUserService, UserService>();
builder.Services.AddScoped<ICheckInService, ParkingSystem.Infrastructure.Services.CheckInService>();
builder.Services.AddScoped<ISlotAssignmentService, ParkingSystem.Infrastructure.Services.SlotAssignmentService>();
builder.Services.AddScoped<IReservationService, ParkingSystem.Infrastructure.Services.ReservationService>();
builder.Services.AddScoped<ISessionService, ParkingSystem.Infrastructure.Services.SessionService>();

// Register Cloudinary Image Upload Service (lưu ảnh biển số lên cloud)
builder.Services.AddScoped<IImageUploadService, ParkingSystem.Infrastructure.Services.CloudinaryImageService>();

// Register License Plate OCR Service (Singleton vì model ONNX chỉ cần load 1 lần)
// Sử dụng model license_plate_detector.onnx đã train riêng cho biển số xe Việt Nam
var modelPath = Path.Combine(builder.Environment.ContentRootPath, "Models", "license_plate_detector.onnx");
if (File.Exists(modelPath))
{
    builder.Services.AddSingleton<ILicensePlateOcrService>(
        new ParkingSystem.Infrastructure.Services.LicensePlateOcrService(modelPath));
}
else
{
    // Nếu chưa có model, dùng service giả trả về thông báo
    builder.Services.AddSingleton<ILicensePlateOcrService>(
        new ParkingSystem.Infrastructure.Services.FallbackOcrService());
}

var jwtSettings = builder.Configuration.GetSection("JwtSettings");
var secretKey = jwtSettings["Key"] ?? throw new InvalidOperationException("JWT Key is missing in configuration.");

builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options =>
{
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuer = true,
        ValidateAudience = true,
        ValidateLifetime = true,
        ValidateIssuerSigningKey = true,
        ValidIssuer = jwtSettings["Issuer"],
        ValidAudience = jwtSettings["Audience"],
        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secretKey))
    };
});

builder.Services.AddAuthorization();

var app = builder.Build();

// ===== Khởi tạo Database: Migrate + Seed dữ liệu mẫu =====
using (var scope = app.Services.CreateScope())
{
    var logger = scope.ServiceProvider.GetRequiredService<ILogger<Program>>();
    var dbContext = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
    var connStr = builder.Configuration.GetConnectionString("DefaultConnection");
    
    // Ẩn password trong log
    var safeConnStr = System.Text.RegularExpressions.Regex.Replace(
        connStr ?? "", @"Password=[^;]*", "Password=***");
    
    logger.LogInformation("🔌 Connection String: {ConnStr}", safeConnStr);
    
    try
    {
        // Tự động apply migration (tạo bảng nếu chưa có trên Neon)
        await dbContext.Database.MigrateAsync();
        logger.LogInformation("✅ Database migration thành công!");
        
        var dbName = dbContext.Database.GetDbConnection().Database;
        var dbServer = dbContext.Database.GetDbConnection().DataSource;
        logger.LogInformation("📊 Database: {DbName} | Server: {Server}", dbName, dbServer);

        // ===== SEED DATA: Tạo tài khoản mẫu cho từng Role =====
        if (!dbContext.Users.Any())
        {
            logger.LogInformation("🌱 Seeding tài khoản mẫu cho 4 role...");

            var seedUsers = new[]
            {
                new ParkingSystem.Domain.Entities.User
                {
                    Id = Guid.NewGuid(),
                    Username = "admin",
                    PasswordHash = BCrypt.Net.BCrypt.HashPassword("admin123"),
                    FullName = "Quản trị viên hệ thống",
                    Role = ParkingSystem.Domain.Enums.Role.Admin,
                    Email = "admin@parking.vn",
                    PhoneNumber = "0901000001",
                    QrCode = Guid.NewGuid().ToString("N")[..8],
                    CreatedAt = DateTime.UtcNow
                },
                new ParkingSystem.Domain.Entities.User
                {
                    Id = Guid.NewGuid(),
                    Username = "manager",
                    PasswordHash = BCrypt.Net.BCrypt.HashPassword("manager123"),
                    FullName = "Quản lý bãi xe",
                    Role = ParkingSystem.Domain.Enums.Role.Manager,
                    Email = "manager@parking.vn",
                    PhoneNumber = "0901000002",
                    QrCode = Guid.NewGuid().ToString("N")[..8],
                    CreatedAt = DateTime.UtcNow
                },
                new ParkingSystem.Domain.Entities.User
                {
                    Id = Guid.NewGuid(),
                    Username = "staff",
                    PasswordHash = BCrypt.Net.BCrypt.HashPassword("staff123"),
                    FullName = "Nhân viên trực bãi",
                    Role = ParkingSystem.Domain.Enums.Role.Staff,
                    Email = "staff@parking.vn",
                    PhoneNumber = "0901000003",
                    QrCode = Guid.NewGuid().ToString("N")[..8],
                    CreatedAt = DateTime.UtcNow
                },
                new ParkingSystem.Domain.Entities.User
                {
                    Id = Guid.NewGuid(),
                    Username = "driver",
                    PasswordHash = BCrypt.Net.BCrypt.HashPassword("driver123"),
                    FullName = "Khách gửi xe",
                    Role = ParkingSystem.Domain.Enums.Role.Driver,
                    Email = "driver@parking.vn",
                    PhoneNumber = "0901000004",
                    QrCode = Guid.NewGuid().ToString("N")[..8],
                    CreatedAt = DateTime.UtcNow
                }
            };

            dbContext.Users.AddRange(seedUsers);
            await dbContext.SaveChangesAsync();
            logger.LogInformation("✅ Đã tạo {Count} tài khoản mẫu!", seedUsers.Length);
        }
        else
        {
            logger.LogInformation("📌 Database đã có dữ liệu, bỏ qua seed.");
        }
    }
    catch (Exception ex)
    {
        logger.LogError(ex, "❌ Database khởi tạo THẤT BẠI — {Message}", ex.Message);
    }
}

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
    app.UseSwagger();
    app.UseSwaggerUI(c =>
    {
        c.SwaggerEndpoint("/swagger/v1/swagger.json", "ParkingSystem API v1");
    });
}

// app.UseHttpsRedirection();

app.UseCors("AllowAll");

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

app.Run();
