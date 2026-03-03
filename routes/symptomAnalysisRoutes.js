import express from 'express';
import {
  createSymptomAnalysis,
  getPatientHistory,
  getSymptomAnalysis,
  getPendingReviews,
  reviewSymptomAnalysis,
  getEmergencyAnalyses,
  getAnalytics,
  deleteSymptomAnalysis
} from '../controllers/symptomAnalysisController.js';
import { protect, restrictTo } from '../middleware/authMiddleware.js';
// import { validateSymptomAnalysis } from '../middleware/validation.js';

const router = express.Router();

// Protect all routes
router.use(protect);

// Patient routes
router.post('/', createSymptomAnalysis);
router.get('/history', getPatientHistory);
router.get('/:analysisId', getSymptomAnalysis);

// Doctor/Admin routes
router.get('/admin/pending-reviews', restrictTo('doctor', 'admin'), getPendingReviews);
router.put('/:analysisId/review', restrictTo('doctor', 'admin'), reviewSymptomAnalysis);
router.get('/admin/emergency', restrictTo('doctor', 'admin'), getEmergencyAnalyses);

// Admin only routes
router.get('/admin/analytics', restrictTo('admin'), getAnalytics);
router.delete('/:analysisId', restrictTo('admin'), deleteSymptomAnalysis);

export default router;