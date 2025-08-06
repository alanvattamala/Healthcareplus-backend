import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import readline from 'readline';
import User from '../models/User.js';

// Load environment variables
dotenv.config();

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (prompt) => {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
};

const createCustomAdmin = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);

    console.log('✅ Connected to MongoDB');
    console.log('🛠️ Create Custom Admin User\n');

    // Get admin details from user
    const firstName = await question('Enter first name (default: Super): ') || 'Super';
    const lastName = await question('Enter last name (default: Admin): ') || 'Admin';
    const email = await question('Enter email address: ');
    
    if (!email) {
      console.log('❌ Email is required!');
      process.exit(1);
    }

    const password = await question('Enter password (min 8 characters): ');
    
    if (!password || password.length < 8) {
      console.log('❌ Password must be at least 8 characters!');
      process.exit(1);
    }

    const phone = await question('Enter phone number (default: +1234567890): ') || '+1234567890';
    
    console.log('\nSelect admin level:');
    console.log('1. Super Admin (full access)');
    console.log('2. Moderator (limited access)');
    console.log('3. Support (basic access)');
    
    const levelChoice = await question('Enter choice (1-3, default: 1): ') || '1';
    
    let adminLevel, permissions;
    
    switch (levelChoice) {
      case '1':
        adminLevel = 'super';
        permissions = ['user_management', 'doctor_verification', 'content_management', 'analytics', 'system_settings'];
        break;
      case '2':
        adminLevel = 'moderator';
        permissions = ['user_management', 'doctor_verification', 'content_management'];
        break;
      case '3':
        adminLevel = 'support';
        permissions = ['user_management'];
        break;
      default:
        console.log('❌ Invalid choice!');
        process.exit(1);
    }

    // Check if admin with this email already exists
    const existingUser = await User.findOne({ email });

    if (existingUser) {
      console.log('❌ User with this email already exists!');
      process.exit(1);
    }

    // Admin data
    const adminData = {
      firstName,
      lastName,
      email,
      password,
      phone,
      userType: 'admin',
      adminLevel,
      permissions,
      isActive: true,
      isEmailVerified: true,
      verificationStatus: 'verified'
    };

    // Create admin
    const admin = await User.create(adminData);

    console.log('\n🎉 Admin user created successfully!');
    console.log('👤 Name:', `${admin.firstName} ${admin.lastName}`);
    console.log('📧 Email:', admin.email);
    console.log('📱 Phone:', admin.phone);
    console.log('🔰 Level:', admin.adminLevel);
    console.log('🔑 Permissions:', admin.permissions.join(', '));
    console.log('🆔 Admin ID:', admin._id);
    console.log('\n⚠️ Please save these details securely!');

    // Close connection
    rl.close();
    await mongoose.connection.close();
    console.log('📴 Database connection closed');
    process.exit(0);

  } catch (error) {
    console.error('❌ Error creating admin:', error.message);
    
    if (error.code === 11000) {
      console.log('📧 Email already exists in the database');
    }
    
    rl.close();
    process.exit(1);
  }
};

// Handle keyboard interrupt
process.on('SIGINT', async () => {
  console.log('\n⚠️ Process interrupted');
  rl.close();
  await mongoose.connection.close();
  process.exit(0);
});

// Run the script
createCustomAdmin();
