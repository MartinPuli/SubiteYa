/**
 * Clear all jobs from Redis queues
 * Usage: npx tsx src/scripts/clear-redis-queues.ts
 */

import { editQueue, uploadQueue } from '../lib/queues';

async function clearQueues() {
  try {
    console.log('🧹 Clearing Redis queues...\n');

    // Get current counts
    const editCounts = await editQueue.getJobCounts();
    const uploadCounts = await uploadQueue.getJobCounts();

    console.log('📊 Current job counts:');
    console.log('Edit Queue:', editCounts);
    console.log('Upload Queue:', uploadCounts);
    console.log('');

    // Clear edit queue
    console.log('🗑️  Clearing edit queue...');
    await editQueue.obliterate({ force: true });
    console.log('✅ Edit queue cleared');

    // Clear upload queue
    console.log('🗑️  Clearing upload queue...');
    await uploadQueue.obliterate({ force: true });
    console.log('✅ Upload queue cleared');

    // Verify
    const editCountsAfter = await editQueue.getJobCounts();
    const uploadCountsAfter = await uploadQueue.getJobCounts();

    console.log('\n📊 Final job counts:');
    console.log('Edit Queue:', editCountsAfter);
    console.log('Upload Queue:', uploadCountsAfter);

    console.log('\n✅ All queues cleared successfully!');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error clearing queues:', error);
    process.exit(1);
  }
}

clearQueues();
