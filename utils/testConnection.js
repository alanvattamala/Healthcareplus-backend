import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const testConnection = async () => {
  try {
    console.log('🔄 Testing MongoDB connection...');
    console.log('Connection string:', process.env.MONGODB_URI?.replace(/:[^:]*@/, ':****@'));
    
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    
    console.log('✅ MongoDB connection successful!');
    
    // Test basic operations
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log('📋 Available collections:', collections.map(c => c.name));
    
    await mongoose.connection.close();
    console.log('📴 Connection closed successfully');
    
  } catch (error) {
    console.error('❌ MongoDB connection failed:');
    console.error('Error message:', error.message);
    console.error('Error code:', error.code);
    
    if (error.message.includes('authentication')) {
      console.log('\n💡 Authentication tips:');
      console.log('- Check your username and password in the connection string');
      console.log('- Make sure URL encoding is correct (# should be %23)');
      console.log('- Verify your MongoDB Atlas user has proper permissions');
    }
    
    if (error.message.includes('network')) {
      console.log('\n💡 Network tips:');
      console.log('- Check your internet connection');
      console.log('- Verify MongoDB Atlas IP whitelist settings');
      console.log('- Try using 0.0.0.0/0 for testing (not recommended for production)');
    }
    
    process.exit(1);
  }
};

testConnection();
