/**
 * Test if JIRA is actually working after token refresh
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

// Import services
const TeamSyncSupabaseAdapter = require('./main/services/TeamSyncSupabaseAdapter');
const JIRAOAuthService = require('./main/services/oauth/JIRAOAuthService');
const StandaloneJIRAService = require('./main/services/StandaloneJIRAService');
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message, ...rest }) => {
      return `${timestamp} [${level}]: ${message} ${Object.keys(rest).length ? JSON.stringify(rest, null, 2) : ''}`;
    })
  ),
  transports: [new winston.transports.Console()]
});

async function testJIRAWorking() {
  try {
    const userId = 'e833f35b-5991-4ede-b10a-e3702e46b37b';
    
    console.log('🧪 Testing JIRA integration...\n');
    
    // Initialize services
    const supabaseAdapter = new TeamSyncSupabaseAdapter({ logger });
    const jiraOAuthService = new JIRAOAuthService({
      logger,
      supabaseAdapter
    });
    const jiraService = new StandaloneJIRAService({
      logger,
      oauthService: jiraOAuthService,
      supabaseAdapter
    });
    
    // Check if connected
    console.log('1️⃣  Checking JIRA connection status...');
    const isConnected = await jiraService.isConnected(userId);
    console.log('   ✓ Connected:', isConnected, '\n');
    
    if (!isConnected) {
      console.log('❌ JIRA is not connected. Please reconnect from Settings.\n');
      return;
    }
    
    // Try to fetch recent updates
    console.log('2️⃣  Fetching recent JIRA updates (last 30 days)...');
    try {
      const recentIssues = await jiraService.getRecentUpdates(userId, { days: 30, maxResults: 10 });
      console.log(`   ✓ Found ${recentIssues.length} recent issues\n`);
      
      if (recentIssues.length > 0) {
        console.log('📋 Recent JIRA Issues:');
        console.log('=====================\n');
        
        recentIssues.forEach((issue, index) => {
          console.log(`${index + 1}. [${issue.key}] ${issue.summary}`);
          console.log(`   Status: ${issue.status} | Type: ${issue.issueType}`);
          if (issue.assignee) {
            console.log(`   Assignee: ${issue.assignee.displayName}`);
          }
          console.log(`   Updated: ${new Date(issue.updated).toLocaleString()}`);
          console.log('');
        });
      } else {
        console.log('ℹ️  No recent issues found. This might mean:');
        console.log('   - Your JIRA site has no issues');
        console.log('   - No issues were updated in the last 30 days');
        console.log('   - You don\'t have permission to see issues\n');
      }
      
    } catch (fetchError) {
      console.log('   ❌ Failed to fetch issues:', fetchError.message, '\n');
    }
    
    // Try to fetch "my issues"
    console.log('3️⃣  Fetching your assigned JIRA issues...');
    try {
      const myIssues = await jiraService.getMyIssues(userId, { maxResults: 10 });
      console.log(`   ✓ Found ${myIssues.length} issues assigned to you\n`);
      
      if (myIssues.length > 0) {
        console.log('📌 Your JIRA Issues:');
        console.log('===================\n');
        
        myIssues.forEach((issue, index) => {
          console.log(`${index + 1}. [${issue.key}] ${issue.summary}`);
          console.log(`   Status: ${issue.status} | Priority: ${issue.priority || 'None'}`);
          if (issue.dueDate) {
            console.log(`   Due: ${new Date(issue.dueDate).toLocaleDateString()}`);
          }
          console.log('');
        });
      } else {
        console.log('ℹ️  No issues assigned to you.\n');
      }
      
    } catch (myIssuesError) {
      console.log('   ❌ Failed to fetch your issues:', myIssuesError.message, '\n');
    }
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ JIRA Integration Test Complete!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
  }
}

testJIRAWorking();


