using Microsoft.EntityFrameworkCore;
using ParkingSystem.Domain.Entities;

namespace ParkingSystem.Infrastructure.Data;

public class ApplicationDbContext : DbContext
{
    public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options) : base(options) { }

    public DbSet<User> Users { get; set; }
    public DbSet<RefreshToken> RefreshTokens { get; set; }
    public DbSet<OtpCode> OtpCodes { get; set; }
    public DbSet<UserBankAccount> UserBankAccounts { get; set; }
    public DbSet<Building> Buildings { get; set; }
    public DbSet<Floor> Floors { get; set; }
    public DbSet<VehicleType> VehicleTypes { get; set; }
    public DbSet<ParkingSlot> ParkingSlots { get; set; }
    public DbSet<PricingPolicy> PricingPolicies { get; set; }
    public DbSet<PriceSetting> PriceSettings { get; set; }
    public DbSet<ParkingSession> ParkingSessions { get; set; }
    public DbSet<Reservation> Reservations { get; set; }
    public DbSet<Payment> Payments { get; set; }
    public DbSet<Notification> Notifications { get; set; }
    public DbSet<Vehicle> Vehicles { get; set; }
    public DbSet<FavoriteSlot> FavoriteSlots { get; set; }
    public DbSet<ReservationLog> ReservationLogs { get; set; }
    public DbSet<WalletTransaction> WalletTransactions { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // Configure relations and constraints
        modelBuilder.Entity<ParkingSession>()
            .HasOne(ps => ps.Driver)
            .WithMany(u => u.DriverSessions)
            .HasForeignKey(ps => ps.DriverId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<ParkingSession>()
            .HasOne(ps => ps.Staff)
            .WithMany(u => u.HandledSessions)
            .HasForeignKey(ps => ps.StaffId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<Reservation>()
            .HasOne(r => r.Driver)
            .WithMany(u => u.Reservations)
            .HasForeignKey(r => r.DriverId)
            .OnDelete(DeleteBehavior.Restrict);

        // Session → Reservation (optional FK)
        modelBuilder.Entity<ParkingSession>()
            .HasOne(ps => ps.Reservation)
            .WithMany()
            .HasForeignKey(ps => ps.ReservationId)
            .OnDelete(DeleteBehavior.SetNull);

        // Reservation → VehicleType
        modelBuilder.Entity<Reservation>()
            .HasOne(r => r.VehicleType)
            .WithMany()
            .HasForeignKey(r => r.VehicleTypeId)
            .OnDelete(DeleteBehavior.Restrict);
            
        modelBuilder.Entity<ParkingSession>()
            .Property(p => p.TotalFee)
            .HasColumnType("decimal(18,2)");
            
        modelBuilder.Entity<ParkingSession>()
            .Property(p => p.EstimatedFee)
            .HasColumnType("decimal(18,2)");
            
        modelBuilder.Entity<PricingPolicy>()
            .Property(p => p.BlockPrice)
            .HasColumnType("decimal(18,2)");
            
        modelBuilder.Entity<PricingPolicy>()
            .Property(p => p.HourlyRate)
            .HasColumnType("decimal(18,2)");
            
        modelBuilder.Entity<PricingPolicy>()
            .Property(p => p.DailyMaxRate)
            .HasColumnType("decimal(18,2)");
            
        modelBuilder.Entity<Payment>()
            .Property(p => p.Amount)
            .HasColumnType("decimal(18,2)");

        modelBuilder.Entity<Payment>()
            .HasIndex(p => p.PayOSOrderCode)
            .IsUnique();

        modelBuilder.Entity<Payment>()
            .HasOne(p => p.ParkingSession)
            .WithMany(ps => ps.Payments)
            .HasForeignKey(p => p.ParkingSessionId)
            .OnDelete(DeleteBehavior.SetNull);

        // Payment → Reservation (optional FK)
        modelBuilder.Entity<Payment>()
            .HasOne(p => p.Reservation)
            .WithMany()
            .HasForeignKey(p => p.ReservationId)
            .OnDelete(DeleteBehavior.SetNull);

        // PriceSetting → VehicleType
        modelBuilder.Entity<PriceSetting>()
            .HasOne(ps => ps.VehicleType)
            .WithMany(vt => vt.PriceSettings)
            .HasForeignKey(ps => ps.VehicleTypeId)
            .OnDelete(DeleteBehavior.Restrict);

        // PriceSetting → User (UpdatedBy)
        modelBuilder.Entity<PriceSetting>()
            .HasOne(ps => ps.UpdatedByUser)
            .WithMany()
            .HasForeignKey(ps => ps.UpdatedBy)
            .OnDelete(DeleteBehavior.SetNull);

        modelBuilder.Entity<PriceSetting>()
            .Property(p => p.DayPassPrice)
            .HasColumnType("decimal(18,2)");

        modelBuilder.Entity<PriceSetting>()
            .Property(p => p.NightPassPrice)
            .HasColumnType("decimal(18,2)");

        modelBuilder.Entity<PriceSetting>()
            .Property(p => p.DailyMaxPrice)
            .HasColumnType("decimal(18,2)");

        // WalletTransaction
        modelBuilder.Entity<WalletTransaction>()
            .Property(w => w.Amount)
            .HasColumnType("decimal(18,2)");

        modelBuilder.Entity<WalletTransaction>()
            .HasOne(w => w.User)
            .WithMany(u => u.WalletTransactions)
            .HasForeignKey(w => w.UserId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<WalletTransaction>()
            .HasOne(w => w.RelatedPayment)
            .WithMany()
            .HasForeignKey(w => w.RelatedPaymentId)
            .OnDelete(DeleteBehavior.SetNull);

        // RefreshToken → User (cascade delete khi xóa user)
        modelBuilder.Entity<RefreshToken>()
            .HasOne(rt => rt.User)
            .WithMany(u => u.RefreshTokens)
            .HasForeignKey(rt => rt.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        // Index trên Token để tìm nhanh khi refresh
        modelBuilder.Entity<RefreshToken>()
            .HasIndex(rt => rt.Token)
            .IsUnique();

        // User → Vehicle
        modelBuilder.Entity<Vehicle>()
            .HasOne(v => v.Driver)
            .WithMany(u => u.Vehicles)
            .HasForeignKey(v => v.DriverId)
            .OnDelete(DeleteBehavior.Cascade);

        // Vehicle → VehicleType
        modelBuilder.Entity<Vehicle>()
            .HasOne(v => v.VehicleType)
            .WithMany()
            .HasForeignKey(v => v.VehicleTypeId)
            .OnDelete(DeleteBehavior.Restrict);

        // Reservation → Vehicle (optional)
        modelBuilder.Entity<Reservation>()
            .HasOne(r => r.Vehicle)
            .WithMany()
            .HasForeignKey(r => r.VehicleId)
            .OnDelete(DeleteBehavior.SetNull);

        // FavoriteSlot → Driver
        modelBuilder.Entity<FavoriteSlot>()
            .HasOne(f => f.Driver)
            .WithMany()
            .HasForeignKey(f => f.DriverId)
            .OnDelete(DeleteBehavior.Cascade);

        // FavoriteSlot → ParkingSlot
        modelBuilder.Entity<FavoriteSlot>()
            .HasOne(f => f.ParkingSlot)
            .WithMany()
            .HasForeignKey(f => f.ParkingSlotId)
            .OnDelete(DeleteBehavior.Cascade);

        // Unique: 1 Driver chỉ có 1 record cho mỗi Slot
        modelBuilder.Entity<FavoriteSlot>()
            .HasIndex(f => new { f.DriverId, f.ParkingSlotId })
            .IsUnique();

        // User (Staff) → AssignedBuilding (nhiều Staff → 1 Building)
        modelBuilder.Entity<User>()
            .HasOne(u => u.AssignedBuilding)
            .WithMany(b => b.AssignedStaffs)
            .HasForeignKey(u => u.AssignedBuildingId)
            .OnDelete(DeleteBehavior.SetNull);
    }
}
