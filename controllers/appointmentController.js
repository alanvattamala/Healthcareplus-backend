import Appointment from '../models/Appointment.js';
import User from '../models/User.js';
import Schedule from '../models/Schedule.js';
import catchAsync from '../utils/catchAsync.js';

// Helper function to parse date string to UTC date without timezone conversion
const parseLocalDate = (dateString) => {
  console.log('Parsing date string:', dateString);
  const [year, month, day] = dateString.split('-').map(Number);
  // Set to noon UTC to avoid timezone boundary issues
  const parsedDate = new Date(Date.UTC(year, month - 1, day, 12, 0, 0, 0));
  console.log('Parsed date result:', {
    input: dateString,
    year, month, day,
    parsedDate: parsedDate.toISOString(),
    parsedDateUTC: parsedDate.toUTCString()
  });
  return parsedDate;
};

// Helper function to create broader date range for schedule matching
const getDateRange = (targetDate) => {
  const startOfDay = new Date(targetDate);
  startOfDay.setUTCHours(0, 0, 0, 0);
  const endOfDay = new Date(targetDate);
  endOfDay.setUTCHours(23, 59, 59, 999);
  return { startOfDay, endOfDay };
};

// @desc    Book a new appointment
// @route   POST /api/appointments/book
// @access  Private (Patient)
export const bookAppointment = catchAsync(async (req, res) => {
  const { doctorId, date, time, timeSlot, reason, type } = req.body;
  
  console.log('Appointment booking request:', { doctorId, date, time, timeSlot, reason, type });
  console.log('Patient ID:', req.user._id);
  
  // Validate required fields
  if (!doctorId || !date || !time || !reason) {
    return res.status(400).json({
      success: false,
      message: 'Doctor, date, time, and reason are required'
    });
  }

  // Verify doctor exists and has correct role
  const doctor = await User.findById(doctorId);
  console.log('Found doctor:', doctor ? { id: doctor._id, name: `${doctor.firstName} ${doctor.lastName}`, userType: doctor.userType, isActive: doctor.isActive } : 'null');
  
  if (!doctor) {
    return res.status(404).json({
      success: false,
      message: `Doctor not found with ID: ${doctorId}`
    });
  }
  
  if (doctor.userType !== 'doctor') {
    return res.status(400).json({
      success: false,
      message: `User is not a doctor. User type: ${doctor.userType}`
    });
  }
  
  // Parse the date to ensure it's a valid Date object and use same approach as userController
  const appointmentDate = parseLocalDate(date);
  if (isNaN(appointmentDate.getTime())) {
    return res.status(400).json({
      success: false,
      message: 'Invalid date format'
    });
  }

  // Check if appointment is for today or a future date
  const today = new Date();
  const todayUTC = parseLocalDate(today.toISOString().split('T')[0]); // Use consistent parsing
  
  const isAppointmentToday = appointmentDate.getTime() === todayUTC.getTime();
  const isAppointmentFuture = appointmentDate.getTime() > todayUTC.getTime();
  const isAppointmentPast = appointmentDate.getTime() < todayUTC.getTime();

  console.log('Date comparison:', {
    inputDate: date,
    appointmentDate: appointmentDate.toISOString(),
    todayUTC: todayUTC.toISOString(),
    todayLocal: today.toISOString(),
    isAppointmentToday,
    isAppointmentFuture,
    isAppointmentPast,
    doctorIsActive: doctor.isActive
  });

  // Prevent booking for past dates
  if (isAppointmentPast) {
    return res.status(400).json({
      success: false,
      message: 'Cannot book appointments for past dates'
    });
  }

  // Only check doctor's active status for same-day appointments
  // Allow future appointments even if doctor is offline (as long as they have a schedule)
  if (isAppointmentToday && !doctor.isActive) {
    console.log('Blocking same-day appointment for offline doctor');
    return res.status(400).json({
      success: false,
      message: 'Doctor is not available for same-day appointments while offline. Please book for a future date or try again when the doctor is online.'
    });
  }

  // Check if the doctor has a schedule for this specific date using date range approach
  // Create date range for the target date to handle both old (midnight) and new (noon) date formats
  const { startOfDay, endOfDay } = getDateRange(appointmentDate);
  
  console.log('Schedule search with date range:', {
    doctorId,
    requestedDate: date,
    parsedAppointmentDate: appointmentDate.toISOString(),
    startOfDay: startOfDay.toISOString(),
    endOfDay: endOfDay.toISOString(),
    isAppointmentToday,
    isAppointmentFuture,
    doctorIsActive: doctor.isActive
  });
  
  // First, let's check if ANY schedule exists for this doctor and date using date range
  const allSchedules = await Schedule.find({
    doctorId: doctorId,
    date: {
      $gte: startOfDay,
      $lte: endOfDay
    }
  });
  
  console.log('All schedules for doctor and date:', allSchedules.map(s => ({
    id: s._id,
    doctorId: s.doctorId,
    date: s.date,
    isActive: s.isActive,
    startTime: s.startTime,
    endTime: s.endTime
  })));
  
  const schedule = await Schedule.findOne({
    doctorId: doctorId,
    date: {
      $gte: startOfDay,
      $lte: endOfDay
    },
    isActive: true
  });

  console.log('Schedule search for appointment booking:', {
    doctorId,
    requestedDate: date,
    parsedAppointmentDate: appointmentDate.toISOString(),
    isAppointmentToday,
    isAppointmentFuture,
    doctorIsActive: doctor.isActive,
    allSchedulesCount: allSchedules.length,
    activeScheduleFound: !!schedule,
    query: { doctorId: doctorId, date: appointmentDate, isActive: true }
  });

  console.log('Schedule search result:', schedule ? { id: schedule._id, doctorId: schedule.doctorId, date: schedule.date } : 'null');

  if (!schedule) {
    // For future dates, provide more specific error message
    const errorMessage = isAppointmentToday 
      ? 'Doctor is not available on this day'
      : 'Doctor has not set up a schedule for this date yet';
      
    console.log('No schedule found, returning error:', errorMessage);
    return res.status(400).json({
      success: false,
      message: errorMessage
    });
  }

  // Additional check: For future dates with offline doctors, ensure schedule exists
  // This is the key fix - we found a schedule, so booking should be allowed
  if (!isAppointmentToday && !doctor.isActive) {
    console.log('Allowing future booking for offline doctor - schedule exists');
  }

  // Check if the requested time slot is available
  // Extract start time from time slot format (e.g., "14:00-14:18" -> "14:00")
  const startTime = time.includes('-') ? time.split('-')[0] : time;
  
  console.log('Looking for time slot:', { 
    requestedTime: time, 
    timeSlot: timeSlot,
    extractedStartTime: startTime, 
    availableSlots: schedule.availableSlots.map(s => ({ 
      id: s._id,
      start: s.startTime, 
      end: s.endTime,
      isBooked: s.isBooked,
      timeSlot: `${s.startTime}-${s.endTime}`
    })) 
  });
  
  // Find the requested time slot - match by start time
  const requestedTimeSlot = schedule.availableSlots.find(slot => 
    slot.startTime === startTime && !slot.isBooked
  );

  if (!requestedTimeSlot) {
    // Check if the slot exists but is already booked
    const bookedSlot = schedule.availableSlots.find(slot => slot.startTime === startTime);
    if (bookedSlot && bookedSlot.isBooked) {
      return res.status(400).json({
        success: false,
        message: 'This time slot has already been booked by another patient. Please select a different time slot.'
      });
    }
    
    return res.status(400).json({
      success: false,
      message: 'Requested time slot is not available or does not exist in the schedule'
    });
  }

  // Create the appointment
  console.log('Creating appointment with data:', {
    originalDateString: date,
    parsedAppointmentDate: appointmentDate.toISOString(),
    appointmentDateUTC: appointmentDate.toUTCString(),
    dateToStore: appointmentDate,
    patientId: req.user._id,
    doctorId: doctorId,
    startTime: startTime,
    timeSlot: timeSlot || `${requestedTimeSlot.startTime}-${requestedTimeSlot.endTime}`,
    slotId: requestedTimeSlot._id,
    duration: schedule.slotDuration,
    scheduleId: schedule._id
  });
  
  const appointment = await Appointment.create({
    patient: req.user._id,
    doctor: doctorId,
    date: appointmentDate,
    time: startTime, // Store the start time
    timeSlot: timeSlot || `${requestedTimeSlot.startTime}-${requestedTimeSlot.endTime}`, // Store the full time slot
    reason,
    type: type || 'consultation',
    slotId: requestedTimeSlot._id,
    scheduleId: schedule._id,
    duration: schedule.slotDuration,
    status: 'scheduled'
  });

  console.log('Created appointment with stored data:', {
    appointmentId: appointment._id,
    storedDate: appointment.date.toISOString(),
    storedDateUTC: appointment.date.toUTCString(),
    storedTime: appointment.time,
    storedTimeSlot: appointment.timeSlot,
    status: appointment.status
  });

  // Mark the time slot as booked using atomic update to avoid validation issues
  const updateResult = await Schedule.findOneAndUpdate(
    { 
      _id: schedule._id,
      'availableSlots._id': requestedTimeSlot._id 
    },
    {
      $set: {
        'availableSlots.$.isBooked': true,
        'availableSlots.$.patientId': req.user._id,
        'availableSlots.$.appointmentId': appointment._id,
        'availableSlots.$.bookingTime': new Date(),
        'availableSlots.$.status': 'booked'
      }
    },
    { new: true }
  );

  console.log('Slot booking update result:', updateResult ? 'Success' : 'Failed');

  // Populate doctor and patient information for the response
  await appointment.populate([
    {
      path: 'doctor',
      select: 'firstName lastName email phone specialization experience userType'
    },
    {
      path: 'patient',
      select: 'firstName lastName email phone'
    }
  ]);

  console.log('Appointment booking completed successfully:', {
    appointmentId: appointment._id,
    doctorName: `${appointment.doctor.firstName} ${appointment.doctor.lastName}`,
    patientName: `${appointment.patient.firstName} ${appointment.patient.lastName}`,
    appointmentDate: appointment.date.toISOString(),
    timeSlot: appointment.timeSlot || `${startTime}-${requestedTimeSlot.endTime}`,
    bookingType: isAppointmentToday ? 'same-day' : 'future',
    doctorStatus: doctor.isActive ? 'online' : 'offline'
  });

  res.status(201).json({
    success: true,
    message: `Appointment successfully booked with ${appointment.doctor.firstName} ${appointment.doctor.lastName}`,
    data: {
      appointment: {
        id: appointment._id,
        date: appointment.date,
        time: appointment.time,
        timeSlot: appointment.timeSlot || `${startTime}-${requestedTimeSlot.endTime}`,
        duration: appointment.duration,
        reason: appointment.reason,
        type: appointment.type,
        status: appointment.status
      },
      doctor: {
        id: appointment.doctor._id,
        name: `${appointment.doctor.firstName} ${appointment.doctor.lastName}`,
        email: appointment.doctor.email,
        phone: appointment.doctor.phone,
        specialization: appointment.doctor.specialization,
        isActive: doctor.isActive
      },
      patient: {
        id: appointment.patient._id,
        name: `${appointment.patient.firstName} ${appointment.patient.lastName}`,
        email: appointment.patient.email,
        phone: appointment.patient.phone
      },
      bookingInfo: {
        isToday: isAppointmentToday,
        isFuture: isAppointmentFuture,
        bookingTime: new Date().toISOString(),
        slotDuration: schedule.slotDuration
      }
    }
  });
});

// @desc    Fix existing schedules to use noon UTC format (migration helper)
// @route   POST /api/appointments/fix-schedule-dates
// @access  Private (Admin) - for migration purposes
export const fixScheduleDates = catchAsync(async (req, res) => {
  console.log('Starting schedule date migration...');
  
  // Find all schedules with dates at midnight UTC (old format)
  const schedules = await Schedule.find({
    $expr: {
      $and: [
        { $eq: [{ $hour: "$date" }, 0] },
        { $eq: [{ $minute: "$date" }, 0] },
        { $eq: [{ $second: "$date" }, 0] }
      ]
    }
  });
  
  console.log(`Found ${schedules.length} schedules with midnight UTC dates to migrate`);
  
  let migrated = 0;
  for (const schedule of schedules) {
    const oldDate = schedule.date;
    const newDate = new Date(oldDate);
    newDate.setUTCHours(12, 0, 0, 0); // Set to noon UTC
    
    await Schedule.findByIdAndUpdate(schedule._id, { date: newDate });
    console.log(`Migrated schedule ${schedule._id} from ${oldDate.toISOString()} to ${newDate.toISOString()}`);
    migrated++;
  }
  
  res.status(200).json({
    success: true,
    message: `Successfully migrated ${migrated} schedules to noon UTC format`,
    data: {
      totalFound: schedules.length,
      migrated: migrated
    }
  });
});

// @desc    Get patient's appointments
// @route   GET /api/appointments/my-appointments
// @access  Private (Patient)
export const getPatientAppointments = catchAsync(async (req, res) => {
  const { status, upcoming } = req.query;
  
  let query = { patient: req.user._id };
  
  // Filter by status if provided
  if (status) {
    query.status = status;
  }
  
  // Filter for upcoming appointments only
  if (upcoming === 'true') {
    const now = new Date();
    // Set to start of today to include all appointments from today onwards
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    query.date = { $gte: startOfToday };
  }

  const appointments = await Appointment.find(query)
    .populate({
      path: 'doctor',
      select: 'firstName lastName email phone specialization experience userType'
    })
    .sort({ date: 1, time: 1 });

  res.status(200).json({
    success: true,
    count: appointments.length,
    data: appointments
  });
});

// @desc    Get doctor's appointments
// @route   GET /api/appointments/doctor-appointments
// @access  Private (Doctor)
export const getDoctorAppointments = catchAsync(async (req, res) => {
  const { date, status } = req.query;
  
  console.log('🔍 getDoctorAppointments called with:', { date, status, doctorId: req.user._id });
  console.log('🔍 Expected doctor ID: 68be4e30959824f4ea581be7');
  console.log('🔍 Logged-in doctor ID:', req.user._id.toString());
  console.log('🔍 Doctor ID match:', req.user._id.toString() === '68be4e30959824f4ea581be7');
  
  let query = { doctor: req.user._id };
  
  // Filter by date if provided
  if (date) {
    console.log('📅 Processing date filter:', date);
    
    // Parse the date more carefully to handle timezone issues
    const inputDate = new Date(date);
    console.log('📅 Parsed input date:', inputDate.toISOString());
    
    // Create date range to cover the entire day in UTC
    const startOfDay = new Date(date + 'T00:00:00.000Z');
    const endOfDay = new Date(date + 'T23:59:59.999Z');
    
    console.log('📅 Date range:', {
      startOfDay: startOfDay.toISOString(),
      endOfDay: endOfDay.toISOString()
    });
    
    query.date = {
      $gte: startOfDay,
      $lte: endOfDay
    };
  }
  
  // Filter by status if provided
  if (status) {
    query.status = status;
  }

  console.log('🔍 Final query:', JSON.stringify(query, null, 2));

  const appointments = await Appointment.find(query)
    .populate({
      path: 'patient',
      select: 'firstName lastName email phone dateOfBirth gender userType'
    })
    .sort({ date: 1, time: 1 });

  console.log('📊 Found appointments:', appointments.length);
  console.log('📊 Appointment details:', appointments.map(apt => ({
    id: apt._id,
    date: apt.date,
    time: apt.time,
    doctor: apt.doctor,
    patient: apt.patient ? `${apt.patient.firstName} ${apt.patient.lastName}` : 'Unknown'
  })));

  res.status(200).json({
    success: true,
    count: appointments.length,
    data: appointments
  });
});

// @desc    Update appointment status
// @route   PATCH /api/appointments/:id/status
// @access  Private (Doctor/Patient)
export const updateAppointmentStatus = catchAsync(async (req, res) => {
  const { status } = req.body;
  const appointmentId = req.params.id;

  // Validate status
  const validStatuses = ['scheduled', 'confirmed', 'completed', 'cancelled', 'no-show'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid status'
    });
  }

  const appointment = await Appointment.findById(appointmentId);
  
  if (!appointment) {
    return res.status(404).json({
      success: false,
      message: 'Appointment not found'
    });
  }

  // Check if user has permission to update this appointment
  const isPatient = appointment.patient.toString() === req.user._id.toString();
  const isDoctor = appointment.doctor.toString() === req.user._id.toString();
  
  if (!isPatient && !isDoctor) {
    return res.status(403).json({
      success: false,
      message: 'Not authorized to update this appointment'
    });
  }

  appointment.status = status;
  await appointment.save();

  await appointment.populate([
    {
      path: 'doctor',
      select: 'firstName lastName email phone specialization experience userType'
    },
    {
      path: 'patient',
      select: 'firstName lastName email phone'
    }
  ]);

  res.status(200).json({
    success: true,
    message: 'Appointment status updated successfully',
    data: appointment
  });
});

// @desc    Cancel appointment
// @route   DELETE /api/appointments/:id
// @access  Private (Patient/Doctor)
export const cancelAppointment = catchAsync(async (req, res) => {
  const appointmentId = req.params.id;

  const appointment = await Appointment.findById(appointmentId);
  
  if (!appointment) {
    return res.status(404).json({
      success: false,
      message: 'Appointment not found'
    });
  }

  // Check if user has permission to cancel this appointment
  const isPatient = appointment.patient.toString() === req.user._id.toString();
  const isDoctor = appointment.doctor.toString() === req.user._id.toString();
  
  if (!isPatient && !isDoctor) {
    return res.status(403).json({
      success: false,
      message: 'Not authorized to cancel this appointment'
    });
  }

  appointment.status = 'cancelled';
  await appointment.save();

  res.status(200).json({
    success: true,
    message: 'Appointment cancelled successfully'
  });
});

// @desc    Get appointment details
// @route   GET /api/appointments/:id
// @access  Private (Patient/Doctor)
export const getAppointmentDetails = catchAsync(async (req, res) => {
  const appointmentId = req.params.id;

  const appointment = await Appointment.findById(appointmentId)
    .populate({
      path: 'doctor',
      select: 'firstName lastName email phone specialization experience userType'
    })
    .populate({
      path: 'patient',
      select: 'firstName lastName email phone dateOfBirth'
    });
  
  if (!appointment) {
    return res.status(404).json({
      success: false,
      message: 'Appointment not found'
    });
  }

  // Check if user has permission to view this appointment
  const isPatient = appointment.patient._id.toString() === req.user._id.toString();
  const isDoctor = appointment.doctor._id.toString() === req.user._id.toString();
  
  if (!isPatient && !isDoctor) {
    return res.status(403).json({
      success: false,
      message: 'Not authorized to view this appointment'
    });
  }

  res.status(200).json({
    success: true,
    data: appointment
  });
});

// @desc    Reschedule appointment
// @route   PATCH /api/appointments/:id/reschedule
// @access  Private (Patient/Doctor)
export const rescheduleAppointment = catchAsync(async (req, res) => {
  const appointmentId = req.params.id;
  const { newDate, newTime, reason } = req.body;

  const appointment = await Appointment.findById(appointmentId);
  
  if (!appointment) {
    return res.status(404).json({
      success: false,
      message: 'Appointment not found'
    });
  }

  // Check if user has permission to reschedule this appointment
  const isPatient = appointment.patient.toString() === req.user._id.toString();
  const isDoctor = appointment.doctor.toString() === req.user._id.toString();
  
  if (!isPatient && !isDoctor) {
    return res.status(403).json({
      success: false,
      message: 'Not authorized to reschedule this appointment'
    });
  }

  // Validate new date
  if (!newDate) {
    return res.status(400).json({
      success: false,
      message: 'New date is required'
    });
  }

  const newAppointmentDate = new Date(newDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (newAppointmentDate < today) {
    return res.status(400).json({
      success: false,
      message: 'Cannot reschedule to a past date'
    });
  }

  // Store old appointment details for history
  const oldDate = appointment.date;
  const oldTime = appointment.timeSlot || appointment.time;

  // Update appointment
  appointment.date = newAppointmentDate;
  if (newTime) {
    appointment.timeSlot = newTime;
    appointment.time = newTime;
  }
  appointment.status = 'rescheduled';
  
  // Add reschedule history
  if (!appointment.rescheduleHistory) {
    appointment.rescheduleHistory = [];
  }
  appointment.rescheduleHistory.push({
    oldDate,
    oldTime,
    newDate: newAppointmentDate,
    newTime: newTime || oldTime,
    reason: reason || 'Rescheduled by ' + (isPatient ? 'patient' : 'doctor'),
    rescheduledBy: req.user._id,
    rescheduledAt: new Date()
  });

  await appointment.save();

  // Populate doctor and patient information for the response
  await appointment.populate([
    {
      path: 'doctor',
      select: 'firstName lastName email phone specialization experience userType'
    },
    {
      path: 'patient',
      select: 'firstName lastName email phone'
    }
  ]);

  res.status(200).json({
    success: true,
    message: 'Appointment rescheduled successfully',
    data: appointment
  });
});

// @desc    Cancel appointment with details
// @route   PATCH /api/appointments/:id/cancel
// @access  Private (Patient/Doctor)
export const cancelAppointmentWithDetails = catchAsync(async (req, res) => {
  const appointmentId = req.params.id;
  const { cancellationReason, cancelledBy } = req.body;

  const appointment = await Appointment.findById(appointmentId);
  
  if (!appointment) {
    return res.status(404).json({
      success: false,
      message: 'Appointment not found'
    });
  }

  // Check if user has permission to cancel this appointment
  const isPatient = appointment.patient.toString() === req.user._id.toString();
  const isDoctor = appointment.doctor.toString() === req.user._id.toString();
  
  if (!isPatient && !isDoctor) {
    return res.status(403).json({
      success: false,
      message: 'Not authorized to cancel this appointment'
    });
  }

  // Update appointment with cancellation details
  appointment.status = 'cancelled';
  appointment.cancellationReason = cancellationReason || 'No reason provided';
  appointment.cancelledBy = cancelledBy || (isPatient ? 'patient' : 'doctor');
  appointment.cancelledAt = new Date();

  await appointment.save();

  // Populate doctor and patient information for the response
  await appointment.populate([
    {
      path: 'doctor',
      select: 'firstName lastName email phone specialization experience userType'
    },
    {
      path: 'patient',
      select: 'firstName lastName email phone'
    }
  ]);

  res.status(200).json({
    success: true,
    message: 'Appointment cancelled successfully',
    data: appointment
  });
});
