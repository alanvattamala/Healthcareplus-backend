import mongoose from 'mongoose';

const scheduleSchema = new mongoose.Schema({
  doctorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  date: {
    type: Date,
    required: true
  },
  startTime: {
    type: String,
    required: true
  },
  endTime: {
    type: String,
    required: true
  },
  totalSlots: {
    type: Number,
    required: true,
    default: 6,
    min: 1,
    max: 50
  },
  slotDuration: {
    type: Number, // Duration in minutes
    required: true
  },
  availableSlots: [{
    slotNumber: {
      type: Number,
      required: true
    },
    startTime: {
      type: String,
      required: true
    },
    endTime: {
      type: String,
      required: true
    },
    duration: {
      type: Number, // Duration in minutes for this specific slot
      required: true
    },
    isBooked: {
      type: Boolean,
      default: false
    },
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    bookingTime: {
      type: Date,
      default: null
    },
    status: {
      type: String,
      enum: ['available', 'booked', 'cancelled', 'completed'],
      default: 'available'
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  isActive: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Create compound index for efficient queries
scheduleSchema.index({ doctorId: 1, date: 1 }, { unique: true });

const Schedule = mongoose.model('Schedule', scheduleSchema);

export default Schedule;