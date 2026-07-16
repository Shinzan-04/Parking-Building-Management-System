using System;
using ParkingSystem.Domain.Enums;

namespace ParkingSystem.Domain.Entities;

public class Vehicle : BaseEntity
{
    public Guid DriverId { get; set; }
    public Guid VehicleTypeId { get; set; }
    
    public string PlateNumber { get; set; } = string.Empty;
    public bool IsPrimary { get; set; } = false;

    public User Driver { get; set; } = null!;
    public VehicleType VehicleType { get; set; } = null!;
}
