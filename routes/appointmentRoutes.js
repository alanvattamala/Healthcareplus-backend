import express from 'express';
import Appointment from '../models/Appointment.js';
import {
  bookAppointment,
  getPatientAppointments,
  getDoctorAppointments,
  updateAppointmentStatus,
  cancelAppointment,
  getAppointmentDetails,
  fixScheduleDates,
  rescheduleAppointment,
  cancelAppointmentWithDetails
} from '../controllers/appointmentController.js';
import { protect } from '../controllers/authController.js';

const router = express.Router();

// All routes are protected (require authentication)
router.use(protect);

// Patient routes
router.post('/book', bookAppointment);
router.get('/my-appointments', getPatientAppointments);

// Doctor routes
router.get('/doctor-appointments', getDoctorAppointments);

// Debug route to test specific appointment
router.get('/debug/:appointmentId', async (req, res) => {
  try {
    const appointmentId = req.params.appointmentId;
    console.log('🔍 Debug: Looking for appointment:', appointmentId);
    
    const appointment = await Appointment.findById(appointmentId)
      .populate({
        path: 'patient',
        select: 'firstName lastName email phone dateOfBirth gender userType'
      })
      .populate({
        path: 'doctor',
        select: 'firstName lastName email userType'
      });
    
    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found'
      });
    }
    
    res.status(200).json({
      success: true,
      data: appointment,
      debug: {
        appointmentDate: appointment.date,
        doctorId: appointment.doctor._id,
        patientId: appointment.patient._id,
        status: appointment.status
      }
    });
  } catch (error) {
    console.error('Debug route error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Admin/Migration routes
router.post('/fix-schedule-dates', fixScheduleDates); // Migration endpoint

// Shared routes (both patient and doctor)
router.get('/:id', getAppointmentDetails);
router.patch('/:id/status', updateAppointmentStatus);
router.patch('/:id/reschedule', rescheduleAppointment);
router.patch('/:id/cancel', cancelAppointmentWithDetails);
router.delete('/:id', cancelAppointment); // Keep the old cancel endpoint for backward compatibility

export default router;