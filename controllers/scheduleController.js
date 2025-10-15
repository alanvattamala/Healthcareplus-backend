import Schedule from '../models/Schedule.js';
import catchAsync from '../utils/catchAsync.js';

// Helper function to parse date string in local timezone to avoid timezone issues
const parseLocalDate = (dateString) => {
  // Expect format: YYYY-MM-DD
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    return null;
  }
  
  const [year, month, day] = dateString.split('-').map(Number);
  // Create date in UTC with noon time to avoid timezone boundary issues
  const date = new Date(Date.UTC(year, month - 1, day, 12, 0, 0, 0));
  return date;
};

// Get today's schedule for the authenticated doctor
const getTodaySchedule = catchAsync(async (req, res) => {
  const doctorId = req.user.id;
  const today = new Date();
  // Create today's date in UTC to match how we store dates
  const todayUTC = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0, 0));
  
  const schedule = await Schedule.findOne({
    doctorId,
    date: todayUTC
  });

  res.status(200).json({
    success: true,
    data: {
      schedule,
      hasSchedule: !!schedule
    }
  });
});

// Save or update today's schedule
const saveTodaySchedule = catchAsync(async (req, res) => {
  const doctorId = req.user.id;
  const { startTime, endTime, totalSlots, slotDuration, availableSlots } = req.body;
  
  console.log('Received today schedule data:', { startTime, endTime, totalSlots, slotDuration, availableSlots: availableSlots?.length });
  
  // Validate required fields
  if (!startTime || !endTime) {
    return res.status(400).json({
      success: false,
      message: 'Start time and end time are required'
    });
  }

  // Set default values for slot fields if not provided
  const scheduleTotalSlots = totalSlots || 6;
  const scheduleSlotDuration = slotDuration || Math.floor(((new Date(`1970-01-01T${endTime}:00`) - new Date(`1970-01-01T${startTime}:00`)) / (1000 * 60)) / scheduleTotalSlots);
  const scheduleAvailableSlots = availableSlots || [];

  // Validate slot data
  if (scheduleTotalSlots < 1 || scheduleTotalSlots > 50) {
    return res.status(400).json({
      success: false,
      message: 'Total slots must be between 1 and 50'
    });
  }

  // Validate time format (HH:MM)
  const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
  if (!timeRegex.test(startTime) || !timeRegex.test(endTime)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid time format. Please use HH:MM format'
    });
  }

  // Validate that end time is after start time
  const [startHour, startMinute] = startTime.split(':').map(Number);
  const [endHour, endMinute] = endTime.split(':').map(Number);
  const startMinutes = startHour * 60 + startMinute;
  const endMinutes = endHour * 60 + endMinute;

  // Validate minimum slot duration (10 minutes)
  const totalMinutes = endMinutes - startMinutes;
  const calculatedSlotDuration = Math.floor(totalMinutes / scheduleTotalSlots);
  if (calculatedSlotDuration < 10) {
    const maxSlots = Math.floor(totalMinutes / 10);
    return res.status(400).json({
      success: false,
      message: `Slot duration is ${calculatedSlotDuration} minutes. Minimum required is 10 minutes. Maximum slots allowed for this time range: ${maxSlots}`
    });
  }

  if (endMinutes <= startMinutes) {
    return res.status(400).json({
      success: false,
      message: 'End time must be after start time'
    });
  }

  // Check minimum duration (30 minutes)
  if (endMinutes - startMinutes < 30) {
    return res.status(400).json({
      success: false,
      message: 'Schedule must be at least 30 minutes long'
    });
  }

  // Validate and enhance slot data
  let processedSlots = [];
  if (scheduleAvailableSlots && Array.isArray(scheduleAvailableSlots)) {
    processedSlots = scheduleAvailableSlots.map((slot, index) => ({
      slotNumber: slot.slotNumber || (index + 1),
      startTime: slot.startTime,
      endTime: slot.endTime,
      duration: slot.duration || scheduleSlotDuration,
      isBooked: slot.isBooked || false,
      patientId: slot.patientId || null,
      bookingTime: slot.bookingTime || null,
      status: slot.status || 'available',
      createdAt: slot.createdAt || new Date()
    }));

    // Validate each slot
    for (const slot of processedSlots) {
      if (!slot.startTime || !slot.endTime) {
        return res.status(400).json({
          success: false,
          message: `Invalid slot data: startTime and endTime are required for slot ${slot.slotNumber}`
        });
      }

      // Validate time format
      if (!timeRegex.test(slot.startTime) || !timeRegex.test(slot.endTime)) {
        return res.status(400).json({
          success: false,
          message: `Invalid time format in slot ${slot.slotNumber}. Please use HH:MM format`
        });
      }
    }

    console.log(`Processed ${processedSlots.length} slots with detailed information`);
  }

  const today = new Date();
  // Create today's date in UTC to match how we store dates
  const todayUTC = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0, 0));

  // Use findOneAndUpdate with upsert to create or update
  const schedule = await Schedule.findOneAndUpdate(
    { doctorId, date: todayUTC },
    {
      doctorId,
      date: todayUTC,
      startTime,
      endTime,
      totalSlots: scheduleTotalSlots,
      slotDuration: scheduleSlotDuration,
      availableSlots: processedSlots,
      isActive: true
    },
    {
      new: true,
      upsert: true,
      runValidators: true
    }
  ).populate('doctorId', 'firstName lastName email');

  res.status(200).json({
    success: true,
    message: 'Schedule saved successfully',
    data: { 
      schedule,
      slotsCreated: processedSlots.length,
      slotsSummary: {
        total: processedSlots.length,
        available: processedSlots.filter(slot => slot.status === 'available').length,
        booked: processedSlots.filter(slot => slot.status === 'booked').length,
        averageDuration: scheduleSlotDuration
      }
    }
  });
});

// Get schedule history for the doctor
const getScheduleHistory = catchAsync(async (req, res) => {
  const doctorId = req.user.id;
  const { page = 1, limit = 10 } = req.query;
  
  const skip = (page - 1) * limit;

  const schedules = await Schedule.find({ doctorId })
    .sort({ date: -1 })
    .skip(skip)
    .limit(parseInt(limit))
    .populate('doctorId', 'firstName lastName email');

  const total = await Schedule.countDocuments({ doctorId });

  res.status(200).json({
    success: true,
    data: {
      schedules,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total,
        hasNext: page * limit < total,
        hasPrev: page > 1
      }
    }
  });
});

// Delete today's schedule
const deleteTodaySchedule = catchAsync(async (req, res) => {
  const doctorId = req.user.id;
  const today = new Date();
  // Create today's date in UTC to match how we store dates
  const todayUTC = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0, 0));

  const schedule = await Schedule.findOneAndDelete({
    doctorId,
    date: todayUTC
  });

  if (!schedule) {
    return res.status(404).json({
      success: false,
      message: 'No schedule found for today'
    });
  }

  res.status(200).json({
    success: true,
    message: 'Schedule deleted successfully'
  });
});

// Get upcoming schedules for the authenticated doctor
const getUpcomingSchedules = catchAsync(async (req, res) => {
  const doctorId = req.user.id;
  const today = new Date();
  const todayUTC = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0, 0));
  
  // Get schedules from today onwards
  const schedules = await Schedule.find({
    doctorId,
    date: { $gte: todayUTC }
  })
  .sort({ date: 1 })
  .populate('doctorId', 'firstName lastName email');

  res.status(200).json({
    success: true,
    data: {
      schedules,
      count: schedules.length
    }
  });
});

// Save multiple upcoming schedules
const saveUpcomingSchedules = catchAsync(async (req, res) => {
  const doctorId = req.user.id;
  const { schedules } = req.body;
  
  console.log('Received schedules data:', JSON.stringify(schedules, null, 2));
  
  // Validate schedules array
  if (!schedules || !Array.isArray(schedules) || schedules.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Schedules array is required and cannot be empty'
    });
  }

  const savedSchedules = [];
  const errors = [];

  for (let i = 0; i < schedules.length; i++) {
    const { date, startTime, endTime, totalSlots, slotDuration, availableSlots } = schedules[i];
    
    try {
      // Validate required fields
      if (!date || !startTime || !endTime) {
        errors.push({
          index: i,
          date,
          error: 'Date, start time, and end time are required'
        });
        continue;
      }

      // Set default values for slot fields if not provided
      const scheduleTotalSlots = totalSlots || 6;
      const scheduleSlotDuration = slotDuration || Math.floor(((new Date(`1970-01-01T${endTime}:00`) - new Date(`1970-01-01T${startTime}:00`)) / (1000 * 60)) / scheduleTotalSlots);
      const scheduleAvailableSlots = availableSlots || [];

      // Validate slot data
      if (scheduleTotalSlots < 1 || scheduleTotalSlots > 50) {
        errors.push({
          index: i,
          date,
          error: 'Total slots must be between 1 and 50'
        });
        continue;
      }

      // Validate time format (HH:MM)
      const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
      if (!timeRegex.test(startTime) || !timeRegex.test(endTime)) {
        errors.push({
          index: i,
          date,
          error: 'Invalid time format. Please use HH:MM format'
        });
        continue;
      }

      // Validate that end time is after start time
      const [startHour, startMinute] = startTime.split(':').map(Number);
      const [endHour, endMinute] = endTime.split(':').map(Number);
      const startMinutes = startHour * 60 + startMinute;
      const endMinutes = endHour * 60 + endMinute;

      // Validate minimum slot duration (10 minutes)
      const totalMinutes = endMinutes - startMinutes;
      const calculatedSlotDuration = Math.floor(totalMinutes / scheduleTotalSlots);
      if (calculatedSlotDuration < 10) {
        const maxSlots = Math.floor(totalMinutes / 10);
        errors.push({
          index: i,
          date,
          error: `Slot duration is ${calculatedSlotDuration} minutes. Minimum required is 10 minutes. Maximum slots allowed: ${maxSlots}`
        });
        continue;
      }

      if (endMinutes <= startMinutes) {
        errors.push({
          index: i,
          date,
          error: 'End time must be after start time'
        });
        continue;
      }

      // Check minimum duration (30 minutes)
      if (endMinutes - startMinutes < 30) {
        errors.push({
          index: i,
          date,
          error: 'Schedule must be at least 30 minutes long'
        });
        continue;
      }

      // Parse and validate date using local timezone
      const scheduleDate = parseLocalDate(date);
      
      if (!scheduleDate || isNaN(scheduleDate.getTime())) {
        errors.push({
          index: i,
          date,
          error: 'Invalid date format. Expected YYYY-MM-DD'
        });
        continue;
      }

      // Check if date is not in the past
      const today = new Date();
      const todayUTC = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0, 0));
      if (scheduleDate < todayUTC) {
        errors.push({
          index: i,
          date,
          error: 'Cannot create schedule for past dates'
        });
        continue;
      }

      // Use findOneAndUpdate with upsert to create or update
      console.log(`Saving schedule ${i + 1}:`, {
        doctorId,
        date: scheduleDate,
        startTime,
        endTime,
        totalSlots: scheduleTotalSlots,
        slotDuration: scheduleSlotDuration,
        availableSlotsCount: scheduleAvailableSlots.length
      });
      
      const schedule = await Schedule.findOneAndUpdate(
        { doctorId, date: scheduleDate },
        {
          doctorId,
          date: scheduleDate,
          startTime,
          endTime,
          totalSlots: scheduleTotalSlots,
          slotDuration: scheduleSlotDuration,
          availableSlots: scheduleAvailableSlots,
          isActive: true
        },
        {
          new: true,
          upsert: true,
          runValidators: true
        }
      ).populate('doctorId', 'firstName lastName email');

      console.log(`Successfully saved schedule ${i + 1}:`, schedule._id);
      savedSchedules.push(schedule);
    } catch (error) {
      errors.push({
        index: i,
        date,
        error: error.message
      });
    }
  }

  res.status(200).json({
    success: true,
    message: `Successfully saved ${savedSchedules.length} schedules${errors.length > 0 ? ` with ${errors.length} errors` : ''}`,
    data: {
      savedSchedules,
      errors,
      successCount: savedSchedules.length,
      errorCount: errors.length
    }
  });
});

// Delete specific upcoming schedule
const deleteUpcomingSchedule = catchAsync(async (req, res) => {
  const doctorId = req.user.id;
  const { scheduleId } = req.params;

  const schedule = await Schedule.findOneAndDelete({
    _id: scheduleId,
    doctorId
  });

  if (!schedule) {
    return res.status(404).json({
      success: false,
      message: 'Schedule not found or you do not have permission to delete it'
    });
  }

  res.status(200).json({
    success: true,
    message: 'Schedule deleted successfully',
    data: { schedule }
  });
});

// Check if schedule exists for specific dates
const checkScheduleExists = catchAsync(async (req, res) => {
  const doctorId = req.user.id;
  const { dates } = req.query;
  
  if (!dates) {
    return res.status(400).json({
      success: false,
      message: 'Dates parameter is required'
    });
  }

  const dateArray = dates.split(',').map(date => {
    const d = parseLocalDate(date);
    return d;
  }).filter(Boolean); // Remove any null dates

  const existingSchedules = await Schedule.find({
    doctorId,
    date: { $in: dateArray }
  });

  const scheduleDateMap = {};
  existingSchedules.forEach(schedule => {
    const dateKey = schedule.date.toISOString().split('T')[0];
    scheduleDateMap[dateKey] = {
      id: schedule._id,
      startTime: schedule.startTime,
      endTime: schedule.endTime,
      isActive: schedule.isActive
    };
  });

  res.status(200).json({
    success: true,
    data: {
      scheduleExists: scheduleDateMap
    }
  });
});

// Get detailed slot information for a specific schedule
const getScheduleSlots = catchAsync(async (req, res) => {
  const doctorId = req.user.id;
  const { date } = req.params;
  
  // Parse the date
  const targetDate = parseLocalDate(date);
  if (!targetDate) {
    return res.status(400).json({
      success: false,
      message: 'Invalid date format. Please use YYYY-MM-DD format'
    });
  }

  const schedule = await Schedule.findOne({
    doctorId,
    date: targetDate
  }).populate('availableSlots.patientId', 'firstName lastName email phone');

  if (!schedule) {
    return res.status(404).json({
      success: false,
      message: 'Schedule not found for the specified date'
    });
  }

  // Analyze slot statistics
  const slots = schedule.availableSlots || [];
  const slotAnalysis = {
    total: slots.length,
    available: slots.filter(slot => slot.status === 'available').length,
    booked: slots.filter(slot => slot.status === 'booked').length,
    cancelled: slots.filter(slot => slot.status === 'cancelled').length,
    completed: slots.filter(slot => slot.status === 'completed').length,
    averageDuration: schedule.slotDuration,
    scheduleUtilization: slots.length > 0 ? ((slots.filter(slot => slot.status === 'booked').length / slots.length) * 100).toFixed(1) : 0
  };

  res.status(200).json({
    success: true,
    data: {
      schedule,
      slots: slots,
      analysis: slotAnalysis
    }
  });
});

// Update slot status (for marking as completed, cancelled, etc.)
const updateSlotStatus = catchAsync(async (req, res) => {
  const doctorId = req.user.id;
  const { scheduleId, slotNumber } = req.params;
  const { status, notes } = req.body;

  // Validate status
  const validStatuses = ['available', 'booked', 'cancelled', 'completed'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({
      success: false,
      message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
    });
  }

  const schedule = await Schedule.findOne({
    _id: scheduleId,
    doctorId
  });

  if (!schedule) {
    return res.status(404).json({
      success: false,
      message: 'Schedule not found'
    });
  }

  // Find and update the specific slot
  const slot = schedule.availableSlots.find(s => s.slotNumber === parseInt(slotNumber));
  if (!slot) {
    return res.status(404).json({
      success: false,
      message: 'Slot not found'
    });
  }

  slot.status = status;
  if (notes) slot.notes = notes;
  
  await schedule.save();

  res.status(200).json({
    success: true,
    message: 'Slot status updated successfully',
    data: { slot }
  });
});

export {
  getTodaySchedule,
  saveTodaySchedule,
  getScheduleHistory,
  deleteTodaySchedule,
  getUpcomingSchedules,
  saveUpcomingSchedules,
  deleteUpcomingSchedule,
  checkScheduleExists,
  getScheduleSlots,
  updateSlotStatus
};