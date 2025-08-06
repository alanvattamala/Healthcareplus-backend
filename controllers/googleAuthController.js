import { OAuth2Client } from 'google-auth-library';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import catchAsync from '../utils/catchAsync.js';
import AppError from '../utils/appError.js';

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

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

export const googleAuth = catchAsync(async (req, res, next) => {
  const { credential } = req.body;

  if (!credential) {
    return next(new AppError('Google credential is required', 400));
  }

  try {
    // Verify the Google token
    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    const { email, name, given_name, family_name, picture, email_verified } = payload;

    if (!email_verified) {
      return next(new AppError('Google account email is not verified', 400));
    }

    // Check if user already exists
    let user = await User.findOne({ email });

    if (user) {
      // User exists, log them in
      user.lastLogin = Date.now();
      await user.save({ validateBeforeSave: false });
      
      createSendToken(user, 200, res);
    } else {
      // Create new user
      const userData = {
        firstName: given_name || name.split(' ')[0] || 'User',
        lastName: family_name || name.split(' ').slice(1).join(' ') || '',
        email: email,
        password: Math.random().toString(36).slice(-12) + 'Gg1!', // Generate random password
        phone: '', // Will need to be filled later
        userType: 'patient', // Default to patient
        isEmailVerified: true,
        profilePicture: picture || '',
        lastLogin: Date.now()
      };

      // For patient, set default values
      userData.dateOfBirth = new Date('1990-01-01'); // Default date, user can update later
      userData.gender = 'prefer-not-to-say';
      userData.bloodGroup = 'O+'; // Default, user can update later

      user = await User.create(userData);
      
      createSendToken(user, 201, res);
    }
  } catch (error) {
    console.error('Google OAuth Error:', error);
    return next(new AppError('Invalid Google token', 400));
  }
});

export const googleAuthConfig = catchAsync(async (req, res, next) => {
  res.status(200).json({
    status: 'success',
    data: {
      clientId: process.env.GOOGLE_CLIENT_ID
    }
  });
});
