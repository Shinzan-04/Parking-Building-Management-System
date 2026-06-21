using System;
using System.Collections.Generic;

namespace ParkingSystem.Application.DTOs.Wallet;

public class WalletTransactionDto
{
    public Guid Id { get; set; }
    public decimal Amount { get; set; }
    public string Type { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
}

public class WalletBalanceDto
{
    public decimal Balance { get; set; }
    public List<WalletTransactionDto> Transactions { get; set; } = new List<WalletTransactionDto>();
}

public class WithdrawRequestDto
{
    public decimal Amount { get; set; }
}
public class DepositRequestDto
{
    public decimal Amount { get; set; }
}
