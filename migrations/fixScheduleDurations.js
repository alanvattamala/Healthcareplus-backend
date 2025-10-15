// Migration script to fix missing duration fields in existing schedules
import mongoose from 'mongoose';
import Schedule from './models/Schedule.js';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/healthcare-plus';

async function fixScheduleDurations() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB');

    // Find all schedules with slots missing duration field
    const schedules = await Schedule.find({
      'availableSlots.duration': { $exists: false }
    });

    console.log(`Found ${schedules.length} schedules with missing duration fields`);

    let fixedCount = 0;
    for (const schedule of schedules) {
      let hasChanges = false;
      
      schedule.availableSlots.forEach(slot => {
        if (!slot.duration) {
          slot.duration = schedule.slotDuration || 30;
          hasChanges = true;
        }
      });

      if (hasChanges) {
        await schedule.save();
        fixedCount++;
        console.log(`Fixed schedule ${schedule._id} for doctor ${schedule.doctorId}`);
      }
    }

    console.log(`Migration completed. Fixed ${fixedCount} schedules.`);
    
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

// Run the migration
fixScheduleDurations();