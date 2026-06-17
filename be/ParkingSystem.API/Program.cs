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

    // Dùng Type = Http + Scheme = Bearer → Swagger tự thêm "Bearer " prefix
    // User chỉ cần paste token, không cần gõ "Bearer " thủ công
    var securityScheme = new OpenApiSecurityScheme
    {
        Name = "Authorization",
        Description = "Chỉ cần paste JWT token (không cần thêm 'Bearer ')",
        In = ParameterLocation.Header,
        Type = SecuritySchemeType.Http,
        Scheme = "bearer",
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
        { securityScheme, Array.Empty<string>() }
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

// Register Email + OTP Service (xác thực đăng ký / quên mật khẩu qua email)
builder.Services.AddScoped<IEmailService, ParkingSystem.Infrastructure.Services.GmailEmailService>();
builder.Services.AddScoped<IOtpService, ParkingSystem.Infrastructure.Services.OtpService>();
builder.Services.AddScoped<INotificationService, ParkingSystem.Infrastructure.Services.NotificationService>();

// Background Service: Tự động hủy reservation hết hạn (quét mỗi 5 phút)
builder.Services.AddHostedService<ParkingSystem.Infrastructure.Services.ReservationCleanupService>();

// Register LPR Services (Clean Architecture)
var modelPath = Path.Combine(builder.Environment.ContentRootPath, "Models", "license_plate_detector.onnx");

if (File.Exists(modelPath))
{
    builder.Services.AddSingleton<ParkingSystem.Application.Interfaces.Lpr.IYoloDetector>(
        new ParkingSystem.Infrastructure.Services.Lpr.YoloDetector(modelPath));
}
else
{
    // Tạm thời nếu ko có file, khởi tạo dummy hoặc ném lỗi tuỳ policy.
    // Trong thực tế, AI phải có file model.
}

builder.Services.AddMemoryCache(); // Register IMemoryCache for PlateCacheService

builder.Services.AddSingleton<ParkingSystem.Application.Interfaces.Lpr.IOpenCvPreprocessor, ParkingSystem.Infrastructure.Services.Lpr.OpenCvPreprocessor>();
builder.Services.AddSingleton<ParkingSystem.Application.Interfaces.Lpr.IPaddleOcrReader, ParkingSystem.Infrastructure.Services.Lpr.PaddleOcrReader>();
builder.Services.AddSingleton<ParkingSystem.Application.Interfaces.Lpr.IPlatePostProcessor, ParkingSystem.Infrastructure.Services.Lpr.PlatePostProcessor>();
builder.Services.AddSingleton<ParkingSystem.Application.Interfaces.Lpr.IPlateCacheService, ParkingSystem.Infrastructure.Services.Lpr.PlateCacheService>();
builder.Services.AddSingleton<ParkingSystem.Application.Interfaces.Lpr.IMultiFrameVotingService, ParkingSystem.Infrastructure.Services.Lpr.MultiFrameVotingService>();
builder.Services.AddScoped<ParkingSystem.Application.Interfaces.Lpr.ILicensePlateRecognizer, ParkingSystem.Infrastructure.Services.Lpr.LicensePlateRecognizer>();

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

    // Tự động nhận diện token dù có hay không có prefix "Bearer "
    options.Events = new Microsoft.AspNetCore.Authentication.JwtBearer.JwtBearerEvents
    {
        OnMessageReceived = context =>
        {
            var authHeader = context.Request.Headers["Authorization"].FirstOrDefault();
            if (!string.IsNullOrEmpty(authHeader) && !authHeader.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase))
            {
                // Nếu gửi token thẳng (không có "Bearer ") → gán vào Token để middleware xử lý
                context.Token = authHeader;
            }
            return Task.CompletedTask;
        }
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

        // Bỏ đoạn Seed Data tự động theo yêu cầu của User vì Database đã có dữ liệu.
        // Bạn có thể chạy lại file seed.sql thủ công nếu muốn Reset Database.
    }
    catch (Exception ex)
    {
        logger.LogError(ex, "❌ Database khởi tạo THẤT BẠI — {Message}", ex.Message);
    }
}

// Configure the HTTP request pipeline.
app.UseCors("AllowAll");



// Allow CORS preflight OPTIONS requests to pass through before auth
app.Use(async (context, next) =>
{
    if (context.Request.Method == "OPTIONS")
    {
        context.Response.StatusCode = 200;
        await context.Response.CompleteAsync();
        return;
    }
    await next();
});

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

app.UseAuthentication();
app.UseAuthorization();


app.MapControllers();

app.Run();
