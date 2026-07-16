const http = require('http');

async function testApi() {
  try {
    const loginRes = await fetch('http://localhost:5237/api/Auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'staff@parkingsystem.com', password: 'Password@123' })
    });
    const loginData = await loginRes.json();
    console.log("Login data:", loginData);
    const token = loginData.token || loginData.data?.token;

    console.log("Token acquired.");

    const vtRes = await fetch('http://localhost:5237/api/VehicleTypes');
    const vtData = await vtRes.json();
    const carId = vtData.find(v => v.name.toLowerCase() === 'car').id;

    const checkInRes = await fetch('http://localhost:5237/api/checkin/walk-in', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        licensePlate: "TEST-123",
        vehicleTypeId: carId
      })
    });
    
    const text = await checkInRes.text();
    console.log("Status:", checkInRes.status);
    console.log("Response:", text);

  } catch (err) {
    console.error("Script error:", err);
  }
}

testApi();
