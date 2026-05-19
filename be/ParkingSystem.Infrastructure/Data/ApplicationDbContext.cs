using Microsoft.EntityFrameworkCore;
using ParkingSystem.Domain.Entities;

namespace ParkingSystem.Infrastructure.Data;

public class ApplicationDbContext : DbContext
{
    public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options) : base(options) { }

    public DbSet<User> Users { get; set; }
    public DbSet<Building> Buildings { get; set; }
    public DbSet<Floor> Floors { get; set; }
    public DbSet<VehicleType> VehicleTypes { get; set; }
    public DbSet<ParkingSlot> ParkingSlots { get; set; }
    public DbSet<PricingPolicy> PricingPolicies { get; set; }
    public DbSet<ParkingSession> ParkingSessions { get; set; }
    public DbSet<Reservation> Reservations { get; set; }
    public DbSet<Payment> Payments { get; set; }

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
    }
}
