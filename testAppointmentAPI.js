import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();

const testAppointmentAPI = async () => {
  try {
    // You'll need to replace this with a valid doctor token
    const token = 'your-doctor-jwt-token-here';
    const today = new Date().toISOString().split('T')[0];
    
    console.log('🔍 Testing appointment API for date:', today);
    console.log('🌐 URL:', `http://localhost:3000/api/appointments/doctor-appointments?date=${today}`);
    
    const response = await fetch(`http://localhost:3000/api/appointments/doctor-appointments?date=${today}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });

    console.log('📡 Response status:', response.status);
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ API Response:', JSON.stringify(data, null, 2));
      console.log('📊 Appointments found:', data.count);
    } else {
      const error = await response.text();
      console.log('❌ API Error:', response.status, error);
    }
  } catch (error) {
    console.error('❌ Network Error:', error.message);
  }
};

// Uncomment the line below and add a valid token to test
// testAppointmentAPI();

console.log('💡 To test the API:');
console.log('1. Start the server: npm start');
console.log('2. Login as a doctor to get a valid token');
console.log('3. Replace the token in this file');
console.log('4. Uncomment the testAppointmentAPI() call');
console.log('5. Run: node testAppointmentAPI.js');