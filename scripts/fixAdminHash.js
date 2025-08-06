import bcrypt from 'bcryptjs';

const generateCorrectHash = async () => {
  const password = 'SuperAdmin@123';
  const hash = await bcrypt.hash(password, 12);
  
  console.log('🔐 Correct Password Hash for SuperAdmin@123:');
  console.log(hash);
  console.log('\n📋 Complete Corrected Document:');
  console.log('=' .repeat(70));
  
  const correctDocument = {
    "_id": { "$oid": "676b8d5a5e8f2c1a3d4b5c6d" }, // MongoDB will auto-generate this, you can remove this line
    "firstName": "Super",
    "lastName": "Admin", 
    "email": "superadmin@healthcareplus.com",
    "password": hash,
    "phone": "+1234567890",
    "userType": "admin",
    "adminLevel": "super",
    "permissions": [
      "user_management",
      "doctor_verification",
      "content_management", 
      "analytics",
      "system_settings"
    ],
    "isActive": true,
    "isEmailVerified": true,
    "verificationStatus": "verified",
    "loginAttempts": 0,
    "lastLogin": new Date().toISOString(),
    "createdAt": new Date().toISOString(),
    "updatedAt": new Date().toISOString()
  };
  
  console.log(JSON.stringify(correctDocument, null, 2));
  console.log('=' .repeat(70));
  
  console.log('\n🔧 Troubleshooting Steps:');
  console.log('1. Delete the existing admin document from MongoDB Atlas');
  console.log('2. Insert this new document with the fresh hash');
  console.log('3. OR update just the password field with the hash above');
  console.log('\n💡 To update just the password in MongoDB Atlas:');
  console.log('1. Find the existing admin document');
  console.log('2. Click "Edit" on the document'); 
  console.log('3. Replace the "password" field value with:');
  console.log(`   "${hash}"`);
  console.log('4. Save the document');
  
  console.log('\n🔑 Login with:');
  console.log('📧 Email: superadmin@healthcareplus.com (exact case)');
  console.log('🔐 Password: SuperAdmin@123 (exact case)');
};

generateCorrectHash();
