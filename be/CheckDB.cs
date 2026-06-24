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
                cmd.CommandText = "ALTER TABLE \"WalletTransactions\" ADD COLUMN IF NOT EXISTS \"RelatedPaymentId\" uuid NULL;";
                await cmd.ExecuteNonQueryAsync();
                Console.WriteLine("ALTER TABLE executed successfully.");
            }
            catch (Exception ex)
            {
                Console.WriteLine(ex.ToString());
            }
        }
    }
}
