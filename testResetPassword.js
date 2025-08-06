import dotenv from 'dotenv';
import fetch from 'node-fetch';

dotenv.config();

const BASE_URL = 'http://localhost:3001/api/auth';

async function testForgotPasswordFlow() {
  console.log('🔐 Testing Forgot Password Flow...\n');

  try {
    // Step 1: Test forgot password with a registered email
    console.log('Step 1: Requesting OTP...');
    const forgotResponse = await fetch(`${BASE_URL}/forgot-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'superadmin@healthcareplus.com' // Using the admin email we created
      }),
    });

    const forgotData = await forgotResponse.json();
    console.log('Forgot Password Response:', forgotData);

    if (!forgotResponse.ok) {
      throw new Error(`Forgot password failed: ${forgotData.message}`);
    }

    // Get OTP from development response (if available)
    const otp = forgotData.devOTP || '123456'; // fallback for testing
    console.log(`✅ OTP sent successfully. OTP: ${otp}\n`);

    // Step 2: Test OTP verification
    console.log('Step 2: Verifying OTP...');
    const verifyResponse = await fetch(`${BASE_URL}/verify-otp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'superadmin@healthcareplus.com',
        otp: otp
      }),
    });

    const verifyData = await verifyResponse.json();
    console.log('OTP Verification Response:', verifyData);

    if (!verifyResponse.ok) {
      throw new Error(`OTP verification failed: ${verifyData.message}`);
    }

    const resetToken = verifyData.resetToken;
    console.log(`✅ OTP verified successfully. Reset token: ${resetToken.substring(0, 10)}...\n`);

    // Step 3: Test password reset
    console.log('Step 3: Resetting password...');
    const resetResponse = await fetch(`${BASE_URL}/reset-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        resetToken: resetToken,
        password: 'NewPassword123!',
        confirmPassword: 'NewPassword123!'
      }),
    });

    const resetData = await resetResponse.json();
    console.log('Password Reset Response:', resetData);

    if (!resetResponse.ok) {
      throw new Error(`Password reset failed: ${resetData.message}`);
    }

    console.log('✅ Password reset successful!\n');

    // Step 4: Test login with new password
    console.log('Step 4: Testing login with new password...');
    const loginResponse = await fetch(`${BASE_URL}/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'superadmin@healthcareplus.com',
        password: 'NewPassword123!'
      }),
    });

    const loginData = await loginResponse.json();
    console.log('Login Response:', loginData.status);

    if (!loginResponse.ok) {
      throw new Error(`Login failed: ${loginData.message}`);
    }

    console.log('✅ Login with new password successful!\n');

    // Reset password back to original for consistency
    console.log('Resetting password back to original...');
    // You can uncomment this if you want to reset back
    /*
    const resetBackResponse = await fetch(`${BASE_URL}/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'superadmin@healthcareplus.com' }),
    });
    // ... continue with reset back flow
    */

    console.log('🎉 All tests passed! Forgot password flow is working correctly.');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    
    // Test validation errors
    console.log('\n📋 Testing validation errors...');
    await testValidationErrors();
  }
}

async function testValidationErrors() {
  try {
    // Test invalid email
    console.log('Testing invalid email...');
    const response1 = await fetch(`${BASE_URL}/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'invalid-email' }),
    });
    const data1 = await response1.json();
    console.log('Invalid email response:', data1.message);

    // Test invalid OTP
    console.log('Testing invalid OTP...');
    const response2 = await fetch(`${BASE_URL}/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@test.com', otp: 'abc' }),
    });
    const data2 = await response2.json();
    console.log('Invalid OTP response:', data2.message);

    // Test weak password
    console.log('Testing weak password...');
    const response3 = await fetch(`${BASE_URL}/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        resetToken: 'dummy-token',
        password: '123',
        confirmPassword: '123'
      }),
    });
    const data3 = await response3.json();
    console.log('Weak password response:', data3.message);

    console.log('✅ Validation tests completed.');

  } catch (error) {
    console.error('Validation test error:', error.message);
  }
}

// Run the test
testForgotPasswordFlow();
