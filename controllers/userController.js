import User from '../models/User.js';
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
