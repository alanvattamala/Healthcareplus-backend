import SymptomAnalysis from '../models/SymptomAnalysis.js';
import symptomAnalysisService from '../services/symptomAnalysisService.js';
import { validationResult } from 'express-validator';
import AppError from '../utils/appError.js';

// Create new symptom analysis
export const createSymptomAnalysis = async (req, res, next) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
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

    // Perform AI analysis
    const aiAnalysis = await symptomAnalysisService.analyzeSymptoms({
      symptoms,
      selectedSymptoms,
      severity,
      duration,
      additionalInfo
    });

    // Check for emergency indicators
    const isEmergency = checkEmergencyIndicators(symptoms, selectedSymptoms, aiAnalysis);

    // Create symptom analysis record
    const symptomAnalysis = new SymptomAnalysis({
      patientId,
      symptoms,
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
        symptoms: symptoms?.substring(0, 100) + '...',
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
      additionalInfo: additionalInfo || {},
      analysis,
      isEmergency,
      followUpRequired: analysis.urgencyLevel === 'high' || analysis.urgencyLevel === 'moderate'
    });

    await symptomAnalysisData.save();

    // If emergency, create alert (you can implement notification system)
    if (isEmergency) {
      // TODO: Implement emergency alert system
      console.log(`EMERGENCY ALERT: Patient ${req.user._id} has emergency symptoms`);
    }

    res.status(201).json({
      status: 'success',
      data: {
        analysis: symptomAnalysisData,
        recommendations: analysis.recommendations,
        urgencyLevel: analysis.urgencyLevel,
        isEmergency
      }
    });

  } catch (error) {
    console.error('Symptom analysis error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to analyze symptoms. Please try again.'
    });
  }
});

// Get patient's symptom analysis history
const getPatientSymptomHistory = catchAsync(async (req, res, next) => {
  const { limit = 10, page = 1 } = req.query;
  const skip = (page - 1) * limit;

  const analyses = await SymptomAnalysis.find({ patientId: req.user._id })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit));

  const total = await SymptomAnalysis.countDocuments({ patientId: req.user._id });

  res.status(200).json({
    status: 'success',
    data: {
      analyses,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    }
  });
});

// Get specific symptom analysis
const getSymptomAnalysis = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  const analysis = await SymptomAnalysis.findOne({
    _id: id,
    patientId: req.user._id
  }).populate('reviewedBy', 'firstName lastName');

  if (!analysis) {
    return res.status(404).json({
      status: 'error',
      message: 'Symptom analysis not found'
    });
  }

  res.status(200).json({
    status: 'success',
    data: {
      analysis
    }
  });
});

// Update symptom analysis (for follow-up information)
const updateSymptomAnalysis = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { followUpNotes, symptomsImproved, additionalSymptoms } = req.body;

  const analysis = await SymptomAnalysis.findOne({
    _id: id,
    patientId: req.user._id
  });

  if (!analysis) {
    return res.status(404).json({
      status: 'error',
      message: 'Symptom analysis not found'
    });
  }

  // Update with follow-up information
  if (followUpNotes) analysis.followUpNotes = followUpNotes;
  if (typeof symptomsImproved !== 'undefined') analysis.symptomsImproved = symptomsImproved;
  if (additionalSymptoms) analysis.additionalSymptoms = additionalSymptoms;

  analysis.updatedAt = new Date();
  await analysis.save();

  res.status(200).json({
    status: 'success',
    data: {
      analysis
    }
  });
});

// Delete symptom analysis
const deleteSymptomAnalysis = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  const analysis = await SymptomAnalysis.findOneAndDelete({
    _id: id,
    patientId: req.user._id
  });

  if (!analysis) {
    return res.status(404).json({
      status: 'error',
      message: 'Symptom analysis not found'
    });
  }

  res.status(200).json({
    status: 'success',
    message: 'Symptom analysis deleted successfully'
  });
});

// Get patient analytics
const getPatientAnalytics = catchAsync(async (req, res, next) => {
  const { days = 30 } = req.query;
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - parseInt(days));

  const analytics = await SymptomAnalysis.aggregate([
    { 
      $match: { 
        patientId: req.user._id,
        createdAt: { $gte: startDate }
      }
    },
    {
      $group: {
        _id: null,
        totalAnalyses: { $sum: 1 },
        emergencyCount: { $sum: { $cond: ['$isEmergency', 1, 0] } },
        highUrgencyCount: { $sum: { $cond: [{ $eq: ['$analysis.urgencyLevel', 'high'] }, 1, 0] } },
        moderateUrgencyCount: { $sum: { $cond: [{ $eq: ['$analysis.urgencyLevel', 'moderate'] }, 1, 0] } },
        lowUrgencyCount: { $sum: { $cond: [{ $eq: ['$analysis.urgencyLevel', 'low'] }, 1, 0] } },
        averageConfidence: { $avg: '$analysis.confidence' }
      }
    }
  ]);

  const symptomFrequency = await SymptomAnalysis.aggregate([
    { 
      $match: { 
        patientId: req.user._id,
        createdAt: { $gte: startDate }
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

  res.status(200).json({
    status: 'success',
    data: {
      analytics: analytics[0] || {
        totalAnalyses: 0,
        emergencyCount: 0,
        highUrgencyCount: 0,
        moderateUrgencyCount: 0,
        lowUrgencyCount: 0,
        averageConfidence: 0
      },
      symptomFrequency
    }
  });
});

// Admin/Doctor endpoints

// Get all emergency analyses (doctors/admins only)
const getEmergencyAnalyses = catchAsync(async (req, res, next) => {
  const { limit = 50, page = 1 } = req.query;
  const skip = (page - 1) * limit;

  const analyses = await SymptomAnalysis.find({
    $or: [
      { isEmergency: true },
      { urgencyLevel: 'high' }
    ]
  })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit))
    .populate('patientId', 'firstName lastName email phone');

  const total = await SymptomAnalysis.countDocuments({
    $or: [
      { isEmergency: true },
      { urgencyLevel: 'high' }
    ]
  });

  res.status(200).json({
    status: 'success',
    data: {
      analyses,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    }
  });
});

// Get analyses requiring review (doctors only)
const getPendingReviews = catchAsync(async (req, res, next) => {
  const { limit = 100, page = 1 } = req.query;
  const skip = (page - 1) * limit;

  const analyses = await SymptomAnalysis.find({
    doctorReviewed: false,
    $or: [
      { 'analysis.urgencyLevel': { $in: ['moderate', 'high'] } },
      { followUpRequired: true }
    ]
  })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit))
    .populate('patientId', 'firstName lastName email phone');

  const total = await SymptomAnalysis.countDocuments({
    doctorReviewed: false,
    $or: [
      { 'analysis.urgencyLevel': { $in: ['moderate', 'high'] } },
      { followUpRequired: true }
    ]
  });

  res.status(200).json({
    status: 'success',
    data: {
      analyses,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    }
  });
});

// Mark analysis as reviewed by doctor
const markAsReviewed = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { reviewNotes } = req.body;

  const analysis = await SymptomAnalysis.findById(id);

  if (!analysis) {
    return res.status(404).json({
      status: 'error',
      message: 'Symptom analysis not found'
    });
  }

  await analysis.markReviewed(req.user._id, reviewNotes);

  res.status(200).json({
    status: 'success',
    data: {
      analysis
    }
  });
});

// Get system analytics (admin only)
const getSystemAnalytics = catchAsync(async (req, res, next) => {
  const { days = 30 } = req.query;
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - parseInt(days));

  const analytics = await SymptomAnalysis.aggregate([
    { $match: { createdAt: { $gte: startDate } } },
    {
      $group: {
        _id: null,
        totalAnalyses: { $sum: 1 },
        emergencyCount: { $sum: { $cond: ['$isEmergency', 1, 0] } },
        highUrgency: { $sum: { $cond: [{ $eq: ['$analysis.urgencyLevel', 'high'] }, 1, 0] } },
        moderateUrgency: { $sum: { $cond: [{ $eq: ['$analysis.urgencyLevel', 'moderate'] }, 1, 0] } },
        lowUrgency: { $sum: { $cond: [{ $eq: ['$analysis.urgencyLevel', 'low'] }, 1, 0] } },
        averageConfidence: { $avg: '$analysis.confidence' },
        reviewedCount: { $sum: { $cond: ['$doctorReviewed', 1, 0] } },
        uniquePatients: { $addToSet: '$patientId' }
      }
    }
  ]);

  const dailyTrends = await SymptomAnalysis.aggregate([
    { $match: { createdAt: { $gte: startDate } } },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
        count: { $sum: 1 },
        emergencies: { $sum: { $cond: ['$isEmergency', 1, 0] } }
      }
    },
    { $sort: { _id: 1 } }
  ]);

  const topSymptoms = await SymptomAnalysis.aggregate([
    { $match: { createdAt: { $gte: startDate } } },
    { $unwind: '$selectedSymptoms' },
    { 
      $group: {
        _id: '$selectedSymptoms',
        count: { $sum: 1 }
      }
    },
    { $sort: { count: -1 } },
    { $limit: 20 }
  ]);

  res.status(200).json({
    status: 'success',
    data: {
      analytics: analytics[0] ? {
        ...analytics[0],
        uniquePatients: analytics[0].uniquePatients.length
      } : {},
      dailyTrends,
      topSymptoms
    }
  });
});

module.exports = {
  createSymptomAnalysis,
  getPatientSymptomHistory,
  getSymptomAnalysis,
  updateSymptomAnalysis,
  deleteSymptomAnalysis,
  getPatientAnalytics,
  getEmergencyAnalyses,
  getPendingReviews,
  markAsReviewed,
  getSystemAnalytics
};