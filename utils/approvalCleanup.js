import Approval from '../models/Approval.js';

// Schedule deletion of a processed approval request after specified delay
const scheduleApprovalDeletion = (approvalId, delayMinutes = 2) => {
  const delayMs = delayMinutes * 60 * 1000; // Convert minutes to milliseconds
  
  console.log(`📅 Scheduling deletion of approval ${approvalId} in ${delayMinutes} minutes`);
  
  setTimeout(async () => {
    try {
      const approval = await Approval.findById(approvalId);
      
      if (approval && approval.status !== 'pending') {
        console.log(`🗑️ Auto-deleting processed approval: ${approvalId}`);
        await Approval.findByIdAndDelete(approvalId);
        console.log(`✅ Successfully deleted approval: ${approvalId}`);
      } else if (approval && approval.status === 'pending') {
        console.log(`⏸️ Skipping deletion of pending approval: ${approvalId}`);
      } else {
        console.log(`❓ Approval not found for deletion: ${approvalId}`);
      }
    } catch (error) {
      console.error(`❌ Error deleting approval ${approvalId}:`, error);
    }
  }, delayMs);
};

// Clean up all processed approvals older than specified minutes
const cleanupOldProcessedApprovals = async (olderThanMinutes = 5) => {
  try {
    const cutoffTime = new Date(Date.now() - (olderThanMinutes * 60 * 1000));
    
    const result = await Approval.deleteMany({
      status: { $in: ['approved', 'rejected'] },
      processedAt: { $lt: cutoffTime }
    });
    
    if (result.deletedCount > 0) {
      console.log(`🧹 Cleaned up ${result.deletedCount} old processed approvals`);
    }
    
    return result.deletedCount;
  } catch (error) {
    console.error('❌ Error cleaning up old approvals:', error);
    return 0;
  }
};

// Start periodic cleanup of old processed approvals
const startPeriodicCleanup = (intervalMinutes = 10, olderThanMinutes = 5) => {
  const intervalMs = intervalMinutes * 60 * 1000;
  
  console.log(`🔄 Starting periodic cleanup every ${intervalMinutes} minutes for approvals older than ${olderThanMinutes} minutes`);
  
  setInterval(async () => {
    await cleanupOldProcessedApprovals(olderThanMinutes);
  }, intervalMs);
};

export {
  scheduleApprovalDeletion,
  cleanupOldProcessedApprovals,
  startPeriodicCleanup
};