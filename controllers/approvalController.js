import Approval from '../models/Approval.js';
import User from '../models/User.js';
import catchAsync from '../utils/catchAsync.js';

// Submit a new approval request
const submitApprovalRequest = catchAsync(async (req, res) => {
  const { type, requestData } = req.body;
  const doctorId = req.user.id;

  // Validate required fields
  if (!type || !requestData) {
    return res.status(400).json({
      success: false,
      message: 'Type and request data are required'
    });
  }

  // Check if there's already a pending request of the same type
  const existingRequest = await Approval.findOne({
    doctorId,
    type,
    status: 'pending'
  });

  if (existingRequest) {
    return res.status(400).json({
      success: false,
      message: `You already have a pending ${type.replace('_', ' ')} request`
    });
  }

  // Create new approval request
  const approval = await Approval.create({
    doctorId,
    type,
    requestData,
    status: 'pending'
  });

  // Populate doctor details
  await approval.populate('doctor', 'firstName lastName email specialization');

  res.status(201).json({
    success: true,
    message: 'Approval request submitted successfully',
    data: { approval }
  });
});

// Get all approval requests (admin only)
const getAllApprovalRequests = catchAsync(async (req, res) => {
  const { status, type, page = 1, limit = 10 } = req.query;
  
  // Build filter
  const filter = {};
  if (status) filter.status = status;
  if (type) filter.type = type;

  // Calculate skip value for pagination
  const skip = (page - 1) * limit;

  // Fetch approvals with pagination
  const approvals = await Approval.find(filter)
    .populate('doctor', 'firstName lastName email specialization profileImage')
    .populate('admin', 'firstName lastName email')
    .sort({ submittedAt: -1 })
    .skip(skip)
    .limit(parseInt(limit));

  // Get total count for pagination
  const total = await Approval.countDocuments(filter);

  res.status(200).json({
    success: true,
    data: {
      approvals,
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

// Process approval request (approve/reject)
const processApprovalRequest = catchAsync(async (req, res) => {
  console.log('=== Processing Approval Request ===');
  console.log('Request params:', req.params);
  console.log('Request body:', req.body);
  console.log('Admin user:', req.user?.id);
  
  const { id } = req.params;
  const { action, reason } = req.body; // action: 'approve' or 'reject'
  const adminId = req.user.id;

  // Validate action
  if (!['approve', 'reject'].includes(action)) {
    console.log('Invalid action provided:', action);
    return res.status(400).json({
      success: false,
      message: 'Action must be either "approve" or "reject"'
    });
  }

  // Find the approval request
  console.log('Looking for approval with ID:', id);
  const approval = await Approval.findById(id).populate('doctor');
  
  if (!approval) {
    console.log('Approval not found for ID:', id);
    return res.status(404).json({
      success: false,
      message: 'Approval request not found'
    });
  }

  console.log('Found approval:', {
    id: approval._id,
    status: approval.status,
    type: approval.type,
    doctorId: approval.doctorId
  });

  if (approval.status !== 'pending') {
    console.log('Approval already processed with status:', approval.status);
    return res.status(400).json({
      success: false,
      message: 'This request has already been processed'
    });
  }

  // Update approval status
  console.log('Updating approval status to:', action === 'approve' ? 'approved' : 'rejected');
  approval.status = action === 'approve' ? 'approved' : 'rejected';
  approval.processedBy = adminId;
  approval.reason = reason || null;
  approval.processedAt = new Date();
  
  console.log('Saving approval...');
  await approval.save();
  console.log('Approval saved successfully');

  // If approved and it's a consultation fee request, update the doctor's profile
  if (action === 'approve' && approval.type === 'consultation_fee') {
    console.log('Updating doctor consultation fee...');
    const doctor = await User.findById(approval.doctorId);
    if (doctor) {
      // Only save the amount as Number, since User model expects consultationFee to be a Number
      doctor.consultationFee = approval.requestData.amount;
      await doctor.save();
      console.log('Doctor consultation fee updated to:', approval.requestData.amount);
    } else {
      console.log('Doctor not found for ID:', approval.doctorId);
    }
  }

  // Populate admin details for response
  console.log('Populating admin details...');
  await approval.populate('admin', 'firstName lastName email');

  console.log('Sending success response');
  res.status(200).json({
    success: true,
    message: `Request ${action}d successfully`,
    data: { approval }
  });
});

// Get approval requests for a specific doctor
const getDoctorApprovalRequests = catchAsync(async (req, res) => {
  const doctorId = req.user.id;
  const { type, status } = req.query;

  // Build filter
  const filter = { doctorId };
  if (type) filter.type = type;
  if (status) filter.status = status;

  const approvals = await Approval.find(filter)
    .populate('admin', 'firstName lastName email')
    .sort({ submittedAt: -1 });

  res.status(200).json({
    success: true,
    data: { approvals }
  });
});

// Get approval statistics (admin only)
const getApprovalStatistics = catchAsync(async (req, res) => {
  const stats = await Approval.aggregate([
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 }
      }
    }
  ]);

  const typeStats = await Approval.aggregate([
    {
      $group: {
        _id: '$type',
        count: { $sum: 1 },
        pending: {
          $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] }
        },
        approved: {
          $sum: { $cond: [{ $eq: ['$status', 'approved'] }, 1, 0] }
        },
        rejected: {
          $sum: { $cond: [{ $eq: ['$status', 'rejected'] }, 1, 0] }
        }
      }
    }
  ]);

  res.status(200).json({
    success: true,
    data: {
      statusStats: stats,
      typeStats: typeStats
    }
  });
});

export {
  submitApprovalRequest,
  getAllApprovalRequests,
  processApprovalRequest,
  getDoctorApprovalRequests,
  getApprovalStatistics
};