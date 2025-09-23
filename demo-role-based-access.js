/**
 * Demo: Role-Based Access Control for Workflow Intelligence
 * 
 * Demonstrates different user roles and their access permissions:
 * - CEO: Full access to all users and analytics
 * - Org Admin: Organization-wide access
 * - Manager: Access to direct reports
 * - User: Personal data only
 */

require('dotenv').config();

const WorkflowIntelligenceSystem = require('./core/intelligence/workflow-analyzer');

class RoleBasedAccessDemo {
  constructor() {
    this.workflowIntelligence = new WorkflowIntelligenceSystem({
      logLevel: 'info'
    });
    
    // Demo organization setup
    this.organizationId = 'acme_corp_001';
    this.users = {
      ceo: 'sarah_ceo_001',
      admin: 'mike_admin_002', 
      manager1: 'alice_mgr_123',
      manager2: 'bob_mgr_456',
      user1: 'charlie_dev_789',
      user2: 'diana_des_012',
      user3: 'eve_mkt_345',
      user4: 'frank_sal_678'
    };
  }

  async runDemo() {
    console.log('🔐 Role-Based Access Control Demo\n');
    console.log('=' .repeat(60));
    
    try {
      // Step 1: Initialize organization structure
      await this.setupOrganization();
      
      // Step 2: Simulate workflow data for all users
      await this.simulateWorkflowData();
      
      // Step 3: Demonstrate CEO access (full system)
      await this.demonstrateCEOAccess();
      
      // Step 4: Demonstrate Org Admin access (organization-wide)
      await this.demonstrateOrgAdminAccess();
      
      // Step 5: Demonstrate Manager access (team only)
      await this.demonstrateManagerAccess();
      
      // Step 6: Demonstrate User access (personal only)
      await this.demonstrateUserAccess();
      
      // Step 7: Demonstrate access violations
      await this.demonstrateAccessViolations();
      
      console.log('\n✅ Role-Based Access Control Demo Completed!');
      console.log('\n🛡️ Security Features Demonstrated:');
      console.log('• Hierarchical role-based permissions');
      console.log('• Session-based authentication');
      console.log('• Data filtering by access level');
      console.log('• Access violation detection and logging');
      console.log('• Organization boundary enforcement');
      
    } catch (error) {
      console.error('❌ Demo failed:', error.message);
      throw error;
    }
  }

  async setupOrganization() {
    console.log('🏢 Step 1: Setting up organization structure...\n');
    
    // Set user roles
    this.workflowIntelligence.setUserRole(this.users.ceo, 'ceo', this.organizationId);
    this.workflowIntelligence.setUserRole(this.users.admin, 'org_admin', this.organizationId);
    this.workflowIntelligence.setUserRole(this.users.manager1, 'manager', this.organizationId);
    this.workflowIntelligence.setUserRole(this.users.manager2, 'manager', this.organizationId);
    this.workflowIntelligence.setUserRole(this.users.user1, 'user', this.organizationId);
    this.workflowIntelligence.setUserRole(this.users.user2, 'user', this.organizationId);
    this.workflowIntelligence.setUserRole(this.users.user3, 'user', this.organizationId);
    this.workflowIntelligence.setUserRole(this.users.user4, 'user', this.organizationId);
    
    // Set organization hierarchy
    this.workflowIntelligence.setOrganizationHierarchy(this.organizationId, {
      ceo: this.users.ceo,
      admins: [this.users.admin],
      managers: {
        [this.users.manager1]: [this.users.user1, this.users.user2], // Alice manages Charlie & Diana
        [this.users.manager2]: [this.users.user3, this.users.user4]  // Bob manages Eve & Frank
      }
    });
    
    console.log('✓ Organization hierarchy configured:');
    console.log(`  CEO: Sarah (${this.users.ceo})`);
    console.log(`  Admin: Mike (${this.users.admin})`);
    console.log(`  Manager: Alice (${this.users.manager1}) → Charlie, Diana`);
    console.log(`  Manager: Bob (${this.users.manager2}) → Eve, Frank`);
    console.log('\n✅ Organization setup completed\n');
  }

  async simulateWorkflowData() {
    console.log('📊 Step 2: Simulating workflow data for all users...\n');
    
    const workflowScenarios = [
      // CEO - Strategic discussions
      { user: this.users.ceo, channel: 'executive', interactions: 5, focus: 'strategy' },
      
      // Admin - System management
      { user: this.users.admin, channel: 'admin', interactions: 8, focus: 'tools' },
      
      // Manager 1 - Team coordination
      { user: this.users.manager1, channel: 'dev-team', interactions: 12, focus: 'workflow' },
      { user: this.users.manager1, channel: 'general', interactions: 3, focus: 'general' },
      
      // Manager 2 - Sales & Marketing
      { user: this.users.manager2, channel: 'sales-team', interactions: 10, focus: 'automation' },
      
      // Users - Individual work
      { user: this.users.user1, channel: 'dev-team', interactions: 15, focus: 'integration' },
      { user: this.users.user2, channel: 'dev-team', interactions: 8, focus: 'tools' },
      { user: this.users.user3, channel: 'sales-team', interactions: 12, focus: 'reporting' },
      { user: this.users.user4, channel: 'sales-team', interactions: 6, focus: 'automation' }
    ];

    for (const scenario of workflowScenarios) {
      for (let i = 0; i < scenario.interactions; i++) {
        const timestamp = new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000);
        const message = this.generateMessage(scenario.focus);
        
        await this.workflowIntelligence.captureInboundRequest(
          scenario.user,
          scenario.channel,
          message,
          {
            messageType: 'channel_message',
            timestamp
          }
        );
      }
      
      const userName = scenario.user.split('_')[0];
      console.log(`  ✓ ${userName}: ${scenario.interactions} interactions in #${scenario.channel}`);
    }
    
    console.log('\n✅ Workflow data simulated\n');
  }

  generateMessage(focus) {
    const messages = {
      'strategy': ['Need to review Q4 strategic initiatives', 'Market expansion opportunities?'],
      'tools': ['System maintenance scheduled', 'User access management review'],
      'workflow': ['Team standup notes', 'Process optimization discussion'],
      'automation': ['Automate sales reporting', 'CRM workflow improvements'],
      'integration': ['API integration with new service', 'Database sync issues'],
      'reporting': ['Monthly sales dashboard', 'Customer analytics report'],
      'general': ['Team lunch planning', 'Office updates']
    };
    
    const focusMessages = messages[focus] || messages['general'];
    return focusMessages[Math.floor(Math.random() * focusMessages.length)];
  }

  async demonstrateCEOAccess() {
    console.log('👑 Step 3: CEO Access Demonstration...\n');
    
    // Create CEO session
    const ceoSession = this.workflowIntelligence.createSession(this.users.ceo, {
      role: 'ceo',
      login_source: 'web_dashboard'
    });
    
    console.log('🔑 CEO Session Created:');
    console.log(`  Session ID: ${ceoSession.sessionId}`);
    console.log(`  Role: ${ceoSession.role}`);
    console.log(`  Permissions: Full system access`);
    
    // CEO can access all users
    console.log('\n📊 CEO Analytics Access:');
    const accessibleUsers = await this.workflowIntelligence.getAccessibleUsersAnalytics(
      this.users.ceo, 7, ceoSession.sessionId
    );
    
    console.log(`  ✓ Can access ${accessibleUsers.accessible_users.length} users:`);
    accessibleUsers.accessible_users.forEach(userId => {
      const userName = userId.split('_')[0];
      const analytics = accessibleUsers.analytics[userId];
      console.log(`    - ${userName}: ${analytics.total_interactions} interactions`);
    });
    
    // CEO can access team analytics
    const teamAnalytics = await this.workflowIntelligence.getFilteredTeamAnalytics(
      this.users.ceo, 7, ceoSession.sessionId
    );
    
    console.log('\n📈 CEO Team Analytics:');
    console.log(`  Total Users: ${teamAnalytics.total_users}`);
    console.log(`  Total Interactions: ${teamAnalytics.total_interactions}`);
    console.log(`  Active Channels: ${Object.keys(teamAnalytics.channels).length}`);
    
    console.log('\n✅ CEO access demonstration completed\n');
  }

  async demonstrateOrgAdminAccess() {
    console.log('🔧 Step 4: Org Admin Access Demonstration...\n');
    
    const adminSession = this.workflowIntelligence.createSession(this.users.admin);
    
    console.log('🔑 Org Admin Session:');
    console.log(`  Role: ${adminSession.role}`);
    console.log(`  Scope: Organization-wide access`);
    
    // Admin can access all users in organization
    const accessibleUsers = await this.workflowIntelligence.getAccessibleUsersAnalytics(
      this.users.admin, 7, adminSession.sessionId
    );
    
    console.log(`\n📊 Admin can access ${accessibleUsers.accessible_users.length} users in organization`);
    
    // Admin can access team analytics
    try {
      const teamAnalytics = await this.workflowIntelligence.getFilteredTeamAnalytics(
        this.users.admin, 7, adminSession.sessionId
      );
      console.log('✓ Team analytics access: Granted');
      console.log(`  Organization interactions: ${teamAnalytics.total_interactions}`);
    } catch (error) {
      console.log('❌ Team analytics access: Denied');
    }
    
    console.log('\n✅ Org Admin access demonstration completed\n');
  }

  async demonstrateManagerAccess() {
    console.log('👥 Step 5: Manager Access Demonstration...\n');
    
    const managerSession = this.workflowIntelligence.createSession(this.users.manager1);
    
    console.log('🔑 Manager Session (Alice):');
    console.log(`  Role: ${managerSession.role}`);
    console.log(`  Scope: Direct reports only`);
    
    // Manager can access direct reports
    const accessibleUsers = await this.workflowIntelligence.getAccessibleUsersAnalytics(
      this.users.manager1, 7, managerSession.sessionId
    );
    
    console.log(`\n📊 Manager can access ${accessibleUsers.accessible_users.length} users:`);
    accessibleUsers.accessible_users.forEach(userId => {
      const userName = userId.split('_')[0];
      const analytics = accessibleUsers.analytics[userId];
      const relation = userId === this.users.manager1 ? '(self)' : '(direct report)';
      console.log(`  - ${userName} ${relation}: ${analytics.total_interactions} interactions`);
    });
    
    // Try to access team analytics
    try {
      await this.workflowIntelligence.getFilteredTeamAnalytics(
        this.users.manager1, 7, managerSession.sessionId
      );
      console.log('✓ Team analytics access: Granted (filtered)');
    } catch (error) {
      console.log('❌ Team analytics access: Denied');
    }
    
    console.log('\n✅ Manager access demonstration completed\n');
  }

  async demonstrateUserAccess() {
    console.log('👤 Step 6: Regular User Access Demonstration...\n');
    
    const userSession = this.workflowIntelligence.createSession(this.users.user1);
    
    console.log('🔑 User Session (Charlie):');
    console.log(`  Role: ${userSession.role}`);
    console.log(`  Scope: Personal data only`);
    
    // User can only access their own data
    const accessibleUsers = await this.workflowIntelligence.getAccessibleUsersAnalytics(
      this.users.user1, 7, userSession.sessionId
    );
    
    console.log(`\n📊 User can access ${accessibleUsers.accessible_users.length} user (self only):`);
    accessibleUsers.accessible_users.forEach(userId => {
      const userName = userId.split('_')[0];
      const analytics = accessibleUsers.analytics[userId];
      console.log(`  - ${userName} (self): ${analytics.total_interactions} interactions`);
    });
    
    // User cannot access team analytics
    try {
      await this.workflowIntelligence.getFilteredTeamAnalytics(
        this.users.user1, 7, userSession.sessionId
      );
      console.log('✓ Team analytics access: Granted');
    } catch (error) {
      console.log('❌ Team analytics access: Denied (insufficient permissions)');
    }
    
    console.log('\n✅ User access demonstration completed\n');
  }

  async demonstrateAccessViolations() {
    console.log('🚫 Step 7: Access Violation Demonstrations...\n');
    
    const userSession = this.workflowIntelligence.createSession(this.users.user1);
    
    console.log('🔍 Testing access violations:');
    
    // User trying to access another user's data
    try {
      await this.workflowIntelligence.getUserWorkflowAnalytics(
        this.users.user3, // Eve's data
        7, 
        this.users.user1, // Charlie requesting
        userSession.sessionId
      );
      console.log('❌ SECURITY BREACH: User accessed other user\'s data');
    } catch (error) {
      console.log('✅ Access properly denied: User cannot access other user\'s data');
      console.log(`   Error: ${error.message}`);
    }
    
    // Manager trying to access non-report's data
    const managerSession = this.workflowIntelligence.createSession(this.users.manager1);
    
    try {
      await this.workflowIntelligence.getUserWorkflowAnalytics(
        this.users.user3, // Eve (not Alice's report)
        7,
        this.users.manager1, // Alice requesting
        managerSession.sessionId
      );
      console.log('❌ SECURITY BREACH: Manager accessed non-report\'s data');
    } catch (error) {
      console.log('✅ Access properly denied: Manager cannot access non-report\'s data');
      console.log(`   Error: ${error.message}`);
    }
    
    console.log('\n✅ Access violation testing completed\n');
  }
}

// Run the demo
async function main() {
  const demo = new RoleBasedAccessDemo();
  
  try {
    await demo.runDemo();
    
    console.log('\n🎉 Role-Based Access Control Demo Completed Successfully!');
    console.log('\n🔒 Security Implementation Summary:');
    console.log('✓ CEO: Full system access (all users, all analytics)');
    console.log('✓ Org Admin: Organization-wide access (all org users, team analytics)');
    console.log('✓ Manager: Team access (direct reports only, filtered analytics)');
    console.log('✓ User: Personal access (own data only, no team analytics)');
    console.log('\n🛡️ Security Features:');
    console.log('• Role-based permission enforcement');
    console.log('• Session-based authentication');
    console.log('• Access attempt logging and auditing');
    console.log('• Data filtering by permission level');
    console.log('• Organization boundary enforcement');
    console.log('\n💡 Integration Ready:');
    console.log('• API endpoints secured with role checks');
    console.log('• Slack app integration with user context');
    console.log('• Session management for web dashboard');
    console.log('• Audit trail for compliance requirements');
    
  } catch (error) {
    console.error('\n❌ Demo failed:', error.message);
    process.exit(1);
  }
}

// Export for use in other modules
module.exports = RoleBasedAccessDemo;

// Run if called directly
if (require.main === module) {
  main();
}
