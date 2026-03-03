import SymptomAnalysis from '../models/SymptomAnalysis.js';
import symptomAnalysisService from '../services/symptomAnalysisService.js';
import { validationResult } from 'express-validator';
import AppError from '../utils/appError.js';

// Create new symptom analysis
export const createSymptomAnalysis = async (req, res, next) => {
  try {
    console.log('Symptom analysis request received:', {
      hasUser: !!req.user,
      bodyKeys: Object.keys(req.body),
      symptoms: req.body.symptoms?.substring(0, 50),
      selectedSymptoms: req.body.selectedSymptoms
    });
    
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('Validation errors:', errors.array());
      return next(new AppError('Invalid input data', 400, errors.array()));
    }

    const {
      symptoms,
      selectedSymptoms,
      severity,
      duration,
      additionalInfo
    } = req.body;

    // Get patient ID from authenticated user
    const patientId = req.user._id;

    // Prepare symptom text
    const symptomText = symptoms || (selectedSymptoms && selectedSymptoms.length > 0 ? selectedSymptoms.join(', ') : '');
    
    if (!symptomText.trim()) {
      return next(new AppError('No symptoms provided for analysis', 400));
    }

    // Perform AI analysis
    const aiAnalysis = await symptomAnalysisService.analyzeSymptoms(symptomText, {
      severity,
      duration,
      additionalInfo,
      selectedSymptoms
    });

    // Check for emergency indicators
    const isEmergency = checkEmergencyIndicators(symptoms, selectedSymptoms, aiAnalysis);

    // Create symptom analysis record
    const symptomAnalysis = new SymptomAnalysis({
      patientId,
      symptoms: symptomText,
      selectedSymptoms,
      severity,
      duration,
      additionalInfo,
      analysis: aiAnalysis,
      isEmergency,
      followUpRequired: aiAnalysis.urgencyLevel === 'moderate' || aiAnalysis.urgencyLevel === 'high'
    });

    await symptomAnalysis.save();

    // If emergency, trigger emergency alert (could integrate with notification system)
    if (isEmergency) {
      // Log emergency for immediate attention
      console.log('🚨 EMERGENCY SYMPTOM ANALYSIS:', {
        patientId,
        symptoms: symptomText?.substring(0, 100) + '...',
        urgency: aiAnalysis.urgencyLevel,
        timestamp: new Date().toISOString()
      });
    }

    res.status(201).json({
      success: true,
      data: {
        analysisId: symptomAnalysis._id,
        analysis: aiAnalysis,
        isEmergency,
        followUpRequired: symptomAnalysis.followUpRequired,
        createdAt: symptomAnalysis.createdAt
      },
      message: isEmergency ? 'Emergency symptoms detected! Please seek immediate medical attention.' : 'Symptom analysis completed successfully'
    });

  } catch (error) {
    console.error('Error creating symptom analysis:', error);
    next(new AppError('Failed to analyze symptoms. Please try again.', 500));
  }
};

// Get patient's symptom analysis history
export const getPatientHistory = async (req, res, next) => {
  try {
    const patientId = req.user._id;
    const { limit = 10, page = 1 } = req.query;

    const analyses = await SymptomAnalysis.getPatientHistory(patientId, parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    const total = await SymptomAnalysis.countDocuments({ patientId });

    res.json({
      success: true,
      data: {
        analyses,
        pagination: {
          current: parseInt(page),
          total: Math.ceil(total / parseInt(limit)),
          limit: parseInt(limit),
          totalRecords: total
        }
      }
    });

  } catch (error) {
    console.error('Error fetching patient history:', error);
    next(new AppError('Failed to fetch symptom history', 500));
  }
};

// Get specific symptom analysis (patient can only see their own)
export const getSymptomAnalysis = async (req, res, next) => {
  try {
    const { analysisId } = req.params;
    const patientId = req.user._id;

    const analysis = await SymptomAnalysis.findOne({
      _id: analysisId,
      patientId
    }).populate('reviewedBy', 'firstName lastName');

    if (!analysis) {
      return next(new AppError('Symptom analysis not found', 404));
    }

    res.json({
      success: true,
      data: analysis
    });

  } catch (error) {
    console.error('Error fetching symptom analysis:', error);
    next(new AppError('Failed to fetch symptom analysis', 500));
  }
};

// Doctor/Admin: Get all analyses requiring review
export const getPendingReviews = async (req, res, next) => {
  try {
    const { limit = 50, urgency, page = 1 } = req.query;

    let query = { doctorReviewed: false };
    if (urgency) {
      query['analysis.urgencyLevel'] = urgency;
    }

    const analyses = await SymptomAnalysis.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit))
      .populate('patientId', 'firstName lastName email phone')
      .populate('reviewedBy', 'firstName lastName');

    const total = await SymptomAnalysis.countDocuments(query);

    res.json({
      success: true,
      data: {
        analyses,
        pagination: {
          current: parseInt(page),
          total: Math.ceil(total / parseInt(limit)),
          limit: parseInt(limit),
          totalRecords: total
        }
      }
    });

  } catch (error) {
    console.error('Error fetching pending reviews:', error);
    next(new AppError('Failed to fetch pending reviews', 500));
  }
};

// Doctor/Admin: Review symptom analysis
export const reviewSymptomAnalysis = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next(new AppError('Invalid input data', 400, errors.array()));
    }

    const { analysisId } = req.params;
    const { reviewNotes, additionalRecommendations } = req.body;
    const doctorId = req.user._id;

    const analysis = await SymptomAnalysis.findById(analysisId);
    if (!analysis) {
      return next(new AppError('Symptom analysis not found', 404));
    }

    // Add additional recommendations if provided
    if (additionalRecommendations && additionalRecommendations.length > 0) {
      analysis.analysis.recommendations.push(...additionalRecommendations);
    }

    // Mark as reviewed
    await analysis.markReviewed(doctorId, reviewNotes);

    res.json({
      success: true,
      data: analysis,
      message: 'Symptom analysis reviewed successfully'
    });

  } catch (error) {
    console.error('Error reviewing symptom analysis:', error);
    next(new AppError('Failed to review symptom analysis', 500));
  }
};

// Doctor/Admin: Get emergency analyses
export const getEmergencyAnalyses = async (req, res, next) => {
  try {
    const { limit = 50, page = 1 } = req.query;

    const analyses = await SymptomAnalysis.getEmergencyAnalyses(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    const total = await SymptomAnalysis.countDocuments({
      $or: [
        { isEmergency: true },
        { 'analysis.urgencyLevel': 'high' }
      ]
    });

    res.json({
      success: true,
      data: {
        analyses,
        pagination: {
          current: parseInt(page),
          total: Math.ceil(total / parseInt(limit)),
          limit: parseInt(limit),
          totalRecords: total
        }
      }
    });

  } catch (error) {
    console.error('Error fetching emergency analyses:', error);
    next(new AppError('Failed to fetch emergency analyses', 500));
  }
};

// Admin: Get symptom analysis analytics
export const getAnalytics = async (req, res, next) => {
  try {
    const { dateRange = 30 } = req.query;

    const analytics = await SymptomAnalysis.getAnalytics(parseInt(dateRange));

    // Get top symptoms
    const topSymptoms = await SymptomAnalysis.aggregate([
      {
        $match: {
          createdAt: {
            $gte: new Date(Date.now() - parseInt(dateRange) * 24 * 60 * 60 * 1000)
          }
        }
      },
      { $unwind: '$selectedSymptoms' },
      {
        $group: {
          _id: '$selectedSymptoms',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);

    res.json({
      success: true,
      data: {
        overview: analytics[0] || {
          totalAnalyses: 0,
          emergencyCount: 0,
          highUrgency: 0,
          moderateUrgency: 0,
          lowUrgency: 0,
          averageConfidence: 0,
          reviewedCount: 0
        },
        topSymptoms,
        dateRange: parseInt(dateRange)
      }
    });

  } catch (error) {
    console.error('Error fetching analytics:', error);
    next(new AppError('Failed to fetch analytics', 500));
  }
};

// Delete symptom analysis (admin only)
export const deleteSymptomAnalysis = async (req, res, next) => {
  try {
    const { analysisId } = req.params;

    const analysis = await SymptomAnalysis.findByIdAndDelete(analysisId);
    if (!analysis) {
      return next(new AppError('Symptom analysis not found', 404));
    }

    res.json({
      success: true,
      message: 'Symptom analysis deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting symptom analysis:', error);
    next(new AppError('Failed to delete symptom analysis', 500));
  }
};

// Helper function to check emergency indicators
const checkEmergencyIndicators = (symptoms, selectedSymptoms, aiAnalysis) => {
  const emergencyKeywords = [
    'chest pain', 'difficulty breathing', 'severe headache', 'loss of consciousness',
    'severe bleeding', 'severe abdominal pain', 'stroke', 'heart attack',
    'seizure', 'severe allergic reaction', 'suicide', 'self harm',
    'severe trauma', 'unconscious', 'not breathing', 'choking'
  ];

  const symptomText = (symptoms || '').toLowerCase();
  const hasEmergencyKeywords = emergencyKeywords.some(keyword => 
    symptomText.includes(keyword) || 
    (selectedSymptoms || []).some(symptom => symptom.toLowerCase().includes(keyword))
  );

  const hasHighUrgencyFromAI = aiAnalysis.urgencyLevel === 'high' || 
    aiAnalysis.possibleConditions.some(condition => 
      condition.urgency === 'high' || condition.urgency === 'emergency'
    );

  return hasEmergencyKeywords || hasHighUrgencyFromAI;
};