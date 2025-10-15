// Migration script to fix appointment dates that may have been shifted due to timezone issues
import mongoose from 'mongoose';
import Appointment from './models/Appointment.js';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/healthcare-plus';

async function fixAppointmentDates() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB');

    // Find all appointments
    const appointments = await Appointment.find({});
    console.log(`Found ${appointments.length} appointments to check`);

    let fixedCount = 0;
    
    for (const appointment of appointments) {
      const currentDate = appointment.date;
      const currentDateStr = currentDate.toISOString().split('T')[0];
      
      // Check if the date is at midnight UTC (which could cause timezone issues)
      const hours = currentDate.getUTCHours();
      const minutes = currentDate.getUTCMinutes();
      const seconds = currentDate.getUTCSeconds();
      
      if (hours === 0 && minutes === 0 && seconds === 0) {
        // This appointment was stored at midnight UTC, fix it to noon UTC
        const [year, month, day] = currentDateStr.split('-').map(Number);
        const fixedDate = new Date(Date.UTC(year, month - 1, day, 12, 0, 0, 0));
        
        console.log(`Fixing appointment ${appointment._id}:`);
        console.log(`  Before: ${currentDate.toISOString()} (${currentDateStr})`);
        console.log(`  After:  ${fixedDate.toISOString()} (${fixedDate.toISOString().split('T')[0]})`);
        
        appointment.date = fixedDate;
        await appointment.save();
        fixedCount++;
      }
    }

    console.log(`Migration completed. Fixed ${fixedCount} appointments.`);
    
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  fixAppointmentDates();
}

export { fixAppointmentDates };