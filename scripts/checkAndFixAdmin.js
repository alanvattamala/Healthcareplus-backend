import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import User from '../models/User.js';

// Load environment variables
dotenv.config();

const checkAndFixAdmin = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Find the admin user
    const admin = await User.findOne({ 
      email: 'superadmin@healthcareplus.com'
    }).select('+password');

    if (!admin) {
      console.log('❌ No admin user found with email: superadmin@healthcareplus.com');
      console.log('📝 Make sure you inserted the document correctly');
      process.exit(1);
    }

    console.log('👤 Admin user found:');
    console.log('📧 Email:', admin.email);
    console.log('🆔 ID:', admin._id);
    console.log('👥 User Type:', admin.userType);
    console.log('🔰 Admin Level:', admin.adminLevel);
    console.log('✅ Active:', admin.isActive);
    console.log('📧 Email Verified:', admin.isEmailVerified);
    
    // Test password verification
    const testPassword = 'SuperAdmin@123';
    console.log('\n🔐 Testing password verification...');
    
    try {
      const isPasswordCorrect = await bcrypt.compare(testPassword, admin.password);
      console.log('🔑 Password test result:', isPasswordCorrect ? '✅ CORRECT' : '❌ INCORRECT');
      
      if (!isPasswordCorrect) {
        console.log('\n🔧 Fixing password hash...');
        const newPasswordHash = await bcrypt.hash(testPassword, 12);
        
        await User.updateOne(
          { email: 'superadmin@healthcareplus.com' },
          { password: newPasswordHash }
        );
        
        console.log('✅ Password hash updated successfully!');
        console.log('🔑 You can now login with:');
        console.log('📧 Email: superadmin@healthcareplus.com');
        console.log('🔐 Password: SuperAdmin@123');
      }
    } catch (error) {
      console.log('❌ Error testing password:', error.message);
      console.log('\n🔧 Creating new password hash...');
      
      const newPasswordHash = await bcrypt.hash(testPassword, 12);
      await User.updateOne(
        { email: 'superadmin@healthcareplus.com' },
        { password: newPasswordHash }
      );
      
      console.log('✅ New password hash created and updated!');
    }

    // Close connection
    await mongoose.connection.close();
    console.log('\n📴 Database connection closed');
    process.exit(0);

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
};

// Handle keyboard interrupt
process.on('SIGINT', async () => {
  console.log('\n⚠️ Process interrupted');
  await mongoose.connection.close();
  process.exit(0);
});

checkAndFixAdmin();
