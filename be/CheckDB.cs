using System;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using ParkingSystem.Infrastructure.Data;

namespace CheckDB
{
    class Program
    {
        static async Task Main(string[] args)
        {
            var host = Host.CreateDefaultBuilder(args)
                .ConfigureServices((hostContext, services) =>
                {
                    services.AddDbContext<ApplicationDbContext>(options =>
                        options.UseNpgsql("Host=ep-round-water-ap39ta75-pooler.c-7.us-east-1.aws.neon.tech;Database=neondb;Username=neondb_owner;Password=npg_8tVTCMBr1jlo;SSL Mode=Require;Trust Server Certificate=true"));
                })
                .Build();

            using var scope = host.Services.CreateScope();
            var dbContext = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            try
            {
                var conn = dbContext.Database.GetDbConnection();
                await conn.OpenAsync();
                var cmd = conn.CreateCommand();
                cmd.CommandText = "SELECT \"SessionCode\", \"CheckInMethod\", \"EntryTime\", \"GracePeriodEndTime\", \"ReservationId\" FROM \"ParkingSessions\" ORDER BY \"EntryTime\" DESC LIMIT 5;";
                using var reader = await cmd.ExecuteReaderAsync();
                while (await reader.ReadAsync())
                {
                    Console.WriteLine($"SessionCode: {reader[0]}, Method: {reader[1]}, EntryTime: {reader[2]}, GracePeriodEndTime: {reader[3]}, ReservationId: {reader[4]}");
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine(ex.ToString());
            }
        }
    }
}
