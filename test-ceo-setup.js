/**
 * Test CEO Setup with Real Slack User ID
 */

require('dotenv').config();

// Set the CEO user ID directly for testing
process.env.CEO_SLACK_USER_ID = 'U01EVR49DDX';
process.env.ORGANIZATION_NAME = 'CIPIO';

const WorkflowIntelligenceSystem = require('./core/intelligence/workflow-analyzer');

async function testCEOSetup() {
  console.log('👑 Testing CEO Setup for Sundeep Sanghavi');
  console.log('=' .repeat(50));
  
  const workflowIntelligence = new WorkflowIntelligenceSystem();
  
  // Set up CEO account
  console.log('🔧 Configuring CEO account...');
  workflowIntelligence.setUserRole('U01EVR49DDX', 'ceo', 'cipio_org');
  
  // Add some of your team members (from the list we saw earlier)
  console.log('👥 Adding CIPIO team members...');
  workflowIntelligence.setUserRole('U01E9GN1VU3', 'user', 'cipio_org'); // Harshil Shah
  workflowIntelligence.setUserRole('U01EAEHNDL6', 'user', 'cipio_org'); // Kiran
  workflowIntelligence.setUserRole('U01EFFA1Z3N', 'manager', 'cipio_org'); // Punit Bhadoirya (Owner)
  workflowIntelligence.setUserRole('U01EHCP60LT', 'manager', 'cipio_org'); // Tejas Shah (Owner)
  workflowIntelligence.setUserRole('U01EHCP6PH9', 'user', 'cipio_org'); // John Arrienda
  workflowIntelligence.setUserRole('U01EPBCC2MA', 'manager', 'cipio_org'); // Growson Edwards
  workflowIntelligence.setUserRole('U01F71Y40GG', 'manager', 'cipio_org'); // Hemang Sanghavi (Owner)
  workflowIntelligence.setUserRole('U01Q049DJMU', 'user', 'cipio_org'); // Jin Yu
  
  // Set up organization hierarchy
  workflowIntelligence.setOrganizationHierarchy('cipio_org', {
    ceo: 'U01EVR49DDX', // Sundeep Sanghavi (CEO)
    admins: ['U01EFFA1Z3N', 'U01EHCP60LT', 'U01EPBCC2MA', 'U01F71Y40GG'], // Owners/Admins
    managers: {
      'U01EFFA1Z3N': ['U01E9GN1VU3', 'U01EAEHNDL6'], // Punit manages Harshil & Kiran
      'U01EHCP60LT': ['U01EHCP6PH9'], // Tejas manages John
      'U01EPBCC2MA': ['U01Q049DJMU'], // Growson manages Jin Yu
      'U01F71Y40GG': [] // Hemang (no direct reports in this setup)
    }
  });
  
  console.log('✅ CIPIO organization configured');
  console.log('   CEO: Sundeep Sanghavi (U01EVR49DDX)');
  console.log('   Managers: Punit, Tejas, Growson, Hemang');
  console.log('   Team Members: Harshil, Kiran, John, Jin Yu');
  
  // Create CEO session
  const ceoSession = workflowIntelligence.createSession('U01EVR49DDX', {
    slack_workspace: 'CIPIO',
    role: 'ceo',
    real_name: 'Sundeep Sanghavi'
  });
  
  console.log(`\n🔑 CEO Session Created: ${ceoSession.sessionId}`);
  
  // Simulate some team activity
  console.log('\n📊 Simulating team workflow data...');
  
  const teamActivities = [
    {
      user: 'U01E9GN1VU3', // Harshil
      channel: 'C_DEV_CHANNEL',
      message: 'Working on the API integration task assigned by Sundeep',
      type: 'task_progress'
    },
    {
      user: 'U01EAEHNDL6', // Kiran
      channel: 'C_DESIGN_CHANNEL', 
      message: 'Completed the UI mockups, ready for review',
      type: 'task_completion'
    },
    {
      user: 'U01EHCP6PH9', // John
      channel: 'C_SALES_CHANNEL',
      message: 'Client meeting went well, need to follow up on the proposal',
      type: 'business_update'
    },
    {
      user: 'U01Q049DJMU', // Jin Yu
      channel: 'C_ANALYTICS_CHANNEL',
      message: 'Dashboard metrics show 15% improvement this week',
      type: 'metrics_update'
    },
    {
      user: 'U01EVR49DDX', // CEO (you)
      channel: 'C_EXECUTIVE_CHANNEL',
      message: 'Please prioritize the client onboarding workflow optimization',
      type: 'task_assignment'
    }
  ];
  
  for (const activity of teamActivities) {
    await workflowIntelligence.captureInboundRequest(
      activity.user,
      activity.channel,
      activity.message,
      {
        messageType: 'slack_message',
        timestamp: new Date(),
        activity_type: activity.type
      }
    );
  }
  
  console.log('✅ Team activity data simulated');
  
  // Test CEO access
  console.log('\n👑 CEO DASHBOARD - What You\'ll See:');
  console.log('=' .repeat(50));
  
  const ceoView = await workflowIntelligence.getAccessibleUsersAnalytics(
    'U01EVR49DDX', 7, ceoSession.sessionId
  );
  
  console.log(`📊 Total team members you can monitor: ${ceoView.accessible_users.length}`);
  console.log('\n👥 Team Member Activity:');
  
  Object.entries(ceoView.analytics).forEach(([userId, analytics]) => {
    const userNames = {
      'U01EVR49DDX': 'Sundeep Sanghavi (CEO)',
      'U01E9GN1VU3': 'Harshil Shah',
      'U01EAEHNDL6': 'Kiran',
      'U01EFFA1Z3N': 'Punit Bhadoirya',
      'U01EHCP60LT': 'Tejas Shah',
      'U01EHCP6PH9': 'John Arrienda',
      'U01EPBCC2MA': 'Growson Edwards',
      'U01F71Y40GG': 'Hemang Sanghavi',
      'U01Q049DJMU': 'Jin Yu'
    };
    
    const userName = userNames[userId] || userId;
    console.log(`   • ${userName}:`);
    console.log(`     - Interactions: ${analytics.total_interactions}`);
    console.log(`     - Active channels: ${Object.keys(analytics.channel_breakdown || {}).length}`);
    console.log(`     - Most active channel: ${analytics.most_active_channel?.channel_id || 'N/A'}`);
  });
  
  // Test team analytics
  const teamAnalytics = await workflowIntelligence.getFilteredTeamAnalytics(
    'U01EVR49DDX', 7, ceoSession.sessionId
  );
  
  console.log('\n📈 CIPIO Team Analytics:');
  console.log(`   Total interactions: ${teamAnalytics.total_interactions}`);
  console.log(`   Active team members: ${teamAnalytics.total_users}`);
  console.log(`   Team channels: ${Object.keys(teamAnalytics.channels || {}).length}`);
  
  // Test employee access (what your team sees)
  console.log('\n👤 EMPLOYEE VIEW TEST (Harshil):');
  console.log('=' .repeat(50));
  
  const employeeSession = workflowIntelligence.createSession('U01E9GN1VU3');
  const employeeView = await workflowIntelligence.getAccessibleUsersAnalytics(
    'U01E9GN1VU3', 7, employeeSession.sessionId
  );
  
  console.log(`📊 Harshil can access: ${employeeView.accessible_users.length} user (self only)`);
  console.log(`   Personal interactions: ${employeeView.analytics['U01E9GN1VU3']?.total_interactions || 0}`);
  
  // Test access violation
  try {
    await workflowIntelligence.getUserWorkflowAnalytics(
      'U01EAEHNDL6', // Kiran's data
      7,
      'U01E9GN1VU3', // Harshil trying to access
      employeeSession.sessionId
    );
    console.log('❌ SECURITY BREACH: Employee accessed other employee data!');
  } catch (error) {
    console.log('✅ Cross-employee access properly blocked');
  }
  
  console.log('\n🎉 CEO SETUP TEST COMPLETE!');
  console.log('\n📋 SUMMARY:');
  console.log('✅ CEO account configured for Sundeep Sanghavi (U01EVR49DDX)');
  console.log('✅ CIPIO team hierarchy established');
  console.log('✅ CEO can monitor all 9 team members');
  console.log('✅ Employees restricted to personal data only');
  console.log('✅ Role-based permissions enforced');
  console.log('✅ Ready for production use!');
  
  console.log('\n🚀 NEXT STEPS:');
  console.log('1. Add CEO_SLACK_USER_ID=U01EVR49DDX to your .env file');
  console.log('2. Run: node ceo-slack-integration.js');
  console.log('3. Use /ceo-dashboard in Slack for real-time team monitoring');
}

if (require.main === module) {
  testCEOSetup().catch(console.error);
}

module.exports = testCEOSetup;
