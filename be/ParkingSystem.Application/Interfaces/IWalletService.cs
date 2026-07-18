using System;
using System.Threading.Tasks;
using ParkingSystem.Application.DTOs.Wallet;

namespace ParkingSystem.Application.Interfaces;

public interface IWalletService
{
    Task<WalletBalanceDto> GetMyBalanceAsync(Guid userId);
    Task<(bool Success, string Message)> WithdrawAsync(Guid userId, WithdrawRequestDto request);
}
