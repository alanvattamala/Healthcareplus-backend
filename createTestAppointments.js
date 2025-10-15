import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Appointment from './models/Appointment.js';
import User from './models/User.js';

dotenv.config();

const createTestAppointments = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');

    // Find a doctor and patient in the database
    const doctor = await User.findOne({ userType: 'doctor' });
    const patient = await User.findOne({ userType: 'patient' });

    if (!doctor || !patient) {
      console.log('❌ Need at least one doctor and one patient in the database');
      console.log('Doctor found:', !!doctor);
      console.log('Patient found:', !!patient);
      return;
    }

    console.log('👨‍⚕️ Doctor:', `${doctor.firstName} ${doctor.lastName}`);
    console.log('👤 Patient:', `${patient.firstName} ${patient.lastName}`);

    // Create test appointments for today and the next few days
    const testAppointments = [
      {
        patient: patient._id,
        doctor: doctor._id,
        date: new Date(),
        time: '10:00',
        timeSlot: '10:00-10:30',
        reason: 'Regular checkup',
        type: 'consultation',
        status: 'scheduled',
        duration: 30
      },
      {
        patient: patient._id,
        doctor: doctor._id,
        date: new Date(),
        time: '14:30',
        timeSlot: '14:30-15:00',
        reason: 'Follow-up visit',
        type: 'follow-up',
        status: 'confirmed',
        duration: 30
      },
      {
        patient: patient._id,
        doctor: doctor._id,
        date: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
        time: '09:00',
        timeSlot: '09:00-09:30',
        reason: 'Consultation for headache',
        type: 'consultation',
        status: 'scheduled',
        duration: 30
      }
    ];

    // Clear existing appointments for this doctor to avoid duplicates
    await Appointment.deleteMany({ doctor: doctor._id });
    console.log('🗑️ Cleared existing appointments');

    // Insert test appointments
    const createdAppointments = await Appointment.insertMany(testAppointments);
    console.log(`✅ Created ${createdAppointments.length} test appointments`);

    createdAppointments.forEach((apt, index) => {
      console.log(`📅 Appointment ${index + 1}:`, {
        date: apt.date.toISOString().split('T')[0],
        time: apt.time,
        reason: apt.reason,
        status: apt.status
      });
    });

  } catch (error) {
    console.error('❌ Error creating test appointments:', error);
  } finally {
    await mongoose.disconnect();
    console.log('📋 Database connection closed');
  }
};

createTestAppointments();