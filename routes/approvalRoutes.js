import express from 'express';
import {
  submitApprovalRequest,
  getAllApprovalRequests,
  processApprovalRequest,
  getDoctorApprovalRequests,
  getApprovalStatistics
} from '../controllers/approvalController.js';
import { protect, restrictTo } from '../controllers/authController.js';

const router = express.Router();

// All routes are protected
router.use(protect);

// Submit approval request (doctors only)
router.post('/submit', restrictTo('doctor'), submitApprovalRequest);

// Get doctor's own approval requests
router.get('/my-requests', restrictTo('doctor'), getDoctorApprovalRequests);

// Admin routes
router.get('/all', restrictTo('admin'), getAllApprovalRequests); // Get all approval requests (admin only)
router.patch('/:id/process', restrictTo('admin'), processApprovalRequest); // Process approval request (admin only)
router.get('/statistics', restrictTo('admin'), getApprovalStatistics); // Get approval statistics (admin only)

export default router;