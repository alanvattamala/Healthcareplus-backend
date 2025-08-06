import jwt from 'jsonwebtoken';
import { promisify } from 'util';
import crypto from 'crypto';
import User from '../models/User.js';
import catchAsync from '../utils/catchAsync.js';
import AppError from '../utils/appError.js';
import emailService from '../utils/emailService.js';

const signToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });
};

const createSendToken = (user, statusCode, res) => {
  const token = signToken(user._id);
  const cookieOptions = {
    expires: new Date(
      Date.now() + process.env.JWT_COOKIE_EXPIRES_IN * 24 * 60 * 60 * 1000
    ),
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax'
  };

  res.cookie('jwt', token, cookieOptions);

  // Remove password from output
  user.password = undefined;

  res.status(statusCode).json({
    status: 'success',
    token,
    data: {
      user,
    },
  });
};

export const register = catchAsync(async (req, res, next) => {
  const {
    firstName,
    lastName,
    email,
    password,
    confirmPassword,
    phone,
    userType,
    // Patient fields
    dateOfBirth,
    gender,
    bloodGroup,
    knownAllergies,
    // Doctor fields
    medicalLicenseNumber,
    specialization,
    otherSpecialization,
    experience,
    verificationDocument
  } = req.body;

  // Check if passwords match
  if (password !== confirmPassword) {
    return next(new AppError('Passwords do not match', 400));
  }

  // Check if user already exists
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    return next(new AppError('User with this email already exists', 400));
  }

  // Check for duplicate medical license number for doctors
  if (userType === 'doctor' && medicalLicenseNumber) {
    const existingDoctor = await User.findOne({ medicalLicenseNumber });
    if (existingDoctor) {
      return next(new AppError('Doctor with this license number already exists', 400));
    }
  }

  // Create user object
  const userData = {
    firstName,
    lastName,
    email,
    password,
    phone,
    userType
  };

  // Add user-type specific fields
  if (userType === 'patient') {
    userData.dateOfBirth = dateOfBirth;
    userData.gender = gender;
    userData.bloodGroup = bloodGroup;
    userData.knownAllergies = knownAllergies || '';
  } else if (userType === 'doctor') {
    userData.medicalLicenseNumber = medicalLicenseNumber;
    userData.specialization = specialization;
    if (specialization === 'other') {
      userData.otherSpecialization = otherSpecialization;
    }
    userData.experience = experience;
    userData.verificationDocument = verificationDocument || '';
    userData.verificationStatus = 'pending';
  }

  // Create new user
  const newUser = await User.create(userData);

  // Send response with token
  createSendToken(newUser, 201, res);
});

export const login = catchAsync(async (req, res, next) => {
  const { email, password } = req.body;

  // 1) Check if email and password exist
  if (!email || !password) {
    return next(new AppError('Please provide email and password!', 400));
  }

  // 2) Check if user exists and password is correct
  const user = await User.findByEmail(email);

  if (!user) {
    return next(new AppError('Incorrect email or password', 401));
  }

  // 2.5) Check if account lock has expired and automatically unlock
  if (user.lockUntil && user.lockUntil <= Date.now()) {
    await user.updateOne({
      $unset: { lockUntil: 1, loginAttempts: 1 }
    });
    // Refetch user to get updated data
    user = await User.findByEmail(email);
  }

  // 3) Check if account is locked
  if (user.isAccountLocked) {
    const unlockTime = new Date(user.lockUntil);
    const remainingMinutes = Math.ceil((user.lockUntil - Date.now()) / (60 * 1000));
    return next(new AppError(`Account is temporarily locked due to too many failed login attempts. Please try again in ${remainingMinutes} minute(s) at ${unlockTime.toLocaleTimeString()}.`, 423));
  }

  // 4) Check if account is active
  if (!user.isActive) {
    return next(new AppError('Your account has been deactivated. Please contact support.', 401));
  }

  // 5) Verify password
  const isPasswordCorrect = await user.correctPassword(password, user.password);

  if (!isPasswordCorrect) {
    // Increment failed login attempts
    await user.incLoginAttempts();
    return next(new AppError('Incorrect email or password', 401));
  }

  // 6) Reset login attempts and update last login
  await user.resetLoginAttempts();
  user.lastLogin = new Date();
  await user.save({ validateBeforeSave: false });

  // 7) If everything is ok, send token to client
  createSendToken(user, 200, res);
});

export const logout = (req, res) => {
  res.cookie('jwt', 'loggedout', {
    expires: new Date(Date.now() + 10 * 1000),
    httpOnly: true,
  });
  res.status(200).json({ status: 'success' });
};

export const protect = catchAsync(async (req, res, next) => {
  // 1) Getting token and check if it's there
  let token;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.cookies.jwt) {
    token = req.cookies.jwt;
  }

  if (!token) {
    return next(
      new AppError('You are not logged in! Please log in to get access.', 401)
    );
  }

  // 2) Verification token
  const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);

  // 3) Check if user still exists
  const currentUser = await User.findById(decoded.id);
  if (!currentUser) {
    return next(
      new AppError(
        'The user belonging to this token does no longer exist.',
        401
      )
    );
  }

  // 4) Check if user changed password after the token was issued
  if (currentUser.changedPasswordAfter(decoded.iat)) {
    return next(
      new AppError('User recently changed password! Please log in again.', 401)
    );
  }

  // 5) Check if account is still active
  if (!currentUser.isActive) {
    return next(new AppError('Your account has been deactivated.', 401));
  }

  // GRANT ACCESS TO PROTECTED ROUTE
  req.user = currentUser;
  next();
});

export const restrictTo = (...roles) => {
  return (req, res, next) => {
    // roles ['admin', 'doctor']. role='patient'
    if (!roles.includes(req.user.userType)) {
      return next(
        new AppError('You do not have permission to perform this action', 403)
      );
    }
    next();
  };
};

export const getMe = catchAsync(async (req, res, next) => {
  // req.user is set by protect middleware
  const user = await User.findById(req.user.id);
  
  res.status(200).json({
    status: 'success',
    data: {
      user,
    },
  });
});

export const updateMe = catchAsync(async (req, res, next) => {
  // 1) Create error if user POSTs password data
  if (req.body.password || req.body.confirmPassword) {
    return next(
      new AppError(
        'This route is not for password updates. Please use /updatePassword.',
        400
      )
    );
  }

  // 2) Filter out unwanted fields names that are not allowed to be updated
  const filteredBody = filterObj(req.body, 
    'firstName', 'lastName', 'phone', 'profilePicture',
    // Patient fields
    'knownAllergies', 'emergencyContact',
    // Doctor fields
    'consultationFee', 'qualifications', 'hospitalAffiliations', 'availability'
  );

  // 3) Update user document
  const updatedUser = await User.findByIdAndUpdate(req.user.id, filteredBody, {
    new: true,
    runValidators: true,
  });

  res.status(200).json({
    status: 'success',
    data: {
      user: updatedUser,
    },
  });
});

export const updatePassword = catchAsync(async (req, res, next) => {
  // 1) Get user from collection
  const user = await User.findById(req.user.id).select('+password');

  // 2) Check if POSTed current password is correct
  if (!(await user.correctPassword(req.body.passwordCurrent, user.password))) {
    return next(new AppError('Your current password is wrong.', 401));
  }

  // 3) If so, update password
  user.password = req.body.password;
  await user.save();
  // User.findByIdAndUpdate will NOT work as intended!

  // 4) Log user in, send JWT
  createSendToken(user, 200, res);
});

export const forgotPassword = catchAsync(async (req, res, next) => {
  // 1) Get user based on POSTed email
  const user = await User.findOne({ email: req.body.email });
  if (!user) {
    return next(new AppError('There is no user with that email address.', 404));
  }

  // 2) Generate 6-digit OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  
  // 3) Hash the OTP and save to database with expiry (10 minutes)
  const hashedOTP = crypto.createHash('sha256').update(otp).digest('hex');
  user.passwordResetOTP = hashedOTP;
  user.passwordResetOTPExpires = Date.now() + 10 * 60 * 1000; // 10 minutes
  await user.save({ validateBeforeSave: false });

  // 4) Send OTP to user's email
  try {
    const emailResult = await emailService.sendOTP(user.email, otp, user.firstName);

    const response = {
      status: 'success',
      message: 'OTP sent to email successfully! Please check your inbox.',
    };

    // In development mode, include OTP for testing
    if (process.env.NODE_ENV === 'development' && emailResult.otp) {
      response.devOTP = emailResult.otp;
    }

    res.status(200).json(response);
  } catch (err) {
    user.passwordResetOTP = undefined;
    user.passwordResetOTPExpires = undefined;
    await user.save({ validateBeforeSave: false });

    return next(
      new AppError('There was an error sending the email. Try again later.', 500)
    );
  }
});

export const verifyOTP = catchAsync(async (req, res, next) => {
  // 1) Get user based on email and hash the submitted OTP
  const { email, otp } = req.body;
  
  if (!email || !otp) {
    return next(new AppError('Please provide email and OTP', 400));
  }

  const hashedOTP = crypto.createHash('sha256').update(otp).digest('hex');

  // 2) Find user with matching email, OTP, and check if OTP hasn't expired
  const user = await User.findOne({
    email,
    passwordResetOTP: hashedOTP,
    passwordResetOTPExpires: { $gt: Date.now() },
  });

  // 3) If OTP is valid and hasn't expired, mark as verified
  if (!user) {
    return next(new AppError('OTP is invalid or has expired', 400));
  }

  // 4) Generate a temporary token for password reset (valid for 10 minutes)
  const resetToken = crypto.randomBytes(32).toString('hex');
  const hashedResetToken = crypto.createHash('sha256').update(resetToken).digest('hex');
  
  user.passwordResetToken = hashedResetToken;
  user.passwordResetExpires = Date.now() + 10 * 60 * 1000; // 10 minutes
  // Clear OTP fields
  user.passwordResetOTP = undefined;
  user.passwordResetOTPExpires = undefined;
  await user.save({ validateBeforeSave: false });

  res.status(200).json({
    status: 'success',
    message: 'OTP verified successfully! You can now reset your password.',
    resetToken, // This will be used for password reset
  });
});

export const resetPassword = catchAsync(async (req, res, next) => {
  // 1) Get user based on the token
  const hashedToken = crypto
    .createHash('sha256')
    .update(req.body.resetToken)
    .digest('hex');

  const user = await User.findOne({
    passwordResetToken: hashedToken,
    passwordResetExpires: { $gt: Date.now() },
  });

  // 2) If token has not expired, and there is user, set the new password
  if (!user) {
    return next(new AppError('Token is invalid or has expired', 400));
  }

  // 3) Validate password confirmation
  if (req.body.password !== req.body.confirmPassword) {
    return next(new AppError('Passwords do not match', 400));
  }

  // 4) Update password and clear reset fields
  user.password = req.body.password;
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;
  user.passwordChangedAt = Date.now() - 1000; // Ensure JWT is created after password change
  await user.save();

  // 5) Log user in, send JWT
  createSendToken(user, 200, res);
});

export const deleteMe = catchAsync(async (req, res, next) => {
  await User.findByIdAndUpdate(req.user.id, { isActive: false });

  res.status(204).json({
    status: 'success',
    data: null,
  });
});

// Helper function to filter object
const filterObj = (obj, ...allowedFields) => {
  const newObj = {};
  Object.keys(obj).forEach((el) => {
    if (allowedFields.includes(el)) newObj[el] = obj[el];
  });
  return newObj;
};
