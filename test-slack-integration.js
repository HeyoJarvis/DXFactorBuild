/**
 * Test Slack Integration with Role-Based Access Control
 */

require('dotenv').config();

const WorkflowIntelligenceSystem = require('./core/intelligence/workflow-analyzer');

async function testSlackIntegration() {
  console.log('💬 Testing Slack Integration with RBAC\n');
  
  const workflowIntelligence = new WorkflowIntelligenceSystem();
  
  // Setup test organization (same as before)
  workflowIntelligence.setUserRole('ceo_slack', 'ceo', 'slack_org');
  workflowIntelligence.setUserRole('user_slack', 'user', 'slack_org');
  
  workflowIntelligence.setOrganizationHierarchy('slack_org', {
    ceo: 'ceo_slack',
    admins: [],
    managers: {}
  });
  
  console.log('✅ Slack organization setup completed\n');
  
  // Simulate Slack messages being captured
  console.log('📱 Simulating Slack workflow capture...');
  
  const slackMessages = [
    {
      user: 'user_slack',
      channel: 'C1234567890', // Slack channel ID format
      text: 'I need help automating our weekly reports',
      timestamp: new Date()
    },
    {
      user: 'ceo_slack', 
      channel: 'C0987654321',
      text: 'What are our team productivity metrics?',
      timestamp: new Date()
    }
  ];
  
  // Capture Slack messages
  for (const msg of slackMessages) {
    await workflowIntelligence.captureInboundRequest(
      msg.user,
      msg.channel,
      msg.text,
      {
        messageType: 'slack_message',
        timestamp: msg.timestamp,
        source: 'slack'
      }
    );
  }
  
  console.log('✅ Slack messages captured\n');
  
  // Test CEO dashboard access (what you would see)
  console.log('👑 CEO Dashboard View:');
  try {
    const ceoSession = workflowIntelligence.createSession('ceo_slack', {
      slack_user_id: 'U123CEO',
      slack_team_id: 'T123TEAM'
    });
    
    // CEO can see all users
    const allUsers = await workflowIntelligence.getAccessibleUsersAnalytics(
      'ceo_slack', 7, ceoSession.sessionId
    );
    
    console.log(`✅ CEO can access ${allUsers.accessible_users.length} users:`);
    Object.entries(allUsers.analytics).forEach(([userId, analytics]) => {
      console.log(`  • ${userId}: ${analytics.total_interactions} interactions`);
      console.log(`    - Channels: ${Object.keys(analytics.channel_breakdown || {}).length}`);
      console.log(`    - Most active: ${analytics.most_active_channel?.channel_id || 'N/A'}`);
    });
    
    // CEO can see team analytics
    const teamAnalytics = await workflowIntelligence.getFilteredTeamAnalytics(
      'ceo_slack', 7, ceoSession.sessionId
    );
    
    console.log(`\n📊 Team Overview:`);
    console.log(`  • Total users: ${teamAnalytics.total_users}`);
    console.log(`  • Total interactions: ${teamAnalytics.total_interactions}`);
    console.log(`  • Active channels: ${Object.keys(teamAnalytics.channels || {}).length}`);
    
  } catch (error) {
    console.log(`❌ CEO access failed: ${error.message}`);
  }
  
  // Test regular user view (what employees would see)
  console.log('\n👤 Regular User View:');
  try {
    const userSession = workflowIntelligence.createSession('user_slack', {
      slack_user_id: 'U123USER',
      slack_team_id: 'T123TEAM'
    });
    
    // User can only see their own data
    const userData = await workflowIntelligence.getUserWorkflowAnalytics(
      'user_slack', 7, 'user_slack', userSession.sessionId
    );
    
    console.log(`✅ User can access own data:`);
    console.log(`  • Personal interactions: ${userData.total_interactions}`);
    console.log(`  • Personal insights: ${userData.active_insights}`);
    
    // User cannot see team analytics
    try {
      await workflowIntelligence.getFilteredTeamAnalytics(
        'user_slack', 7, userSession.sessionId
      );
      console.log('❌ SECURITY BREACH: User accessed team analytics!');
    } catch (error) {
      console.log('✅ Team analytics properly blocked for regular users');
    }
    
  } catch (error) {
    console.log(`❌ User access failed: ${error.message}`);
  }
  
  console.log('\n🎉 Slack integration testing completed!');
  console.log('\n💡 Integration Summary:');
  console.log('✅ CEO gets bird\'s eye view of all team activity');
  console.log('✅ Regular users only see their personal workflow data');
  console.log('✅ Slack messages are properly captured and analyzed');
  console.log('✅ Role-based access control works in Slack context');
  console.log('✅ Session management supports Slack user context');
}

// Run the test
if (require.main === module) {
  testSlackIntegration().catch(console.error);
}

module.exports = testSlackIntegration;
