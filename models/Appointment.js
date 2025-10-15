import mongoose from 'mongoose';

const appointmentSchema = new mongoose.Schema({
  patient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Patient ID is required']
  },
  doctor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Doctor ID is required']
  },
  date: {
    type: Date,
    required: [true, 'Appointment date is required']
  },
  time: {
    type: String,
    required: [true, 'Appointment start time is required']
  },
  timeSlot: {
    type: String, // Full time slot (e.g., "14:00-14:20")
    required: false
  },
  reason: {
    type: String,
    required: [true, 'Reason for visit is required'],
    trim: true
  },
  type: {
    type: String,
    enum: ['consultation', 'follow-up', 'checkup', 'emergency'],
    default: 'consultation'
  },
  status: {
    type: String,
    enum: ['scheduled', 'confirmed', 'completed', 'cancelled', 'no-show', 'rescheduled'],
    default: 'scheduled'
  },
  notes: {
    type: String,
    trim: true
  },
  duration: {
    type: Number, // in minutes
    default: 30
  },
  slotId: {
    type: String, // for tracking specific time slots
    required: false
  },
  scheduleId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Schedule',
    required: false
  },
  // Cancellation details
  cancellationReason: {
    type: String,
    trim: true
  },
  cancelledBy: {
    type: String,
    enum: ['patient', 'doctor', 'admin']
  },
  cancelledAt: {
    type: Date
  },
  // Reschedule history
  rescheduleHistory: [{
    oldDate: Date,
    oldTime: String,
    newDate: Date,
    newTime: String,
    reason: String,
    rescheduledBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    rescheduledAt: {
      type: Date,
      default: Date.now
    }
  }]
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Index for better query performance
appointmentSchema.index({ patient: 1, date: 1 });
appointmentSchema.index({ doctor: 1, date: 1 });
appointmentSchema.index({ date: 1, time: 1 });

// Virtual for formatted date
appointmentSchema.virtual('formattedDate').get(function() {
  return this.date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
});

// Virtual for appointment datetime
appointmentSchema.virtual('appointmentDateTime').get(function() {
  const [hours, minutes] = this.time.split(':');
  const appointmentDate = new Date(this.date);
  appointmentDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);
  return appointmentDate;
});

// Pre-save middleware to ensure no double booking
appointmentSchema.pre('save', async function(next) {
  if (!this.isNew) return next();
  
  // Check for existing appointment at the same time slot
  const existingAppointment = await this.constructor.findOne({
    doctor: this.doctor,
    date: this.date,
    time: this.time,
    status: { $in: ['scheduled', 'confirmed'] }
  });
  
  if (existingAppointment) {
    const error = new Error('This time slot is already booked');
    error.statusCode = 400;
    return next(error);
  }
  
  next();
});

const Appointment = mongoose.model('Appointment', appointmentSchema);

export default Appointment;
