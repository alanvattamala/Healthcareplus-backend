import express from 'express';
import {
  getTodaySchedule,
  saveTodaySchedule,
  getScheduleHistory,
  deleteTodaySchedule,
  getUpcomingSchedules,
  saveUpcomingSchedules,
  deleteUpcomingSchedule,
  checkScheduleExists,
  getScheduleSlots,
  updateSlotStatus
} from '../controllers/scheduleController.js';
import { protect, restrictTo } from '../controllers/authController.js';

const router = express.Router();

// All routes are protected and doctor-only
router.use(protect);
router.use(restrictTo('doctor'));

// Today's schedule routes
router.get('/today', getTodaySchedule); // Get today's schedule
router.post('/today', saveTodaySchedule); // Save or update today's schedule
router.delete('/today', deleteTodaySchedule); // Delete today's schedule

// Upcoming schedules routes
router.get('/upcoming', getUpcomingSchedules); // Get upcoming schedules
router.post('/upcoming', saveUpcomingSchedules); // Save multiple upcoming schedules
router.delete('/upcoming/:scheduleId', deleteUpcomingSchedule); // Delete specific upcoming schedule
router.get('/check-exists', checkScheduleExists); // Check if schedules exist for specific dates

// Schedule history
router.get('/history', getScheduleHistory); // Get schedule history

// Slot management routes
router.get('/:date/slots', getScheduleSlots); // Get detailed slot information for a specific date
router.patch('/:scheduleId/slots/:slotNumber', updateSlotStatus); // Update slot status

export default router;