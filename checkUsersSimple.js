import mongoose from 'mongoose';
import User from './models/User.js';
import dotenv from 'dotenv';

dotenv.config();

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ MongoDB Connected');
    
    const users = await User.find({});
    console.log('Total users:', users.length);
    
    if (users.length === 0) {
      console.log('No users found in database');
    } else {
      users.forEach(user => {
        console.log(`${user.firstName} ${user.lastName} - ${user.email} - ${user.userType} - ${user.verificationStatus || 'N/A'}`);
      });
    }
    
    process.exit();
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
};

connectDB();
