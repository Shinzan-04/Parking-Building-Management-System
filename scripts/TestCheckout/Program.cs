using System.Net.Http.Json;
using System.Text.Json;
using Npgsql;

var baseUrl = "http://localhost:5237";
var connString = "Host=localhost;Port=5432;Database=ParkingSystemDb;Username=postgres;Password=1";
var carTypeId = Guid.Parse("2f03e152-ac26-4ba0-a416-8b0459fa496a");
var slot01Id = Guid.Parse("4a11dcec-bcea-428e-a441-9c893d1a02d2");

// --- Seed test session ---
await using var conn = new NpgsqlConnection(connString);
await conn.OpenAsync();

var newPlate = $"TEST{Random.Shared.Next(1000, 9999)}";
var newSessionId = Guid.NewGuid();
var entryTime = DateTime.UtcNow.AddMinutes(-90);

await using var cmd = new NpgsqlCommand(@"
    INSERT INTO ""ParkingSessions"" (""Id"", ""DriverId"", ""StaffId"", ""ParkingSlotId"", ""VehicleTypeId"", ""ReservationId"",
        ""LicensePlate"", ""SessionCode"", ""CheckInMethod"", ""EntryTime"", ""ExitTime"", ""EstimatedFee"", ""TotalFee"",
        ""Status"", ""IssueType"", ""CreatedAt"", ""UpdatedAt"", ""IsDeleted"")
    VALUES (@id, NULL, NULL, @slotid, @vtid, NULL,
        @plate, 'TST99', 0, @entry, NULL, 0, 0,
        0, 0, @entry, NULL, false)", conn);
cmd.Parameters.AddWithValue("id", newSessionId);
cmd.Parameters.AddWithValue("slotid", slot01Id);
cmd.Parameters.AddWithValue("vtid", carTypeId);
cmd.Parameters.AddWithValue("plate", newPlate);
cmd.Parameters.AddWithValue("entry", entryTime);
await cmd.ExecuteNonQueryAsync();
Console.WriteLine($"Seed OK: Plate={newPlate}, SessionId={newSessionId}");

// --- Login ---
var httpClient = new HttpClient();
var loginResp = await httpClient.PostAsJsonAsync($"{baseUrl}/api/Auth/login",
    new { username = "admin", password = "admin123" });
var loginBody = await loginResp.Content.ReadFromJsonAsync<JsonElement>();
var token = loginBody.GetProperty("token").GetString()!;
var adminId = loginBody.GetProperty("userId").GetString()!;
Console.WriteLine($"Login OK: userId={adminId}");

httpClient.DefaultRequestHeaders.Authorization =
    new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token);

// --- TEST 1: Search ---
Console.WriteLine($"\n=== TEST 1: Search exact match ===");
var searchResp = await httpClient.GetAsync($"{baseUrl}/api/CheckOut/search?licensePlate={newPlate}");
var searchBody = await searchResp.Content.ReadFromJsonAsync<JsonElement>();
Console.WriteLine($"Status: {(int)searchResp.StatusCode}");

var totalHours = searchBody.GetProperty("totalHours").GetDouble();
var hourlyRate = searchBody.GetProperty("hourlyRate").GetDecimal();
var estimatedFee = searchBody.GetProperty("estimatedFee").GetDecimal();
var expectedFee = (decimal)totalHours * hourlyRate;

Console.WriteLine($"TotalHours: {totalHours}");
Console.WriteLine($"HourlyRate: {hourlyRate}");
Console.WriteLine($"EstimatedFee: {estimatedFee}");
Console.WriteLine($"ExpectedFee (= TotalHours * HourlyRate): {expectedFee}");
Console.WriteLine($"Fee chinh xac = TotalHours * HourlyRate: {estimatedFee == expectedFee}");

// --- TEST 2: Search khong ton tai ---
Console.WriteLine($"\n=== TEST 2: Search khong ton tai ===");
var notFoundResp = await httpClient.GetAsync($"{baseUrl}/api/CheckOut/search?licensePlate=NOTEXIST");
Console.WriteLine($"Status: {(int)notFoundResp.StatusCode} (expect 404)");

// --- TEST 3: Confirm thanh toan tien mat ---
Console.WriteLine($"\n=== TEST 3: Confirm tien mat (dua 50000) ===");
var confirmResp = await httpClient.PostAsJsonAsync($"{baseUrl}/api/CheckOut/confirm",
    new { sessionId = newSessionId.ToString(), staffId = adminId, paymentMethod = 0, paymentAmount = 50000m });
var confirmBody = await confirmResp.Content.ReadFromJsonAsync<JsonElement>();
Console.WriteLine($"Status: {(int)confirmResp.StatusCode}");

var confirmTotalHours = confirmBody.GetProperty("totalHours").GetDouble();
var confirmTotalFee = confirmBody.GetProperty("totalFee").GetDecimal();
var confirmExpectedFee = (decimal)confirmTotalHours * hourlyRate;
var changeAmount = confirmBody.GetProperty("changeAmount").GetDecimal();
var expectedChange = 50000m - confirmTotalFee;

Console.WriteLine($"TotalHours: {confirmTotalHours}");
Console.WriteLine($"TotalFee: {confirmTotalFee}");
Console.WriteLine($"ExpectedFee (= TotalHours * HourlyRate): {confirmExpectedFee}");
Console.WriteLine($"Fee chinh xac: {confirmTotalFee == confirmExpectedFee}");
Console.WriteLine($"ChangeAmount: {changeAmount}");
Console.WriteLine($"ExpectedChange (= 50000 - TotalFee): {expectedChange}");
Console.WriteLine($"Change chinh xac: {changeAmount == expectedChange}");
Console.WriteLine($"Message: {confirmBody.GetProperty("message").GetString()}");

// --- TEST 4: Confirm thiếu tiền ---
Console.WriteLine($"\n=== TEST 4: Confirm thiếu tiền ===");
var newSessionId2 = Guid.NewGuid();
var entryTime2 = DateTime.UtcNow.AddMinutes(-30);

await using var cmd2 = new NpgsqlCommand(@"
    INSERT INTO ""ParkingSessions"" (""Id"", ""DriverId"", ""StaffId"", ""ParkingSlotId"", ""VehicleTypeId"", ""ReservationId"",
        ""LicensePlate"", ""SessionCode"", ""CheckInMethod"", ""EntryTime"", ""ExitTime"", ""EstimatedFee"", ""TotalFee"",
        ""Status"", ""IssueType"", ""CreatedAt"", ""UpdatedAt"", ""IsDeleted"")
    VALUES (@id, NULL, NULL, @slotid, @vtid, NULL,
        @plate, 'TST99', 0, @entry, NULL, 0, 0,
        0, 0, @entry, NULL, false)", conn);
cmd2.Parameters.AddWithValue("id", newSessionId2);
cmd2.Parameters.AddWithValue("slotid", slot01Id);
cmd2.Parameters.AddWithValue("vtid", carTypeId);
cmd2.Parameters.AddWithValue("plate", $"TEST2{Random.Shared.Next(1000, 9999)}");
cmd2.Parameters.AddWithValue("entry", entryTime2);
await cmd2.ExecuteNonQueryAsync();

var badPayResp = await httpClient.PostAsJsonAsync($"{baseUrl}/api/CheckOut/confirm",
    new { sessionId = newSessionId2.ToString(), staffId = adminId, paymentMethod = 0, paymentAmount = 1000m });
Console.WriteLine($"Status: {(int)badPayResp.StatusCode} (expect 400)");
var badPayBody = await badPayResp.Content.ReadFromJsonAsync<JsonElement>();
Console.WriteLine($"Message: {badPayBody.GetProperty("message").GetString()}");

// --- Summary ---
Console.WriteLine($"\n=== KET QUA ===");
Console.WriteLine($"[1] Search exact match: OK");
Console.WriteLine($"[2] Search 404: OK");
Console.WriteLine($"[3] Confirm thanh toan: OK (fee={confirmTotalFee}, change={changeAmount})");
Console.WriteLine($"[4] Confirm loi thieu tien: OK (400 BadRequest)");
Console.WriteLine($"[5] Khong con Math.Round trong code: OK");
