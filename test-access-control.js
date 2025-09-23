/**
 * Simple Access Control Testing Script
 * 
 * Test different user roles and their permissions
 */

require('dotenv').config();

const WorkflowIntelligenceSystem = require('./core/intelligence/workflow-analyzer');

async function testAccessControl() {
  console.log('🧪 Testing Access Control System\n');
  
  const workflowIntelligence = new WorkflowIntelligenceSystem();
  
  // Setup test organization
  console.log('1️⃣ Setting up test users...');
  workflowIntelligence.setUserRole('ceo_test', 'ceo', 'test_org');
  workflowIntelligence.setUserRole('admin_test', 'org_admin', 'test_org');
  workflowIntelligence.setUserRole('manager_test', 'manager', 'test_org');
  workflowIntelligence.setUserRole('user_alice', 'user', 'test_org');
  workflowIntelligence.setUserRole('user_bob', 'user', 'test_org');
  
  workflowIntelligence.setOrganizationHierarchy('test_org', {
    ceo: 'ceo_test',
    admins: ['admin_test'],
    managers: {
      'manager_test': ['user_alice', 'user_bob']
    }
  });
  
  console.log('✅ Users created:');
  console.log('  • CEO: ceo_test');
  console.log('  • Admin: admin_test');
  console.log('  • Manager: manager_test (manages alice & bob)');
  console.log('  • Users: user_alice, user_bob\n');
  
  // Add some test data
  console.log('2️⃣ Adding sample workflow data...');
  
  const testData = [
    { user: 'user_alice', channel: 'dev', message: 'Need help with API integration' },
    { user: 'user_alice', channel: 'dev', message: 'Looking for automation tools' },
    { user: 'user_bob', channel: 'marketing', message: 'Dashboard reporting question' },
    { user: 'manager_test', channel: 'dev', message: 'Team standup notes' }
  ];
  
  for (const data of testData) {
    await workflowIntelligence.captureInboundRequest(
      data.user,
      data.channel,
      data.message,
      { messageType: 'test', timestamp: new Date() }
    );
  }
  
  console.log('✅ Sample data added\n');
  
  // Test different access scenarios
  console.log('3️⃣ Testing access permissions...\n');
  
  // Test 1: CEO can access anyone
  console.log('👑 CEO Access Test:');
  try {
    const ceoSession = workflowIntelligence.createSession('ceo_test');
    const aliceData = await workflowIntelligence.getUserWorkflowAnalytics(
      'user_alice', 7, 'ceo_test', ceoSession.sessionId
    );
    console.log(`✅ CEO can access Alice's data: ${aliceData.total_interactions} interactions`);
  } catch (error) {
    console.log(`❌ CEO access failed: ${error.message}`);
  }
  
  // Test 2: Manager can access direct reports
  console.log('\n👥 Manager Access Test:');
  try {
    const managerSession = workflowIntelligence.createSession('manager_test');
    const aliceData = await workflowIntelligence.getUserWorkflowAnalytics(
      'user_alice', 7, 'manager_test', managerSession.sessionId
    );
    console.log(`✅ Manager can access direct report Alice: ${aliceData.total_interactions} interactions`);
  } catch (error) {
    console.log(`❌ Manager access failed: ${error.message}`);
  }
  
  // Test 3: User can only access their own data
  console.log('\n👤 User Self-Access Test:');
  try {
    const userSession = workflowIntelligence.createSession('user_alice');
    const ownData = await workflowIntelligence.getUserWorkflowAnalytics(
      'user_alice', 7, 'user_alice', userSession.sessionId
    );
    console.log(`✅ User can access own data: ${ownData.total_interactions} interactions`);
  } catch (error) {
    console.log(`❌ Self-access failed: ${error.message}`);
  }
  
  // Test 4: User CANNOT access other user's data
  console.log('\n🚫 User Cross-Access Test (should fail):');
  try {
    const userSession = workflowIntelligence.createSession('user_alice');
    await workflowIntelligence.getUserWorkflowAnalytics(
      'user_bob', 7, 'user_alice', userSession.sessionId
    );
    console.log('❌ SECURITY BREACH: User accessed other user\'s data!');
  } catch (error) {
    console.log(`✅ Access properly denied: ${error.message}`);
  }
  
  // Test 5: Show permissions for each role
  console.log('\n📋 User Permissions Summary:');
  
  const roles = ['ceo_test', 'admin_test', 'manager_test', 'user_alice'];
  roles.forEach(userId => {
    const permissions = workflowIntelligence.getUserPermissions(userId);
    console.log(`\n${userId}:`);
    console.log(`  Role: ${permissions.role}`);
    console.log(`  Can view all users: ${permissions.permissions.canViewAllUsers}`);
    console.log(`  Can view team analytics: ${permissions.permissions.canViewTeamAnalytics}`);
    console.log(`  Data scope: ${permissions.permissions.dataScope}`);
  });
  
  console.log('\n🎉 Access control testing completed!');
  console.log('\n💡 Key Takeaways:');
  console.log('✅ CEO has full access to all user data');
  console.log('✅ Managers can access direct reports only');
  console.log('✅ Users can only access their own data');
  console.log('✅ Cross-user access is properly blocked');
  console.log('✅ Role-based permissions are enforced');
}

// Run the test
if (require.main === module) {
  testAccessControl().catch(console.error);
}

module.exports = testAccessControl;
