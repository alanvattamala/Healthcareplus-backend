import Schedule from '../models/Schedule.js';
import catchAsync from '../utils/catchAsync.js';

// Helper function to parse date string in local timezone to avoid timezone issues
const parseLocalDate = (dateString) => {
  // Expect format: YYYY-MM-DD
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    return null;
  }
  
  const [year, month, day] = dateString.split('-').map(Number);
  // Create date in UTC to avoid timezone issues when storing in database
  const date = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
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
  const { startTime, endTime } = req.body;
  
  // Validate required fields
  if (!startTime || !endTime) {
    return res.status(400).json({
      success: false,
      message: 'Start time and end time are required'
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
    data: { schedule }
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
    const { date, startTime, endTime } = schedules[i];
    
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
      const schedule = await Schedule.findOneAndUpdate(
        { doctorId, date: scheduleDate },
        {
          doctorId,
          date: scheduleDate,
          startTime,
          endTime,
          isActive: true
        },
        {
          new: true,
          upsert: true,
          runValidators: true
        }
      ).populate('doctorId', 'firstName lastName email');

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

export {
  getTodaySchedule,
  saveTodaySchedule,
  getScheduleHistory,
  deleteTodaySchedule,
  getUpcomingSchedules,
  saveUpcomingSchedules,
  deleteUpcomingSchedule,
  checkScheduleExists
};