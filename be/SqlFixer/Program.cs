using System;
using System.Threading.Tasks;
using Npgsql;

const string connStr =
    "Host=ep-round-water-ap39ta75-pooler.c-7.us-east-1.aws.neon.tech;" +
    "Database=neondb;Username=neondb_owner;Password=npg_8tVTCMBr1jlo;" +
    "SSL Mode=Require;Trust Server Certificate=true";

await using var conn = new NpgsqlConnection(connStr);
await conn.OpenAsync();

// Show floors with their building
await using var cmd = conn.CreateCommand();
cmd.CommandText = @"
    SELECT b.""Name"" AS building, f.""Name"" AS floor, f.""FloorIndex"",
           COUNT(ps.""Id"") AS slot_count
    FROM ""Floors"" f
    JOIN ""Buildings"" b ON b.""Id"" = f.""BuildingId""
    LEFT JOIN ""ParkingSlots"" ps ON ps.""FloorId"" = f.""Id"" AND ps.""IsDeleted"" = false
    WHERE f.""IsDeleted"" = false
    GROUP BY b.""Name"", f.""Name"", f.""FloorIndex""
    ORDER BY b.""Name"", f.""FloorIndex""";
await using var r = await cmd.ExecuteReaderAsync();
Console.WriteLine($"{"Building",-25} {"Floor",-20} {"Idx",4} {"Slots",6}");
Console.WriteLine(new string('-', 60));
while (await r.ReadAsync())
    Console.WriteLine($"{r.GetString(0),-25} {r.GetString(1),-20} {r.GetInt32(2),4} {r.GetInt64(3),6}");
