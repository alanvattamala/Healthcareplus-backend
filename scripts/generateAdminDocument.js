import bcrypt from 'bcryptjs';

const generateAdminDocument = async () => {
  console.log('🔐 Generating Super Admin Document for Manual Insertion\n');
  
  // Generate password hash
  const password = 'SuperAdmin@123';
  const passwordHash = await bcrypt.hash(password, 12);
  
  const currentDate = new Date().toISOString();
  
  const superAdminDocument = {
    firstName: "Super",
    lastName: "Admin",
    email: "superadmin@healthcareplus.com",
    password: passwordHash,
    phone: "+1234567890",
    userType: "admin",
    adminLevel: "super",
    permissions: [
      "user_management",
      "doctor_verification",
      "content_management",
      "analytics",
      "system_settings"
    ],
    isActive: true,
    isEmailVerified: true,
    verificationStatus: "verified",
    loginAttempts: 0,
    lastLogin: currentDate,
    createdAt: currentDate,
    updatedAt: currentDate
  };

  console.log('📋 Copy and paste this document into MongoDB Atlas:');
  console.log('=' .repeat(60));
  console.log(JSON.stringify(superAdminDocument, null, 2));
  console.log('=' .repeat(60));
  
  console.log('\n🔑 Login Credentials:');
  console.log(`📧 Email: ${superAdminDocument.email}`);
  console.log(`🔐 Password: ${password}`);
  
  console.log('\n📝 Manual Insertion Steps:');
  console.log('1. Go to https://cloud.mongodb.com');
  console.log('2. Navigate to your cluster → Browse Collections');
  console.log('3. Database: healthcareplus');
  console.log('4. Collection: users');
  console.log('5. Click "INSERT DOCUMENT"');
  console.log('6. Switch to "JSON View"');
  console.log('7. Paste the document above');
  console.log('8. Click "Insert"');
};

// Function to generate hash for custom password
const generateCustomPasswordHash = async (customPassword) => {
  if (!customPassword) {
    console.log('\n💡 To generate a hash for a custom password, call:');
    console.log('generateCustomPasswordHash("YourPasswordHere")');
    return;
  }
  
  const hash = await bcrypt.hash(customPassword, 12);
  console.log(`\n🔐 Password Hash for "${customPassword}":`);
  console.log(hash);
  console.log('\nReplace the "password" field in the document above with this hash.');
};

// Run the generator
generateAdminDocument();

// Uncomment the line below and replace with your desired password to generate a custom hash
// generateCustomPasswordHash("YourCustomPassword");

export { generateCustomPasswordHash };
