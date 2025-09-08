import express from 'express';
import {
  register,
  login,
  logout,
  protect,
  getMe,
  updateMe,
  updatePassword,
  deleteMe,
  forgotPassword,
  verifyOTP,
  resetPassword,
  sendEmailVerificationOTP,
  verifyEmailVerificationOTP,
} from '../controllers/authController.js';
import { googleAuth, googleAuthConfig } from '../controllers/googleAuthController.js';
import { validateRegistration, validateLogin, validateForgotPassword, validateOTP, validatePasswordReset } from '../middleware/validation.js';

const router = express.Router();

// Public routes
router.post('/register', validateRegistration, register);
router.post('/login', validateLogin, login);
router.post('/logout', logout);

// Forgot password routes (public)
router.post('/forgot-password', validateForgotPassword, forgotPassword);
router.post('/verify-otp', validateOTP, verifyOTP);
router.post('/reset-password', validatePasswordReset, resetPassword);

// Email verification routes (public)
router.post('/send-otp', sendEmailVerificationOTP);
router.post('/verify-email-otp', verifyEmailVerificationOTP);

// Google OAuth routes (public)
router.post('/google', googleAuth);
router.get('/google/config', googleAuthConfig);

// Protected routes (require authentication)
router.use(protect); // All routes after this middleware are protected

router.get('/me', getMe);
router.patch('/updateMe', updateMe);
router.patch('/updatePassword', updatePassword);
router.delete('/deleteMe', deleteMe);

export default router;
