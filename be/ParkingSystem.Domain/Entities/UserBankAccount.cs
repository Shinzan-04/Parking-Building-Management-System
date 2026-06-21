using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ParkingSystem.Domain.Entities;

public class UserBankAccount : BaseEntity
{
    public Guid UserId { get; set; }
    
    [Required]
    [MaxLength(50)]
    public string BankBin { get; set; } = string.Empty;
    
    [Required]
    [MaxLength(100)]
    public string BankName { get; set; } = string.Empty;
    
    [Required]
    [MaxLength(50)]
    public string AccountNumber { get; set; } = string.Empty;
    
    [Required]
    [MaxLength(100)]
    public string AccountHolderName { get; set; } = string.Empty;
    
    public bool IsDefault { get; set; } = false;

    // Navigation property
    [ForeignKey("UserId")]
    public User? User { get; set; }
}
