import Razorpay from 'razorpay';
import crypto from 'crypto';
import Appointment from '../models/Appointment.js';
import User from '../models/User.js';
import Schedule from '../models/Schedule.js';

// In-memory storage for notifications (same as notification controller)
const patientNotifications = new Map();

// Helper function to create appointment confirmation notification
const createAppointmentNotification = (patientId, appointment, doctorName) => {
  const notification = {
    id: `appointment-${appointment._id}-${Date.now()}`,
    type: 'appointment-confirmed',
    appointmentId: appointment._id,
    patientId: patientId,
    title: 'Appointment Confirmed',
    message: `Your appointment with ${doctorName} on ${appointment.date.toDateString()} at ${appointment.time} has been confirmed. Payment successful.`,
    createdAt: new Date(),
    read: false,
    actionRequired: false,
    details: {
      doctorName: doctorName,
      date: appointment.date,
      time: appointment.time,
      reason: appointment.reason,
      paymentStatus: 'paid'
    }
  };
  
  // Store notification for patient
  if (!patientNotifications.has(patientId)) {
    patientNotifications.set(patientId, []);
  }
  patientNotifications.get(patientId).push(notification);
  
  console.log(`📢 Appointment confirmation notification created for patient ${patientId}:`, notification);
  return notification;
};

// Initialize Razorpay instance
const razorpay = new Razorpay({
  key_id: 'rzp_test_RVONVgejOTKxEG',
  key_secret: 'RjtcyetoWmM6Sy9L8f1htTNU'
});

// Create Razorpay order
export const createOrder = async (req, res) => {
  try {
    console.log('💳 Payment order creation request received');
    console.log('📝 Request body:', req.body);
    console.log('🔑 Authorization header:', req.headers.authorization);
    
    const { amount, doctorId, patientId, appointmentData } = req.body;

    if (!amount || !doctorId || !patientId || !appointmentData) {
      console.log('❌ Missing required fields:', { amount, doctorId, patientId, appointmentData });
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: amount, doctorId, patientId, appointmentData'
      });
    }

    // Convert amount to paise (Razorpay accepts amount in paise)
    const amountInPaise = Math.round(amount * 100);
    
    console.log('💰 Amount conversion:', { original: amount, paise: amountInPaise });

    // Create order with Razorpay
    console.log('🚀 Creating Razorpay order...');
    const order = await razorpay.orders.create({
      amount: amountInPaise,
      currency: 'INR',
      receipt: `appointment_${Date.now()}`,
      notes: {
        doctorId: doctorId,
        patientId: patientId,
        appointmentDate: appointmentData.date,
        appointmentTime: appointmentData.time,
        appointmentReason: appointmentData.reason
      }
    });

    console.log('✅ Razorpay order created successfully:', order.id);

    res.status(200).json({
      success: true,
      order: {
        id: order.id,
        amount: order.amount,
        currency: order.currency,
        receipt: order.receipt
      },
      appointmentData: appointmentData,
      razorpayKeyId: 'rzp_test_RVONVgejOTKxEG'
    });

  } catch (error) {
    console.error('❌ Error creating Razorpay order:', error);
    console.error('📋 Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    
    res.status(500).json({
      success: false,
      message: 'Failed to create payment order',
      error: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

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

// Verify payment signature
export const verifyPayment = async (req, res) => {
  try {
    console.log('🔐 Payment verification request received');
    console.log('📝 Request body:', req.body);
    
    const { 
      razorpay_order_id, 
      razorpay_payment_id, 
      razorpay_signature, 
      appointmentData,
      doctorId,
      patientId 
    } = req.body;

    // Create signature for verification
    const generated_signature = crypto
      .createHmac('sha256', 'RjtcyetoWmM6Sy9L8f1htTNU')
      .update(razorpay_order_id + '|' + razorpay_payment_id)
      .digest('hex');

    console.log('🔐 Signature verification:', {
      received: razorpay_signature,
      generated: generated_signature,
      match: generated_signature === razorpay_signature
    });

    if (generated_signature !== razorpay_signature) {
      return res.status(400).json({
        success: false,
        message: 'Payment verification failed'
      });
    }

    console.log('✅ Payment signature verified successfully');

    // Payment is verified, now book the appointment
    try {
      console.log('📅 Starting appointment booking process...');
      
      // Validate required fields
      if (!doctorId || !patientId || !appointmentData) {
        throw new Error('Missing required appointment data');
      }

      // Verify doctor exists
      const doctor = await User.findById(doctorId);
      if (!doctor || doctor.userType !== 'doctor') {
        throw new Error('Invalid doctor specified');
      }

      // Verify patient exists
      const patient = await User.findById(patientId);
      if (!patient || patient.userType !== 'patient') {
        throw new Error('Invalid patient specified');
      }

      console.log('👨‍⚕️ Doctor found:', { id: doctor._id, name: `${doctor.firstName} ${doctor.lastName}` });
      console.log('👤 Patient found:', { id: patient._id, name: `${patient.firstName} ${patient.lastName}` });

      // Parse the appointment date
      const appointmentDate = parseLocalDate(appointmentData.date);
      if (isNaN(appointmentDate.getTime())) {
        throw new Error('Invalid appointment date format');
      }

      // Check if the doctor has a schedule for this date
      const { startOfDay, endOfDay } = getDateRange(appointmentDate);
      const schedule = await Schedule.findOne({
        doctorId: doctorId,
        date: {
          $gte: startOfDay,
          $lte: endOfDay
        },
        isActive: true
      });

      if (!schedule) {
        throw new Error('Doctor is not available on the selected date');
      }

      console.log('📋 Schedule found:', { 
        scheduleId: schedule._id, 
        date: schedule.date,
        startTime: schedule.startTime,
        endTime: schedule.endTime 
      });

      // Check for existing appointment at the same time slot
      const existingAppointment = await Appointment.findOne({
        doctor: doctorId,
        date: appointmentDate,
        time: appointmentData.time,
        status: { $in: ['scheduled', 'confirmed'] }
      });

      if (existingAppointment) {
        throw new Error('This time slot is already booked');
      }

      // Create the appointment
      const newAppointment = new Appointment({
        patient: patientId,
        doctor: doctorId,
        date: appointmentDate,
        time: appointmentData.time,
        timeSlot: appointmentData.timeSlot || appointmentData.time,
        reason: appointmentData.reason,
        type: appointmentData.type || 'consultation',
        status: 'confirmed', // Set as confirmed since payment is successful
        scheduleId: schedule._id,
        duration: doctor.slotDuration || 30,
        notes: `Payment ID: ${razorpay_payment_id}, Order ID: ${razorpay_order_id}`
      });

      const savedAppointment = await newAppointment.save();
      console.log('✅ Appointment created successfully:', { 
        appointmentId: savedAppointment._id,
        status: savedAppointment.status 
      });

      // Find the requested time slot and mark it as booked
      const startTime = appointmentData.time.includes('-') ? appointmentData.time.split('-')[0] : appointmentData.time;
      const requestedTimeSlot = schedule.availableSlots.find(slot => 
        slot.startTime === startTime && !slot.isBooked
      );

      if (requestedTimeSlot) {
        // Mark the time slot as booked using atomic update
        const slotUpdateResult = await Schedule.findOneAndUpdate(
          { 
            _id: schedule._id,
            'availableSlots._id': requestedTimeSlot._id 
          },
          {
            $set: {
              'availableSlots.$.isBooked': true,
              'availableSlots.$.patientId': patientId,
              'availableSlots.$.appointmentId': savedAppointment._id,
              'availableSlots.$.bookingTime': new Date(),
              'availableSlots.$.status': 'booked'
            }
          },
          { new: true }
        );

        console.log('🔒 Slot marked as booked:', { 
          slotId: requestedTimeSlot._id,
          startTime: requestedTimeSlot.startTime,
          updateSuccess: !!slotUpdateResult 
        });
      } else {
        console.warn('⚠️ Could not find matching slot to mark as booked');
      }

      // Populate the appointment with doctor and patient details for response
      const populatedAppointment = await Appointment.findById(savedAppointment._id)
        .populate('doctor', 'firstName lastName email phone specialization')
        .populate('patient', 'firstName lastName email phone');

      const doctorName = `${populatedAppointment.doctor.firstName} ${populatedAppointment.doctor.lastName}`;

      // Create appointment confirmation notification
      createAppointmentNotification(
        populatedAppointment.patient._id.toString(),
        populatedAppointment,
        doctorName
      );

      console.log('📧 Appointment confirmation notification sent to patient');

      res.status(200).json({
        success: true,
        message: 'Payment verified and appointment booked successfully',
        appointment: {
          id: populatedAppointment._id,
          doctorId: populatedAppointment.doctor._id,
          doctorName: doctorName,
          patientId: populatedAppointment.patient._id,
          patientName: `${populatedAppointment.patient.firstName} ${populatedAppointment.patient.lastName}`,
          date: populatedAppointment.date,
          time: populatedAppointment.time,
          timeSlot: populatedAppointment.timeSlot,
          reason: populatedAppointment.reason,
          type: populatedAppointment.type,
          status: populatedAppointment.status,
          paymentId: razorpay_payment_id,
          orderId: razorpay_order_id,
          paymentStatus: 'paid',
          createdAt: populatedAppointment.createdAt
        }
      });

    } catch (appointmentError) {
      console.error('❌ Error booking appointment after payment:', appointmentError);
      res.status(500).json({
        success: false,
        message: 'Payment successful but appointment booking failed',
        error: appointmentError.message,
        paymentId: razorpay_payment_id
      });
    }

  } catch (error) {
    console.error('❌ Error verifying payment:', error);
    res.status(500).json({
      success: false,
      message: 'Payment verification failed',
      error: error.message
    });
  }
};

// Get payment details
export const getPaymentDetails = async (req, res) => {
  try {
    const { paymentId } = req.params;
    
    const payment = await razorpay.payments.fetch(paymentId);
    
    res.status(200).json({
      success: true,
      payment: payment
    });
    
  } catch (error) {
    console.error('Error fetching payment details:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch payment details',
      error: error.message
    });
  }
};

// Export patient notifications for use in notification controller
export const getPatientNotificationsFromPayment = (patientId) => {
  return patientNotifications.get(patientId) || [];
};

// Function to add notification to patient (for external use)
export const addPatientNotification = (patientId, notification) => {
  if (!patientNotifications.has(patientId)) {
    patientNotifications.set(patientId, []);
  }
  patientNotifications.get(patientId).push(notification);
};
