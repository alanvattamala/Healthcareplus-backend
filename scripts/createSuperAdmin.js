import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import User from '../models/User.js';

// Load environment variables
dotenv.config();

const createSuperAdmin = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);

    console.log('✅ Connected to MongoDB');

    // Check if super admin already exists
    const existingAdmin = await User.findOne({ 
      userType: 'admin', 
      adminLevel: 'super' 
    });

    if (existingAdmin) {
      console.log('⚠️ Super admin already exists:', existingAdmin.email);
      process.exit(0);
    }

    // Super admin data
    const superAdminData = {
      firstName: 'Super',
      lastName: 'Admin',
      email: 'superadmin@healthcareplus.com',
      password: 'SuperAdmin@123', // You should change this password after first login
      phone: '+1234567890',
      userType: 'admin',
      adminLevel: 'super',
      permissions: [
        'user_management', 
        'doctor_verification', 
        'content_management', 
        'analytics', 
        'system_settings'
      ],
      isActive: true,
      isEmailVerified: true,
      verificationStatus: 'verified'
    };

    // Create super admin
    const superAdmin = await User.create(superAdminData);

    console.log('🎉 Super admin created successfully!');
    console.log('📧 Email:', superAdmin.email);
    console.log('🔑 Password: SuperAdmin@123');
    console.log('⚠️ IMPORTANT: Please change the password after first login!');
    console.log('🆔 Admin ID:', superAdmin._id);

    // Close connection
    await mongoose.connection.close();
    console.log('📴 Database connection closed');
    process.exit(0);

  } catch (error) {
    console.error('❌ Error creating super admin:', error.message);
    
    if (error.code === 11000) {
      console.log('📧 Email already exists in the database');
    }
    
    process.exit(1);
  }
};

// Handle keyboard interrupt
process.on('SIGINT', async () => {
  console.log('\n⚠️ Process interrupted');
  await mongoose.connection.close();
  process.exit(0);
});

// Run the script
createSuperAdmin();
