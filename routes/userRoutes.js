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
} from '../controllers/userController.js';
import { protect, restrictTo } from '../controllers/authController.js';

const router = express.Router();

// All routes are protected
router.use(protect);

// Doctor availability routes (accessible by doctors and patients)
router.get('/doctors/available', getAvailableDoctors);
router.get('/doctors/:doctorId/availability', getDoctorAvailability);

// Routes accessible by doctors only
router.patch('/doctor/availability', restrictTo('doctor'), updateDoctorAvailability);
router.get('/doctor/availability', restrictTo('doctor'), getDoctorAvailability);

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
