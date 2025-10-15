import express from 'express';
import {
  getAllUsers,
  getUser,
  getAllDoctors,
  getAllPatients,
  updateUser,
  deleteUser,
  updateUserStatus,
  verifyDoctor,
  getDoctorStats,
  getPatientStats,
  updateDoctorAvailability,
  getDoctorAvailability,
  getAvailableDoctors,
  getAvailableDoctorsByDailySchedule,
  getAvailableDoctorsForDate,
  getDoctorConsultationFee,
  createSampleSchedules,
  createSampleDoctors,
  createDoctorsWithDailyAvailability,
  updateSchedulesToToday,
  debugSchedules,
  migrateSchedulesToNoonUTC,
} from '../controllers/userController.js';
import { protect, restrictTo } from '../controllers/authController.js';

const router = express.Router();

// All routes are protected
router.use(protect);

// Doctor availability routes (accessible by doctors and patients)
router.get('/doctors/available', getAvailableDoctors);
router.get('/doctors/available-daily', getAvailableDoctorsByDailySchedule); // New daily-based endpoint
router.get('/doctors/available-for-date', getAvailableDoctorsForDate); // Get doctors for specific date
router.get('/doctors/:doctorId/availability', getDoctorAvailability);

// Development/Testing routes
router.post('/schedules/sample', createSampleSchedules); // For creating test data
router.post('/doctors/sample', createSampleDoctors); // For creating test doctors
router.post('/doctors/daily-availability-sample', createDoctorsWithDailyAvailability); // Create doctors with daily availability
router.patch('/schedules/update-to-today', updateSchedulesToToday); // Update schedules to today's date
router.post('/schedules/migrate-to-noon', migrateSchedulesToNoonUTC); // Migrate existing schedules to noon UTC
router.get('/schedules/debug', debugSchedules); // Debug all schedules

// Routes accessible by doctors only
router.patch('/doctor/availability', restrictTo('doctor'), updateDoctorAvailability);
router.get('/doctor/availability', restrictTo('doctor'), getDoctorAvailability);
router.get('/doctor/consultation-fee', restrictTo('doctor'), getDoctorConsultationFee);

// Routes accessible by doctors and admins
router.get('/doctors', restrictTo('doctor', 'admin'), getAllDoctors);
router.get('/doctors/stats', restrictTo('admin'), getDoctorStats);

// Routes accessible by admins only
router.use(restrictTo('admin'));

router.get('/', getAllUsers);
router.get('/patients', getAllPatients);
router.get('/patients/stats', getPatientStats);

router
  .route('/:id')
  .get(getUser)
  .patch(updateUser)
  .delete(deleteUser);

router.patch('/:id/status', updateUserStatus);
router.patch('/:id/verify', verifyDoctor);

export default router;
