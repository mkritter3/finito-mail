#!/usr/bin/env node

/**
 * Scheduled cleanup job for onboarding suggestions
 * Run this via cron: 0 2 * * * node scripts/cleanup-onboarding.js
 */

const { OnboardingCleanupJob } = require('../apps/api/lib/onboarding/cleanup-job');
require('dotenv').config();

async function runScheduledCleanup() {
  console.log('🧹 Starting scheduled onboarding cleanup...');
  
  try {
    const result = await OnboardingCleanupJob.runScheduledCleanup();
    
    if (result.success) {
      console.log('✅ Cleanup completed successfully:');
      console.log(`   - Suggestions expired: ${result.suggestionsExpired}`);
      console.log(`   - Async actions cleaned: ${result.asyncActionsCleanedUp}`);
      console.log(`   - Message: ${result.message}`);
    } else {
      console.error('❌ Cleanup failed:', result.error);
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Cleanup script error:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  runScheduledCleanup();
}

module.exports = { runScheduledCleanup };