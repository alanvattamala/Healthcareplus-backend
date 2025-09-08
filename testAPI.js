import fetch from 'node-fetch';

const testAPI = async () => {
  try {
    const response = await fetch('http://localhost:3001/api/admin/users', {
      headers: {
        'Authorization': 'Bearer demo-admin-token-123',
        'Content-Type': 'application/json'
      }
    });

    if (response.ok) {
      const data = await response.json();
      console.log('✅ API Response:', JSON.stringify(data, null, 2));
      console.log('📊 Total users found:', data.data.users.length);
    } else {
      const error = await response.text();
      console.log('❌ API Error:', response.status, error);
    }
  } catch (error) {
    console.error('❌ Network Error:', error.message);
  }
};

testAPI();
