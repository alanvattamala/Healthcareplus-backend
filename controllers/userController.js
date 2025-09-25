import User from '../models/User.js';
import Schedule from '../models/Schedule.js';
import catchAsync from '../utils/catchAsync.js';
import AppError from '../utils/appError.js';

export const getAllUsers = catchAsync(async (req, res, next) => {
  const users = await User.find({ isActive: true }).select('-password');
  
  res.status(200).json({
    status: 'success',
    results: users.length,
    data: {
      users,
    },
  });
});

export const getUser = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.params.id);
  
  if (!user) {
    return next(new AppError('No user found with that ID', 404));
  }

  res.status(200).json({
    status: 'success',
    data: {
      user,
    },
  });
});

export const getAllDoctors = catchAsync(async (req, res, next) => {
  const query = { userType: 'doctor', isActive: true };
  
  // Filter by verification status if provided
  if (req.query.verified) {
    query.verificationStatus = req.query.verified === 'true' ? 'verified' : 'pending';
  }
  
  // Filter by specialization if provided
  if (req.query.specialization) {
    query.specialization = new RegExp(req.query.specialization, 'i');
  }

  const doctors = await User.find(query).select('-password');
  
  res.status(200).json({
    status: 'success',
    results: doctors.length,
    data: {
      doctors,
    },
  });
});

export const getAllPatients = catchAsync(async (req, res, next) => {
  const patients = await User.find({ 
    userType: 'patient', 
    isActive: true 
  }).select('-password');
  
  res.status(200).json({
    status: 'success',
    results: patients.length,
    data: {
      patients,
    },
  });
});

export const updateUser = catchAsync(async (req, res, next) => {
  // Only allow admins to update user status and verification
  const allowedFields = ['isActive', 'verificationStatus', 'adminLevel', 'permissions'];
  const updates = {};
  
  allowedFields.forEach(field => {
    if (req.body[field] !== undefined) {
      updates[field] = req.body[field];
    }
  });

  const user = await User.findByIdAndUpdate(
    req.params.id,
    updates,
    {
      new: true,
      runValidators: true,
    }
  );

  if (!user) {
    return next(new AppError('No user found with that ID', 404));
  }

  res.status(200).json({
    status: 'success',
    data: {
      user,
    },
  });
});

export const deleteUser = catchAsync(async (req, res, next) => {
  const user = await User.findByIdAndUpdate(
    req.params.id, 
    { isActive: false },
    { new: true }
  );

  if (!user) {
    return next(new AppError('No user found with that ID', 404));
  }

  res.status(200).json({
    status: 'success',
    message: 'User deactivated successfully',
  });
});

export const updateUserStatus = catchAsync(async (req, res, next) => {
  const { status } = req.body;
  
  if (!['active', 'inactive', 'suspended'].includes(status)) {
    return next(new AppError('Invalid status. Must be active, inactive, or suspended', 400));
  }

  const user = await User.findByIdAndUpdate(
    req.params.id,
    { isActive: status === 'active' },
    { new: true, runValidators: true }
  );

  if (!user) {
    return next(new AppError('No user found with that ID', 404));
  }

  res.status(200).json({
    status: 'success',
    data: {
      user,
    },
  });
});

export const verifyDoctor = catchAsync(async (req, res, next) => {
  const { verificationStatus } = req.body;
  
  if (!['verified', 'rejected', 'pending'].includes(verificationStatus)) {
    return next(new AppError('Invalid verification status', 400));
  }

  const doctor = await User.findOneAndUpdate(
    { _id: req.params.id, userType: 'doctor' },
    { verificationStatus },
    { new: true, runValidators: true }
  );

  if (!doctor) {
    return next(new AppError('No doctor found with that ID', 404));
  }

  res.status(200).json({
    status: 'success',
    data: {
      doctor,
    },
  });
});

export const getDoctorStats = catchAsync(async (req, res, next) => {
  const stats = await User.aggregate([
    {
      $match: { userType: 'doctor', isActive: true }
    },
    {
      $group: {
        _id: '$verificationStatus',
        count: { $sum: 1 }
      }
    }
  ]);

  const specializationStats = await User.aggregate([
    {
      $match: { userType: 'doctor', isActive: true, verificationStatus: 'verified' }
    },
    {
      $group: {
        _id: '$specialization',
        count: { $sum: 1 }
      }
    },
    {
      $sort: { count: -1 }
    }
  ]);

  res.status(200).json({
    status: 'success',
    data: {
      verificationStats: stats,
      specializationStats,
    },
  });
});

export const getPatientStats = catchAsync(async (req, res, next) => {
  const stats = await User.aggregate([
    {
      $match: { userType: 'patient', isActive: true }
    },
    {
      $group: {
        _id: '$bloodGroup',
        count: { $sum: 1 }
      }
    },
    {
      $sort: { count: -1 }
    }
  ]);

  const ageStats = await User.aggregate([
    {
      $match: { userType: 'patient', isActive: true, dateOfBirth: { $exists: true } }
    },
    {
      $addFields: {
        age: {
          $floor: {
            $divide: [
              { $subtract: [new Date(), '$dateOfBirth'] },
              365.25 * 24 * 60 * 60 * 1000
            ]
          }
        }
      }
    },
    {
      $group: {
        _id: {
          $switch: {
            branches: [
              { case: { $lt: ['$age', 18] }, then: 'Under 18' },
              { case: { $lt: ['$age', 30] }, then: '18-29' },
              { case: { $lt: ['$age', 50] }, then: '30-49' },
              { case: { $lt: ['$age', 65] }, then: '50-64' },
            ],
            default: '65+'
          }
        },
        count: { $sum: 1 }
      }
    }
  ]);

  res.status(200).json({
    status: 'success',
    data: {
      bloodGroupStats: stats,
      ageStats,
    },
  });
});

// Doctor availability management
export const updateDoctorAvailability = catchAsync(async (req, res, next) => {
  const { availability } = req.body;
  
  if (!availability) {
    return next(new AppError('Availability data is required', 400));
  }

  const doctor = await User.findByIdAndUpdate(
    req.user.id,
    { 
      availability: {
        ...availability,
        lastUpdated: new Date()
      }
    },
    { new: true, runValidators: true }
  ).select('-password');

  if (!doctor) {
    return next(new AppError('Doctor not found', 404));
  }

  res.status(200).json({
    status: 'success',
    message: 'Availability updated successfully',
    data: {
      doctor,
    },
  });
});

export const getDoctorAvailability = catchAsync(async (req, res, next) => {
  const doctor = await User.findById(req.params.doctorId || req.user.id);
  
  if (!doctor) {
    return next(new AppError('Doctor not found', 404));
  }

  // Get today's date in YYYY-MM-DD format
  const today = new Date().toISOString().split('T')[0];
  
  // Initialize default daily availability if not set or if it's a new day
  let availability = doctor.availability || {};
  
  if (!availability.dailySchedule || availability.dailySchedule.date !== today) {
    availability = {
      isAvailable: availability.isAvailable !== undefined ? availability.isAvailable : true,
      dailySchedule: {
        date: today,
        isActive: true,
        startTime: '09:00',
        endTime: '17:00'
      },
      breakTime: availability.breakTime || { enabled: true, startTime: '12:00', endTime: '13:00' },
      specialNotes: availability.specialNotes || ''
    };
  }

  res.status(200).json({
    status: 'success',
    data: {
      availability
    },
  });
});

export const getAvailableDoctors = catchAsync(async (req, res, next) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Set to start of day
  
  // Also check for schedules from yesterday in case they're still valid for today
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  
  // For development: also check past few days to handle sample data
  const threeDaysAgo = new Date(today);
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
  
  const currentTime = new Date();
  const currentHour = currentTime.getHours();
  const currentMinute = currentTime.getMinutes();
  const currentTotalMinutes = currentHour * 60 + currentMinute;
  
  console.log('Fetching available doctors from schedules collection');
  console.log('Today:', today.toISOString().split('T')[0]);
  console.log('Yesterday:', yesterday.toISOString().split('T')[0]);
  console.log('Three days ago:', threeDaysAgo.toISOString().split('T')[0]);
  console.log('Current time:', currentTime.toTimeString());
  
  // Find active schedules for today, yesterday, or past few days (for development flexibility)
  const activeSchedules = await Schedule.find({
    date: { $gte: threeDaysAgo, $lte: today },
    isActive: true
  }).populate({
    path: 'doctorId',
    match: { 
      userType: 'doctor',
      isActive: true,
      verificationStatus: 'verified' // Only verified doctors
    },
    select: '-password'
  });

  console.log(`Found ${activeSchedules.length} active schedules in date range`);
  
  // Log details of found schedules
  activeSchedules.forEach((schedule, index) => {
    console.log(`Schedule ${index + 1}:`, {
      id: schedule._id,
      doctorId: schedule.doctorId?._id || schedule.doctorId,
      date: schedule.date,
      startTime: schedule.startTime,
      endTime: schedule.endTime,
      isActive: schedule.isActive,
      doctorPopulated: !!schedule.doctorId?.firstName
    });
  });
  
  // Filter out schedules where doctor population failed (doctor not found or not active)
  const validSchedules = activeSchedules.filter(schedule => schedule.doctorId);
  
  console.log(`Found ${validSchedules.length} valid doctor schedules after filtering`);
  
  // Filter doctors based on current time availability
  const availableDoctors = validSchedules.filter(schedule => {
    const doctor = schedule.doctorId;
    const startTime = schedule.startTime;
    const endTime = schedule.endTime;
    
    if (!startTime || !endTime) {
      console.log(`Doctor ${doctor.firstName} ${doctor.lastName} - no schedule times defined`);
      return false;
    }
    
    // Parse schedule times
    const [startHour, startMinute] = startTime.split(':').map(Number);
    const [endHour, endMinute] = endTime.split(':').map(Number);
    const startTotalMinutes = startHour * 60 + startMinute;
    const endTotalMinutes = endHour * 60 + endMinute;
    
    const isWithinSchedule = currentTotalMinutes >= startTotalMinutes && currentTotalMinutes < endTotalMinutes;
    
    // Check if currently in break time (from doctor's availability settings)
    let isInBreak = false;
    if (doctor.availability?.breakTime?.enabled && 
        doctor.availability.breakTime.startTime && 
        doctor.availability.breakTime.endTime) {
      const [breakStartHour, breakStartMinute] = doctor.availability.breakTime.startTime.split(':').map(Number);
      const [breakEndHour, breakEndMinute] = doctor.availability.breakTime.endTime.split(':').map(Number);
      const breakStartTotalMinutes = breakStartHour * 60 + breakStartMinute;
      const breakEndTotalMinutes = breakEndHour * 60 + breakEndMinute;
      
      isInBreak = currentTotalMinutes >= breakStartTotalMinutes && currentTotalMinutes < breakEndTotalMinutes;
    }
    
    const doctorAvailable = isWithinSchedule && !isInBreak;
    console.log(`Doctor ${doctor.firstName} ${doctor.lastName} - Schedule: ${startTime}-${endTime}, Available: ${doctorAvailable}, In break: ${isInBreak}`);
    
    return doctorAvailable;
  }).map(schedule => {
    // Return doctor object with schedule information
    const doctor = schedule.doctorId.toObject();
    doctor.scheduleInfo = {
      scheduleId: schedule._id,
      startTime: schedule.startTime,
      endTime: schedule.endTime,
      date: schedule.date,
      isActive: schedule.isActive
    };
    return doctor;
  });
  
  console.log(`${availableDoctors.length} doctors currently available from schedules`);

  res.status(200).json({
    status: 'success',
    results: availableDoctors.length,
    data: {
      doctors: availableDoctors,
    },
  });
});

// Get doctor's consultation fee
export const getDoctorConsultationFee = catchAsync(async (req, res, next) => {
  const doctorId = req.user.id;

  // Find the doctor user
  const doctor = await User.findById(doctorId).select('consultationFee userType');
  
  if (!doctor) {
    return next(new AppError('Doctor not found', 404));
  }

  if (doctor.userType !== 'doctor') {
    return next(new AppError('Access denied. Only doctors can access this endpoint', 403));
  }

  res.status(200).json({
    status: 'success',
    data: {
      consultationFee: doctor.consultationFee || 0
    },
  });
});

// Test function to create sample schedule data (for development only)
export const createSampleSchedules = catchAsync(async (req, res, next) => {
  // Find some doctors to create schedules for
  const doctors = await User.find({ 
    userType: 'doctor', 
    isActive: true,
    verificationStatus: 'verified'
  }).limit(5);
  
  if (doctors.length === 0) {
    return next(new AppError('No verified doctors found to create schedules for', 404));
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const schedules = [];
  
  for (let i = 0; i < doctors.length; i++) {
    const doctor = doctors[i];
    
    // Create schedule for today
    const schedule = {
      doctorId: doctor._id,
      date: today,
      startTime: i % 2 === 0 ? '09:00' : '10:00', // Vary start times
      endTime: i % 2 === 0 ? '17:00' : '18:00',   // Vary end times
      isActive: true
    };
    
    // Check if schedule already exists
    const existingSchedule = await Schedule.findOne({
      doctorId: doctor._id,
      date: today
    });
    
    if (!existingSchedule) {
      const newSchedule = await Schedule.create(schedule);
      schedules.push(newSchedule);
    }
  }

  res.status(201).json({
    status: 'success',
    message: `Created ${schedules.length} sample schedules for today`,
    data: {
      schedules
    }
  });
});

// Test function to create sample doctors (for development only)
export const createSampleDoctors = catchAsync(async (req, res, next) => {
  const sampleDoctors = [
    {
      firstName: 'Sarah',
      lastName: 'Johnson',
      email: 'sarah.johnson@hospital.com',
      password: 'password123',
      phone: '+1234567890',
      userType: 'doctor',
      specialization: 'Cardiology',
      experience: '10 years',
      verificationStatus: 'verified',
      isActive: true,
      availability: {
        isAvailable: true,
        dailySchedule: {
          isActive: true,
          startTime: '09:00',
          endTime: '17:00'
        }
      }
    },
    {
      firstName: 'Michael',
      lastName: 'Chen',
      email: 'michael.chen@hospital.com',
      password: 'password123',
      phone: '+1234567891',
      userType: 'doctor',
      specialization: 'Neurology',
      experience: '8 years',
      verificationStatus: 'verified',
      isActive: true,
      availability: {
        isAvailable: true,
        dailySchedule: {
          isActive: true,
          startTime: '10:00',
          endTime: '18:00'
        }
      }
    },
    {
      firstName: 'Emily',
      lastName: 'Rodriguez',
      email: 'emily.rodriguez@hospital.com',
      password: 'password123',
      phone: '+1234567892',
      userType: 'doctor',
      specialization: 'Pediatrics',
      experience: '12 years',
      verificationStatus: 'verified',
      isActive: true,
      availability: {
        isAvailable: true,
        dailySchedule: {
          isActive: true,
          startTime: '08:00',
          endTime: '16:00'
        }
      }
    }
  ];

  const createdDoctors = [];
  
  for (const doctorData of sampleDoctors) {
    // Check if doctor already exists
    const existingDoctor = await User.findOne({ email: doctorData.email });
    
    if (!existingDoctor) {
      const doctor = await User.create(doctorData);
      createdDoctors.push(doctor);
    }
  }

  res.status(201).json({
    status: 'success',
    message: `Created ${createdDoctors.length} sample doctors`,
    data: {
      doctors: createdDoctors
    }
  });
});

// Test function to update sample schedules to today's date (for development only)
export const updateSchedulesToToday = catchAsync(async (req, res, next) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  // Find all schedules and update them to today's date
  const result = await Schedule.updateMany(
    { isActive: true },
    { date: today }
  );
  
  console.log(`Updated ${result.modifiedCount} schedules to today's date: ${today.toISOString().split('T')[0]}`);
  
  res.status(200).json({
    status: 'success',
    message: `Updated ${result.modifiedCount} schedules to today's date`,
    data: {
      modifiedCount: result.modifiedCount,
      date: today.toISOString().split('T')[0]
    }
  });
});

// Debug function to check all schedules in the collection (for development only)
export const debugSchedules = catchAsync(async (req, res, next) => {
  const allSchedules = await Schedule.find({}).populate({
    path: 'doctorId',
    select: 'firstName lastName email userType isActive verificationStatus'
  });
  
  console.log('=== All Schedules in Database ===');
  allSchedules.forEach((schedule, index) => {
    console.log(`Schedule ${index + 1}:`, {
      id: schedule._id,
      doctorId: schedule.doctorId?._id,
      doctorName: schedule.doctorId ? `${schedule.doctorId.firstName} ${schedule.doctorId.lastName}` : 'No doctor',
      doctorEmail: schedule.doctorId?.email,
      doctorActive: schedule.doctorId?.isActive,
      doctorVerified: schedule.doctorId?.verificationStatus,
      date: schedule.date,
      startTime: schedule.startTime,
      endTime: schedule.endTime,
      isActive: schedule.isActive,
      createdAt: schedule.createdAt
    });
  });
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  res.status(200).json({
    status: 'success',
    message: `Found ${allSchedules.length} total schedules in database`,
    today: today.toISOString().split('T')[0],
    data: {
      schedules: allSchedules
    }
  });
});

// Get available doctors based on daily availability (primary method)
export const getAvailableDoctorsByDailySchedule = catchAsync(async (req, res, next) => {
  const currentTime = new Date();
  const currentHour = currentTime.getHours();
  const currentMinute = currentTime.getMinutes();
  const currentTotalMinutes = currentHour * 60 + currentMinute;
  const today = new Date().toISOString().split('T')[0];
  
  console.log('Fetching doctors based on daily availability');
  console.log('Current time:', currentTime.toTimeString());
  console.log('Today:', today);
  
  // Find all active, verified doctors with availability settings
  const doctors = await User.find({
    userType: 'doctor',
    isActive: true,
    verificationStatus: 'verified',
    'availability.isAvailable': true,
    'availability.dailySchedule.isActive': true
  }).select('-password');

  console.log(`Found ${doctors.length} doctors with daily availability enabled`);
  
  // Filter doctors based on their daily schedule and current time
  const availableDoctors = doctors.filter(doctor => {
    const availability = doctor.availability;
    const dailySchedule = availability.dailySchedule;
    
    if (!dailySchedule || !dailySchedule.isActive) {
      console.log(`Doctor ${doctor.firstName} ${doctor.lastName} - daily schedule not active`);
      return false;
    }
    
    const startTime = dailySchedule.startTime;
    const endTime = dailySchedule.endTime;
    
    if (!startTime || !endTime) {
      console.log(`Doctor ${doctor.firstName} ${doctor.lastName} - no start/end times defined`);
      return false;
    }
    
    // Parse daily schedule times
    const [startHour, startMinute] = startTime.split(':').map(Number);
    const [endHour, endMinute] = endTime.split(':').map(Number);
    const startTotalMinutes = startHour * 60 + startMinute;
    const endTotalMinutes = endHour * 60 + endMinute;
    
    const isWithinSchedule = currentTotalMinutes >= startTotalMinutes && currentTotalMinutes < endTotalMinutes;
    
    // Check if currently in break time
    let isInBreak = false;
    if (availability.breakTime?.enabled && 
        availability.breakTime.startTime && 
        availability.breakTime.endTime) {
      const [breakStartHour, breakStartMinute] = availability.breakTime.startTime.split(':').map(Number);
      const [breakEndHour, breakEndMinute] = availability.breakTime.endTime.split(':').map(Number);
      const breakStartTotalMinutes = breakStartHour * 60 + breakStartMinute;
      const breakEndTotalMinutes = breakEndHour * 60 + breakEndMinute;
      
      isInBreak = currentTotalMinutes >= breakStartTotalMinutes && currentTotalMinutes < breakEndTotalMinutes;
    }
    
    const doctorAvailable = isWithinSchedule && !isInBreak;
    
    console.log(`Doctor ${doctor.firstName} ${doctor.lastName}:`, {
      schedule: `${startTime}-${endTime}`,
      available: doctorAvailable,
      withinSchedule: isWithinSchedule,
      inBreak: isInBreak,
      breakEnabled: availability.breakTime?.enabled || false
    });
    
    return doctorAvailable;
  });
  
  // Add calculated fields to each available doctor
  const doctorsWithExtendedInfo = availableDoctors.map(doctor => {
    const doctorObj = doctor.toObject();
    const availability = doctor.availability;
    const dailySchedule = availability.dailySchedule;
    
    // Calculate next available slot
    const getNextSlot = () => {
      const now = new Date();
      const currentTimeStr = now.toTimeString().slice(0, 5);
      const startTime = dailySchedule.startTime;
      
      if (currentTimeStr < startTime) {
        return `Today ${startTime}`;
      } else {
        return `Tomorrow ${startTime}`;
      }
    };
    
    // Add daily availability info
    doctorObj.dailyAvailabilityInfo = {
      isCurrentlyAvailable: true,
      todaySchedule: {
        startTime: dailySchedule.startTime,
        endTime: dailySchedule.endTime,
        isActive: dailySchedule.isActive
      },
      breakTime: availability.breakTime?.enabled ? {
        startTime: availability.breakTime.startTime,
        endTime: availability.breakTime.endTime,
        enabled: true
      } : { enabled: false },
      nextAvailableSlot: getNextSlot(),
      specialNotes: availability.specialNotes || '',
      lastUpdated: availability.lastUpdated
    };
    
    return doctorObj;
  });
  
  console.log(`${doctorsWithExtendedInfo.length} doctors currently available based on daily schedule`);

  res.status(200).json({
    status: 'success',
    results: doctorsWithExtendedInfo.length,
    currentTime: currentTime.toISOString(),
    filterCriteria: {
      method: 'dailyAvailability',
      currentTime: `${currentHour}:${currentMinute.toString().padStart(2, '0')}`,
      date: today
    },
    data: {
      doctors: doctorsWithExtendedInfo,
    },
  });
});

// Test function to create sample doctors with daily availability (for development only)
export const createDoctorsWithDailyAvailability = catchAsync(async (req, res, next) => {
  const sampleDoctors = [
    {
      firstName: 'Sarah',
      lastName: 'Johnson',
      email: 'sarah.johnson@dailyhospital.com',
      password: 'password123',
      phone: '+1234567890',
      userType: 'doctor',
      specialization: 'Cardiology',
      experience: '10 years',
      verificationStatus: 'verified',
      isActive: true,
      availability: {
        isAvailable: true,
        dailySchedule: {
          isActive: true,
          startTime: '08:00',
          endTime: '16:00'
        },
        breakTime: {
          enabled: true,
          startTime: '12:00',
          endTime: '13:00'
        },
        specialNotes: 'Specializes in heart conditions and preventive cardiology',
        lastUpdated: new Date()
      }
    },
    {
      firstName: 'Michael',
      lastName: 'Chen',
      email: 'michael.chen@dailyhospital.com',
      password: 'password123',
      phone: '+1234567891',
      userType: 'doctor',
      specialization: 'Internal Medicine',
      experience: '8 years',
      verificationStatus: 'verified',
      isActive: true,
      availability: {
        isAvailable: true,
        dailySchedule: {
          isActive: true,
          startTime: '09:00',
          endTime: '17:00'
        },
        breakTime: {
          enabled: true,
          startTime: '12:30',
          endTime: '13:30'
        },
        specialNotes: 'Available for general consultations and health checkups',
        lastUpdated: new Date()
      }
    },
    {
      firstName: 'Emily',
      lastName: 'Rodriguez',
      email: 'emily.rodriguez@dailyhospital.com',
      password: 'password123',
      phone: '+1234567892',
      userType: 'doctor',
      specialization: 'Pediatrics',
      experience: '12 years',
      verificationStatus: 'verified',
      isActive: true,
      availability: {
        isAvailable: true,
        dailySchedule: {
          isActive: true,
          startTime: '10:00',
          endTime: '18:00'
        },
        breakTime: {
          enabled: true,
          startTime: '13:00',
          endTime: '14:00'
        },
        specialNotes: 'Pediatric care for children of all ages',
        lastUpdated: new Date()
      }
    },
    {
      firstName: 'David',
      lastName: 'Thompson',
      email: 'david.thompson@dailyhospital.com',
      password: 'password123',
      phone: '+1234567893',
      userType: 'doctor',
      specialization: 'Dermatology',
      experience: '15 years',
      verificationStatus: 'verified',
      isActive: true,
      availability: {
        isAvailable: true,
        dailySchedule: {
          isActive: true,
          startTime: '07:00',
          endTime: '15:00'
        },
        breakTime: {
          enabled: true,
          startTime: '11:30',
          endTime: '12:30'
        },
        specialNotes: 'Skin conditions, cosmetic procedures, and skin cancer screenings',
        lastUpdated: new Date()
      }
    }
  ];

  const createdDoctors = [];
  
  for (const doctorData of sampleDoctors) {
    // Check if doctor already exists
    const existingDoctor = await User.findOne({ email: doctorData.email });
    
    if (!existingDoctor) {
      const doctor = await User.create(doctorData);
      createdDoctors.push(doctor);
    }
  }

  res.status(201).json({
    status: 'success',
    message: `Created ${createdDoctors.length} doctors with daily availability`,
    data: {
      doctors: createdDoctors
    }
  });
});
