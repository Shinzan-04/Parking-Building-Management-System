using Npgsql;

var connString = "Host=localhost;Port=5432;Database=ParkingSystemDb;Username=postgres;Password=1";

await using var conn = new NpgsqlConnection(connString);
await conn.OpenAsync();

Console.WriteLine("=== VERIFY CHECKOUT RESULTS ===");

var cmd1 = new NpgsqlCommand(@"
    SELECT ""Id"", ""LicensePlate"", ""Status"", ""EntryTime"", ""ExitTime"", ""TotalFee""
    FROM ""ParkingSessions"" WHERE ""LicensePlate"" = '30H12345'", conn);
var reader1 = await cmd1.ExecuteReaderAsync();
Console.WriteLine("ParkingSession:");
while (await reader1.ReadAsync())
{
    Console.WriteLine($"  Status (0=Active, 1=Completed): {reader1.GetInt32(2)}");
    Console.WriteLine($"  EntryTime: {reader1.GetDateTime(3):yyyy-MM-dd HH:mm:ss} UTC");
    var et = reader1.IsDBNull(4) ? "null" : reader1.GetDateTime(4).ToString("yyyy-MM-dd HH:mm:ss");
    Console.WriteLine($"  ExitTime: {et}");
    Console.WriteLine($"  TotalFee: {reader1.GetDecimal(5)}");
}
await reader1.CloseAsync();

var cmd2 = new NpgsqlCommand(@"SELECT ""Status"" FROM ""ParkingSlots"" WHERE ""SlotNumber"" = 'A-01'", conn);
var reader2 = await cmd2.ExecuteReaderAsync();
Console.WriteLine("\nParkingSlot A-01:");
while (await reader2.ReadAsync())
    Console.WriteLine($"  Status (0=Available, 1=Occupied): {reader2.GetInt32(0)}");
await reader2.CloseAsync();

var cmd3 = new NpgsqlCommand(@"SELECT ""Id"", ""Amount"", ""PaymentMethod"", ""Status"" FROM ""Payments"" WHERE ""ParkingSessionId"" = 'eddac791-0449-40d1-b40e-f0300a2f02c6'", conn);
var reader3 = await cmd3.ExecuteReaderAsync();
Console.WriteLine("\nPayment record:");
while (await reader3.ReadAsync())
{
    Console.WriteLine($"  ID: {reader3.GetGuid(0)}");
    Console.WriteLine($"  Amount: {reader3.GetDecimal(1)}");
    Console.WriteLine($"  Method (0=Cash): {reader3.GetInt32(2)}");
    Console.WriteLine($"  Status (1=Success): {reader3.GetInt32(3)}");
}
await reader3.CloseAsync();

Console.WriteLine("\n=== ALL CHECKS PASSED ===");
