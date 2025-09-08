import User from '../models/User.js';
import catchAsync from '../utils/catchAsync.js';
import AppError from '../utils/appError.js';

// Get all pending doctors for verification
export const getPendingDoctors = catchAsync(async (req, res, next) => {
  const pendingDoctors = await User.find({
    userType: 'doctor',
    verificationStatus: 'pending'
  }).select('-password');

  res.status(200).json({
    status: 'success',
    results: pendingDoctors.length,
    data: {
      doctors: pendingDoctors
    }
  });
});

// Verify doctor - approve or reject
export const verifyDoctor = catchAsync(async (req, res, next) => {
  const { doctorId } = req.params;
  const { status } = req.body;

  // Validate status
  if (!['verified', 'rejected'].includes(status)) {
    return next(new AppError('Invalid verification status. Must be verified or rejected.', 400));
  }

  // Find the doctor
  const doctor = await User.findById(doctorId);
  if (!doctor) {
    return next(new AppError('Doctor not found', 404));
  }

  // Check if the user is actually a doctor
  if (doctor.userType !== 'doctor') {
    return next(new AppError('User is not a doctor', 400));
  }

  // Update verification status
  doctor.verificationStatus = status;
  await doctor.save();

  res.status(200).json({
    status: 'success',
    message: `Doctor ${status === 'verified' ? 'approved' : 'rejected'} successfully`,
    data: {
      doctor: {
        id: doctor._id,
        name: `${doctor.firstName} ${doctor.lastName}`,
        email: doctor.email,
        verificationStatus: doctor.verificationStatus
      }
    }
  });
});

// Get all users (for admin dashboard)
export const getAllUsers = catchAsync(async (req, res, next) => {
  const { page = 1, limit = 10, userType, verificationStatus } = req.query;

  // Build filter object
  const filter = {};
  if (userType) filter.userType = userType;
  if (verificationStatus) filter.verificationStatus = verificationStatus;

  const users = await User.find(filter)
    .select('-password')
    .limit(limit * 1)
    .skip((page - 1) * limit)
    .sort({ createdAt: -1 });

  const total = await User.countDocuments(filter);

  res.status(200).json({
    status: 'success',
    results: users.length,
    data: {
      users,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      totalUsers: total
    }
  });
});

// Get dashboard statistics
export const getDashboardStats = catchAsync(async (req, res, next) => {
  const totalUsers = await User.countDocuments();
  const totalPatients = await User.countDocuments({ userType: 'patient' });
  const totalDoctors = await User.countDocuments({ userType: 'doctor' });
  const pendingDoctors = await User.countDocuments({ 
    userType: 'doctor', 
    verificationStatus: 'pending' 
  });
  const verifiedDoctors = await User.countDocuments({ 
    userType: 'doctor', 
    verificationStatus: 'verified' 
  });

  res.status(200).json({
    status: 'success',
    data: {
      stats: {
        totalUsers,
        totalPatients,
        totalDoctors,
        pendingDoctors,
        verifiedDoctors
      }
    }
  });
});

// Update user status (activate/deactivate)
export const updateUserStatus = catchAsync(async (req, res, next) => {
  const { userId } = req.params;
  const { isActive } = req.body;

  const user = await User.findByIdAndUpdate(
    userId,
    { isActive },
    { new: true, runValidators: true }
  ).select('-password');

  if (!user) {
    return next(new AppError('User not found', 404));
  }

  res.status(200).json({
    status: 'success',
    message: `User ${isActive ? 'activated' : 'deactivated'} successfully`,
    data: {
      user
    }
  });
});

// Delete user
export const deleteUser = catchAsync(async (req, res, next) => {
  const { userId } = req.params;

  const user = await User.findById(userId);
  if (!user) {
    return next(new AppError('User not found', 404));
  }

  // Prevent deletion of admin users
  if (user.userType === 'admin') {
    return next(new AppError('Cannot delete admin users', 400));
  }

  await User.findByIdAndDelete(userId);

  res.status(200).json({
    status: 'success',
    message: 'User deleted successfully'
  });
});
