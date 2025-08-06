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
} from '../controllers/userController.js';
import { protect, restrictTo } from '../controllers/authController.js';

const router = express.Router();

// All routes are protected
router.use(protect);

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
