import express from 'express';
import {
  getPendingDoctors,
  verifyDoctor,
  getAllUsers,
  getDashboardStats,
  updateUserStatus,
  updateUser,
  deleteUser
} from '../controllers/adminController.js';
import { protect, restrictTo } from '../controllers/authController.js';

const router = express.Router();

// All admin routes require authentication and admin role
router.use(protect); // Ensure user is authenticated
router.use(restrictTo('admin')); // Ensure user is admin

// Doctor verification routes
router.get('/pending-doctors', getPendingDoctors);
router.patch('/verify-doctor/:doctorId', verifyDoctor);

// User management routes
router.get('/users', getAllUsers);
router.put('/users/:userId', updateUser);
router.patch('/users/:userId/status', updateUserStatus);
router.delete('/users/:userId', deleteUser);

// Dashboard stats
router.get('/dashboard-stats', getDashboardStats);

export default router;
