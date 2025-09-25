import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Approval from '../models/Approval.js';

// Load environment variables
dotenv.config();

const clearApprovals = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/healthcareplus');
    console.log('Connected to MongoDB');

    // Delete all approval requests
    const result = await Approval.deleteMany({});
    console.log(`✅ Successfully deleted ${result.deletedCount} approval requests`);

    // Close connection
    await mongoose.connection.close();
    console.log('✅ Database connection closed');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error clearing approvals:', error);
    process.exit(1);
  }
};

// Run the script
clearApprovals();