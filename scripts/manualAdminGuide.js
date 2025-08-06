// Manual Super Admin Creation Guide
// If you're experiencing MongoDB connection issues, you can manually insert the admin user

/*
1. Connect to your MongoDB Atlas database using MongoDB Compass or the MongoDB shell
2. Navigate to the 'healthcareplus' database
3. Go to the 'users' collection
4. Insert the following document:
*/

const superAdminDocument = {
  "firstName": "Super",
  "lastName": "Admin", 
  "email": "superadmin@healthcareplus.com",
  "password": "$2a$12$LQv3c1yqBWVHxkd0LQ1lqe7/tVR5k5rKfXYh7FaHKd5rK7FjKaVsK", // This is "SuperAdmin@123" hashed
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
  "lastLogin": new Date(),
  "createdAt": new Date(),
  "updatedAt": new Date()
};

console.log("Manual Super Admin Document to Insert:");
console.log("=====================================");
console.log(JSON.stringify(superAdminDocument, null, 2));
console.log("\n📧 Email: superadmin@healthcareplus.com");
console.log("🔑 Password: SuperAdmin@123");
console.log("\nSteps to insert manually:");
console.log("1. Open MongoDB Compass or MongoDB Shell");
console.log("2. Connect to your MongoDB Atlas cluster");
console.log("3. Navigate to 'healthcareplus' database");
console.log("4. Go to 'users' collection");
console.log("5. Click 'Insert Document' and paste the above JSON");
console.log("6. Remove the quotation marks from ObjectId fields if any");
console.log("7. Save the document");

// Alternative: Generate bcrypt hash for custom password
import bcrypt from 'bcryptjs';

const generatePasswordHash = async (password) => {
  const hash = await bcrypt.hash(password, 12);
  console.log(`\n🔐 Password Hash for "${password}": ${hash}`);
};

// Uncomment the line below and replace 'YourPassword' with your desired password
// generatePasswordHash('YourPassword');
