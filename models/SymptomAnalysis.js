import mongoose from 'mongoose';

const symptomAnalysisSchema = new mongoose.Schema({
  patientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  symptoms: {
    type: String,
    required: true,
    trim: true
  },
  selectedSymptoms: [{
    type: String,
    trim: true
  }],
  severity: {
    type: String,
    enum: ['mild', 'moderate', 'severe'],
    required: true
  },
  duration: {
    type: String,
    enum: ['hours', '1-2days', '3-7days', '1-2weeks', 'longer'],
    required: true
  },
  additionalInfo: {
    age: String,
    gender: String,
    medicalHistory: String,
    currentMedications: String
  },
  analysis: {
    possibleConditions: [{
      condition: String,
      confidence: Number,
      description: String,
      treatmentAdvice: [String],
      duration: String,
      urgency: String
    }],
    recommendations: [String],
    urgencyLevel: {
      type: String,
      enum: ['low', 'moderate', 'high']
    },
    confidence: Number,
    detectedSymptoms: [{
      name: String,
      weight: Number,
      urgency: String
    }],
    disclaimer: String,
    analysisMethod: String
  },
  isEmergency: {
    type: Boolean,
    default: false
  },
  followUpRequired: {
    type: Boolean,
    default: false
  },
  doctorReviewed: {
    type: Boolean,
    default: false
  },
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  reviewNotes: String,
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Index for efficient queries
symptomAnalysisSchema.index({ patientId: 1, createdAt: -1 });
symptomAnalysisSchema.index({ urgencyLevel: 1, createdAt: -1 });
symptomAnalysisSchema.index({ isEmergency: 1, createdAt: -1 });

// Virtual for age at time of analysis
symptomAnalysisSchema.virtual('analysisAge').get(function() {
  return Math.floor((Date.now() - this.createdAt.getTime()) / (1000 * 60 * 60 * 24));
});

// Static method to get patient's symptom history
symptomAnalysisSchema.statics.getPatientHistory = function(patientId, limit = 10) {
  return this.find({ patientId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate('patientId', 'firstName lastName email')
    .populate('reviewedBy', 'firstName lastName');
};

// Static method to get emergency analyses
symptomAnalysisSchema.statics.getEmergencyAnalyses = function(limit = 50) {
  return this.find({ 
    $or: [
      { isEmergency: true },
      { urgencyLevel: 'high' }
    ]
  })
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate('patientId', 'firstName lastName email phone');
};

// Static method to get analyses requiring doctor review
symptomAnalysisSchema.statics.getPendingReviews = function(limit = 100) {
  return this.find({ 
    doctorReviewed: false,
    $or: [
      { urgencyLevel: { $in: ['moderate', 'high'] } },
      { followUpRequired: true }
    ]
  })
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate('patientId', 'firstName lastName email');
};

// Method to mark as reviewed by doctor
symptomAnalysisSchema.methods.markReviewed = function(doctorId, notes = '') {
  this.doctorReviewed = true;
  this.reviewedBy = doctorId;
  this.reviewNotes = notes;
  this.updatedAt = new Date();
  return this.save();
};

// Pre-save middleware to update updatedAt
symptomAnalysisSchema.pre('save', function(next) {
  if (this.isModified() && !this.isNew) {
    this.updatedAt = new Date();
  }
  next();
});

// Instance method to get follow-up recommendations
symptomAnalysisSchema.methods.getFollowUpRecommendations = function() {
  const recommendations = [];
  
  if (this.analysis.urgencyLevel === 'high') {
    recommendations.push('Schedule urgent appointment within 24 hours');
    recommendations.push('Monitor symptoms closely');
  } else if (this.analysis.urgencyLevel === 'moderate') {
    recommendations.push('Schedule appointment within 3-5 days');
    recommendations.push('Continue monitoring symptoms');
  } else {
    recommendations.push('Monitor symptoms for improvement');
    recommendations.push('Schedule routine check-up if symptoms persist');
  }
  
  if (this.isEmergency) {
    recommendations.unshift('Seek immediate medical attention');
  }
  
  return recommendations;
};

// Static method for analytics
symptomAnalysisSchema.statics.getAnalytics = function(dateRange = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - dateRange);
  
  return this.aggregate([
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
        reviewedCount: { $sum: { $cond: ['$doctorReviewed', 1, 0] } }
      }
    }
  ]);
};

const SymptomAnalysis = mongoose.model('SymptomAnalysis', symptomAnalysisSchema);

export default SymptomAnalysis;