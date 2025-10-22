import express from 'express';
import { protect } from '../controllers/authController.js';
import {
  sendVideoCallNotification,
  getPatientNotifications,
  markNotificationAsRead
} from '../controllers/notificationController.js';

const router = express.Router();

// All routes are protected (require authentication)
router.use(protect);

// Notification routes
router.post('/video-call-ready', sendVideoCallNotification);
router.get('/patient-notifications', getPatientNotifications);
router.patch('/mark-read/:notificationId', markNotificationAsRead);

export default router;