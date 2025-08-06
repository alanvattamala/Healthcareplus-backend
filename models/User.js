import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
  firstName: {
    type: String,
    required: [true, 'First name is required'],
    trim: true,
    minlength: [2, 'First name must be at least 2 characters'],
    maxlength: [50, 'First name cannot exceed 50 characters']
  },
  lastName: {
    type: String,
    required: [true, 'Last name is required'],
    trim: true,
    minlength: [2, 'Last name must be at least 2 characters'],
    maxlength: [50, 'Last name cannot exceed 50 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [8, 'Password must be at least 8 characters'],
    select: false // Don't include password in queries by default
  },
  phone: {
    type: String,
    required: [true, 'Phone number is required'],
    match: [/^[\+]?[\d\s\(\)\-\.]{10,}$/, 'Please enter a valid phone number']
  },
  userType: {
    type: String,
    required: [true, 'User type is required'],
    enum: ['patient', 'doctor', 'admin'],
    default: 'patient'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isEmailVerified: {
    type: Boolean,
    default: false
  },
  profilePicture: {
    type: String,
    default: ''
  },
  
  // Patient-specific fields
  dateOfBirth: {
    type: Date,
    required: function() {
      return this.userType === 'patient';
    }
  },
  gender: {
    type: String,
    enum: ['male', 'female', 'other', 'prefer-not-to-say'],
    required: function() {
      return this.userType === 'patient';
    }
  },
  bloodGroup: {
    type: String,
    enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'],
    required: function() {
      return this.userType === 'patient';
    }
  },
  knownAllergies: {
    type: String,
    default: ''
  },
  medicalHistory: [{
    condition: String,
    diagnosedDate: Date,
    treatment: String,
    doctor: String
  }],
  emergencyContact: {
    name: String,
    relationship: String,
    phone: String,
    email: String
  },
  
  // Doctor-specific fields
  medicalLicenseNumber: {
    type: String,
    required: function() {
      return this.userType === 'doctor';
    },
    unique: true,
    sparse: true // Allows null values but ensures uniqueness when present
  },
  specialization: {
    type: String,
    required: function() {
      return this.userType === 'doctor';
    }
  },
  otherSpecialization: {
    type: String,
    required: function() {
      return this.userType === 'doctor' && this.specialization === 'other';
    }
  },
  experience: {
    type: String,
    required: function() {
      return this.userType === 'doctor';
    }
  },
  consultationFee: {
    type: Number,
    default: 0
  },
  qualifications: [{
    degree: String,
    institution: String,
    year: Number
  }],
  hospitalAffiliations: [{
    name: String,
    position: String,
    startDate: Date,
    endDate: Date,
    current: Boolean
  }],
  availability: {
    monday: { available: Boolean, slots: [String] },
    tuesday: { available: Boolean, slots: [String] },
    wednesday: { available: Boolean, slots: [String] },
    thursday: { available: Boolean, slots: [String] },
    friday: { available: Boolean, slots: [String] },
    saturday: { available: Boolean, slots: [String] },
    sunday: { available: Boolean, slots: [String] }
  },
  verificationStatus: {
    type: String,
    enum: ['pending', 'verified', 'rejected'],
    default: function() {
      return this.userType === 'doctor' ? 'pending' : 'verified';
    }
  },
  verificationDocument: {
    type: String, // URL to uploaded document
    default: ''
  },
  
  // Admin-specific fields
  adminLevel: {
    type: String,
    enum: ['super', 'moderator', 'support'],
    default: function() {
      return this.userType === 'admin' ? 'moderator' : undefined;
    }
  },
  permissions: [{
    type: String,
    enum: ['user_management', 'doctor_verification', 'content_management', 'analytics', 'system_settings']
  }],
  
  // Common fields
  lastLogin: {
    type: Date,
    default: Date.now
  },
  loginAttempts: {
    type: Number,
    default: 0
  },
  lockUntil: Date,
  passwordChangedAt: Date,
  passwordResetToken: String,
  passwordResetExpires: Date,
  // OTP fields for forgot password
  passwordResetOTP: String,
  passwordResetOTPExpires: Date
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual fields
userSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`;
});

userSchema.virtual('age').get(function() {
  if (this.dateOfBirth) {
    const today = new Date();
    const birthDate = new Date(this.dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    
    return age;
  }
  return null;
});

userSchema.virtual('isAccountLocked').get(function() {
  return !!(this.lockUntil && this.lockUntil > Date.now());
});

// Indexes for better performance (only for fields that don't have unique: true)
userSchema.index({ userType: 1 });
userSchema.index({ verificationStatus: 1 });
userSchema.index({ specialization: 1 });

// Pre-save middleware to hash password
userSchema.pre('save', async function(next) {
  // Only run this function if password was actually modified
  if (!this.isModified('password')) return next();
  
  // Hash the password with cost of 12
  this.password = await bcrypt.hash(this.password, 12);
  
  // Set password changed timestamp
  if (!this.isNew) {
    this.passwordChangedAt = Date.now() - 1000; // Subtract 1 second to ensure token is created after password change
  }
  
  next();
});

// Pre-save middleware to handle account locking
userSchema.pre('save', function(next) {
  // If account is not locked and login attempts exceed 5, lock account for 5 minutes
  if (!this.isAccountLocked && this.loginAttempts >= 5) {
    this.lockUntil = Date.now() + 5 * 60 * 1000; // Lock for 5 minutes
  }
  
  next();
});

// Instance method to check password
userSchema.methods.correctPassword = async function(candidatePassword, userPassword) {
  return await bcrypt.compare(candidatePassword, userPassword);
};

// Instance method to check if password changed after JWT was issued
userSchema.methods.changedPasswordAfter = function(JWTTimestamp) {
  if (this.passwordChangedAt) {
    const changedTimestamp = parseInt(this.passwordChangedAt.getTime() / 1000, 10);
    return JWTTimestamp < changedTimestamp;
  }
  
  // False means NOT changed
  return false;
};

// Instance method to handle failed login attempts
userSchema.methods.incLoginAttempts = function() {
  // If we have a previous lock that has expired, restart at 1
  if (this.lockUntil && this.lockUntil < Date.now()) {
    return this.updateOne({
      $unset: { lockUntil: 1 },
      $set: { loginAttempts: 1 }
    });
  }
  
  const updates = { $inc: { loginAttempts: 1 } };
  
  // Lock account for 5 minutes after 5 failed attempts
  if (this.loginAttempts + 1 >= 5 && !this.isAccountLocked) {
    updates.$set = { lockUntil: Date.now() + 5 * 60 * 1000 }; // 5 minutes
  }
  
  return this.updateOne(updates);
};

// Instance method to reset login attempts
userSchema.methods.resetLoginAttempts = function() {
  return this.updateOne({
    $unset: { loginAttempts: 1, lockUntil: 1 }
  });
};

// Static method to find user by email with password
userSchema.statics.findByEmail = function(email) {
  return this.findOne({ email }).select('+password');
};

// Static method to get users by type
userSchema.statics.getUsersByType = function(userType) {
  return this.find({ userType, isActive: true });
};

// Static method to unlock expired account locks
userSchema.statics.unlockExpiredAccounts = function() {
  return this.updateMany(
    { 
      lockUntil: { $lte: Date.now() } 
    },
    { 
      $unset: { lockUntil: 1, loginAttempts: 1 } 
    }
  );
};

const User = mongoose.model('User', userSchema);

export default User;
