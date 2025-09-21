import mongoose from 'mongoose';

const approvalSchema = new mongoose.Schema({
  // Doctor who submitted the request
  doctorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  // Type of approval request
  type: {
    type: String,
    enum: ['consultation_fee', 'profile_verification', 'schedule_change'],
    required: true
  },

  // Request details
  requestData: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },

  // Current status
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },

  // Admin who processed the request
  processedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },

  // Admin's decision reason
  reason: {
    type: String,
    default: null
  },

  // Timestamps
  submittedAt: {
    type: Date,
    default: Date.now
  },

  processedAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

// Index for efficient queries
approvalSchema.index({ doctorId: 1, type: 1, status: 1 });
approvalSchema.index({ status: 1, submittedAt: -1 });

// Virtual to populate doctor details
approvalSchema.virtual('doctor', {
  ref: 'User',
  localField: 'doctorId',
  foreignField: '_id',
  justOne: true
});

// Virtual to populate admin details
approvalSchema.virtual('admin', {
  ref: 'User',
  localField: 'processedBy',
  foreignField: '_id',
  justOne: true
});

// Ensure virtual fields are serialized
approvalSchema.set('toJSON', { virtuals: true });
approvalSchema.set('toObject', { virtuals: true });

const Approval = mongoose.model('Approval', approvalSchema);

export default Approval;