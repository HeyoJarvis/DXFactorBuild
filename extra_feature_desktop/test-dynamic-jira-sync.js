#!/usr/bin/env node

/**
 * Test Dynamic JIRA Sync
 * 
 * This script tests the dynamic deletion feature:
 * 1. Fetches JIRA issues
 * 2. Verifies cleanup of deleted issues
 * 3. Shows before/after comparison
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const TeamSyncSupabaseAdapter = require('./main/services/TeamSyncSupabaseAdapter');
const JIRAOAuthService = require('./main/services/oauth/JIRAOAuthService');
const StandaloneJIRAService = require('./main/services/StandaloneJIRAService');
const TaskCodeIntelligenceService = require('./main/services/TaskCodeIntelligenceService');
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.colorize(),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
      const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
      return `${timestamp} ${level}: ${message} ${metaStr}`;
    })
  ),
  transports: [new winston.transports.Console()]
});

async function testDynamicSync() {
  console.log('🧪 Testing Dynamic JIRA Sync\n');

  try {
    // Initialize services
    const supabaseAdapter = new TeamSyncSupabaseAdapter({ logger });
    const jiraOAuthService = new JIRAOAuthService({ supabaseAdapter, logger });
    const jiraService = new StandaloneJIRAService({ 
      oauthService: jiraOAuthService,
      supabaseAdapter,
      logger 
    });
    const taskService = new TaskCodeIntelligenceService({
      jiraService,
      githubService: null,
      supabaseAdapter,
      logger
    });

    // Get user ID (you'll need to provide this)
    const userId = process.env.TEST_USER_ID;
    if (!userId) {
      console.error('❌ Please set TEST_USER_ID environment variable');
      process.exit(1);
    }

    console.log('📊 Step 1: Get current JIRA issues in database\n');
    const before = await supabaseAdapter.getTeamUpdates(userId, {
      update_type: 'jira_issue'
    });
    console.log(`Found ${before.updates?.length || 0} JIRA issues in database`);
    console.log('Issues:', before.updates?.map(u => u.external_key).join(', '));
    console.log('');

    console.log('🔄 Step 2: Fetch from JIRA API (with dynamic cleanup)\n');
    const result = await taskService.fetchJIRAUpdates(userId, { days: 30 });
    
    if (!result.success) {
      console.error('❌ Sync failed:', result.error);
      process.exit(1);
    }

    console.log(`✅ Synced ${result.updates?.length || 0} issues from JIRA`);
    console.log('Issues:', result.updates?.map(u => u.external_key).join(', '));
    console.log('');

    console.log('📊 Step 3: Get updated database state\n');
    const after = await supabaseAdapter.getTeamUpdates(userId, {
      update_type: 'jira_issue'
    });
    console.log(`Now have ${after.updates?.length || 0} JIRA issues in database`);
    console.log('Issues:', after.updates?.map(u => u.external_key).join(', '));
    console.log('');

    // Calculate difference
    const beforeIds = new Set(before.updates?.map(u => u.external_id) || []);
    const afterIds = new Set(after.updates?.map(u => u.external_id) || []);
    
    const added = after.updates?.filter(u => !beforeIds.has(u.external_id)) || [];
    const removed = before.updates?.filter(u => !afterIds.has(u.external_id)) || [];
    const unchanged = after.updates?.filter(u => beforeIds.has(u.external_id)) || [];

    console.log('📈 Summary:\n');
    console.log(`✅ Kept:    ${unchanged.length} issues`);
    console.log(`➕ Added:   ${added.length} issues`);
    console.log(`🗑️  Deleted: ${removed.length} issues`);
    
    if (removed.length > 0) {
      console.log('\n🗑️  Deleted issues:');
      removed.forEach(u => {
        console.log(`   - ${u.external_key}: ${u.title}`);
      });
    }

    if (added.length > 0) {
      console.log('\n➕ Added issues:');
      added.forEach(u => {
        console.log(`   - ${u.external_key}: ${u.title}`);
      });
    }

    console.log('\n✅ Dynamic sync test complete!');
    console.log('\n💡 To test deletion:');
    console.log('   1. Delete a JIRA issue in your JIRA workspace');
    console.log('   2. Run this test again');
    console.log('   3. The deleted issue should disappear from the database\n');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run test
testDynamicSync().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

