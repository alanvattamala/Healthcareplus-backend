// Quick fix script for duration validation issues
import mongoose from 'mongoose';

// Connect to your database
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/healthcare-plus';

async function quickFixDurations() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB');

    // Update all schedules to ensure slots have duration field
    const result = await mongoose.connection.db.collection('schedules').updateMany(
      { 'availableSlots.duration': { $exists: false } },
      [
        {
          $set: {
            availableSlots: {
              $map: {
                input: '$availableSlots',
                as: 'slot',
                in: {
                  $mergeObjects: [
                    '$$slot',
                    {
                      duration: {
                        $ifNull: ['$$slot.duration', { $ifNull: ['$slotDuration', 30] }]
                      }
                    }
                  ]
                }
              }
            }
          }
        }
      ]
    );

    console.log(`Updated ${result.modifiedCount} schedules with missing duration fields`);
    
  } catch (error) {
    console.error('Fix failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  quickFixDurations();
}

export { quickFixDurations };