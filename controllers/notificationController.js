import catchAsync from '../utils/catchAsync.js';
import User from '../models/User.js';
import Appointment from '../models/Appointment.js';

// In-memory storage for notifications (in production, use database)
const patientNotifications = new Map();

// @desc    Send video call ready notification to patient
// @route   POST /api/notifications/video-call-ready
// @access  Private (Doctor)
export const sendVideoCallNotification = catchAsync(async (req, res) => {
  const { appointmentId, patientId, roomId, doctorName } = req.body;
  
  // Verify appointment exists
  const appointment = await Appointment.findById(appointmentId)
    .populate('patient', 'firstName lastName email');
    
  if (!appointment) {
    return res.status(404).json({
      success: false,
      message: 'Appointment not found'
    });
  }
  
  const notification = {
    id: `video-call-${Date.now()}`,
    type: 'video-call-ready',
    appointmentId,
    patientId,
    roomId,
    doctorName,
    title: 'Doctor is Ready for Video Consultation',
    message: `${doctorName} is ready for your video consultation. Click to join the call.`,
    createdAt: new Date(),
    read: false,
    actionRequired: true,
    actionUrl: `/join-call/${roomId}`,
    expiresAt: new Date(Date.now() + 30 * 60 * 1000) // 30 minutes expiry
  };
  
  // Store notification for patient
  if (!patientNotifications.has(patientId)) {
    patientNotifications.set(patientId, []);
  }
  patientNotifications.get(patientId).push(notification);
  
  console.log(`📢 Video call notification created for patient ${patientId}:`, notification);
  
  res.status(200).json({
    success: true,
    data: {
      notificationId: notification.id,
      message: 'Video call notification sent to patient'
    }
  });
});

// @desc    Get notifications for patient
// @route   GET /api/notifications/patient-notifications
// @access  Private (Patient)
export const getPatientNotifications = catchAsync(async (req, res) => {
  const patientId = req.user._id.toString();
  
  const notifications = patientNotifications.get(patientId) || [];
  
  // Filter out expired notifications
  const validNotifications = notifications.filter(notification => {
    return !notification.expiresAt || new Date() < notification.expiresAt;
  });
  
  // Update stored notifications to remove expired ones
  patientNotifications.set(patientId, validNotifications);
  
  res.status(200).json({
    success: true,
    data: {
      notifications: validNotifications,
      count: validNotifications.length,
      unreadCount: validNotifications.filter(n => !n.read).length
    }
  });
});

// @desc    Mark notification as read
// @route   PATCH /api/notifications/mark-read/:notificationId
// @access  Private (Patient)
export const markNotificationAsRead = catchAsync(async (req, res) => {
  const { notificationId } = req.params;
  const patientId = req.user._id.toString();
  
  const notifications = patientNotifications.get(patientId) || [];
  const notification = notifications.find(n => n.id === notificationId);
  
  if (!notification) {
    return res.status(404).json({
      success: false,
      message: 'Notification not found'
    });
  }
  
  notification.read = true;
  notification.readAt = new Date();
  
  res.status(200).json({
    success: true,
    data: {
      notificationId,
      message: 'Notification marked as read'
    }
  });
});

// Helper function to clean up expired notifications
export const cleanupExpiredNotifications = () => {
  const now = new Date();
  let cleanedCount = 0;
  
  for (const [patientId, notifications] of patientNotifications.entries()) {
    const validNotifications = notifications.filter(notification => {
      return !notification.expiresAt || now < notification.expiresAt;
    });
    
    const expiredCount = notifications.length - validNotifications.length;
    if (expiredCount > 0) {
      patientNotifications.set(patientId, validNotifications);
      cleanedCount += expiredCount;
    }
  }
  
  if (cleanedCount > 0) {
    console.log(`🧹 Cleaned up ${cleanedCount} expired notifications`);
  }
  
  return cleanedCount;
};