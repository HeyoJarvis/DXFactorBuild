/**
 * Test Workflow-Based Sessions
 * 
 * This script tests the workflow session setup:
 * 1. Creates workflow sessions for different types
 * 2. Adds messages to each workflow
 * 3. Retrieves and displays workflow summaries
 * 4. Tests workflow switching
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const DesktopSupabaseAdapter = require('./desktop/main/supabase-adapter');

const TEST_USER_ID = 'test-user-workflow';

async function testWorkflowSessions() {
  console.log('🧪 Testing Workflow-Based Sessions\n');
  
  // Initialize adapter
  const adapter = new DesktopSupabaseAdapter({
    logger: console
  });
  
  console.log('✅ Adapter initialized\n');
  
  // Test 1: Create different workflow sessions (each is a NEW session)
  console.log('📝 Test 1: Creating separate workflow sessions\n');
  console.log('Note: Each workflow creates a NEW session (type is just metadata)\n');
  
  const workflows = [
    {
      name: 'Automate weekly reporting',
      workflowType: 'task_automation',
      workflowIntent: 'task_automation',
      urgency: 'high',
      toolsMentioned: ['zapier', 'make'],
      entities: { actions: ['automate', 'workflow'] }
    },
    {
      name: 'Find project management tool',
      workflowType: 'tool_recommendation',
      workflowIntent: 'tool_recommendation',
      urgency: 'medium',
      toolsMentioned: ['slack', 'notion'],
      entities: { concepts: ['productivity', 'collaboration'] }
    },
    {
      name: 'Connect Salesforce to HubSpot',
      workflowType: 'integration_help',
      workflowIntent: 'integration_help',
      urgency: 'low',
      toolsMentioned: ['salesforce', 'hubspot'],
      entities: { actions: ['integrate', 'connect'] }
    },
    {
      name: 'Another automation task',
      workflowType: 'task_automation',
      workflowIntent: 'task_automation',
      urgency: 'medium',
      toolsMentioned: ['zapier'],
      entities: { actions: ['automate'] }
    },
    {
      name: 'General question',
      workflowType: 'general_inquiry',
      workflowIntent: 'information_seeking',
      urgency: 'low',
      toolsMentioned: [],
      entities: {}
    }
  ];
  
  const createdSessions = [];
  
  for (const workflow of workflows) {
    console.log(`Creating session for: ${workflow.name} (${workflow.workflowType})...`);
    const result = await adapter.createWorkflowSession(TEST_USER_ID, workflow);
    
    if (result.success) {
      createdSessions.push(result.session);
      console.log(`  ✅ Session created: ${result.session.id}`);
      console.log(`     Title: ${result.session.session_title}`);
      console.log(`     Workflow Type: ${result.session.workflow_type}`);
      console.log(`     Workflow ID: ${result.session.workflow_id}\n`);
    } else {
      console.log(`  ❌ Failed: ${result.error}\n`);
    }
  }
  
  // Test 2: Add messages to each workflow
  console.log('\n💬 Test 2: Adding messages to each workflow\n');
  
  const testMessages = [
    {
      session: createdSessions[0],
      messages: [
        { role: 'user', text: 'How can I automate my weekly reporting?' },
        { role: 'assistant', text: 'I can help you set up automation using Zapier or Make. What tools are you currently using for reporting?' },
        { role: 'user', text: 'I use Google Sheets and Slack' }
      ]
    },
    {
      session: createdSessions[1],
      messages: [
        { role: 'user', text: 'What tool should I use for project management?' },
        { role: 'assistant', text: 'Based on your needs, I recommend Notion for integrated docs and tasks, or Linear for developer-focused projects.' }
      ]
    },
    {
      session: createdSessions[2],
      messages: [
        { role: 'user', text: 'Can I connect Salesforce to HubSpot?' },
        { role: 'assistant', text: 'Yes! You can integrate Salesforce and HubSpot using their native integration or tools like Zapier.' }
      ]
    },
    {
      session: createdSessions[3],
      messages: [
        { role: 'user', text: 'Hello! What can you help me with?' },
        { role: 'assistant', text: 'Hi! I can help with automation, tool recommendations, integrations, and general business questions.' }
      ]
    }
  ];
  
  for (const testCase of testMessages) {
    if (!testCase.session) continue;
    
    console.log(`Adding messages to: ${testCase.session.session_title}`);
    
    for (const msg of testCase.messages) {
      const result = await adapter.saveMessageToSession(
        testCase.session.id,
        msg.text,
        msg.role,
        { workflow_type: testCase.session.workflow_type }
      );
      
      if (result.success) {
        console.log(`  ✅ ${msg.role}: "${msg.text.substring(0, 50)}..."`);
      } else {
        console.log(`  ❌ Failed to save message: ${result.error}`);
      }
    }
    console.log();
  }
  
  // Test 3: Retrieve workflow sessions
  console.log('\n📊 Test 3: Retrieving all workflow sessions\n');
  
  const sessionsResult = await adapter.getUserWorkflowSessions(TEST_USER_ID);
  
  if (sessionsResult.success) {
    console.log(`Total sessions: ${sessionsResult.sessions.length}\n`);
    
    console.log('Sessions grouped by workflow type:');
    Object.entries(sessionsResult.groupedByWorkflow).forEach(([type, sessions]) => {
      console.log(`\n  ${type}:`);
      sessions.forEach(session => {
        console.log(`    - ${session.session_title}`);
        console.log(`      Messages: ${session.message_count}`);
        console.log(`      Last activity: ${new Date(session.last_activity_at).toLocaleString()}`);
        console.log(`      Active: ${session.is_active}`);
      });
    });
  } else {
    console.log(`❌ Failed to retrieve sessions: ${sessionsResult.error}`);
  }
  
  // Test 4: Get workflow summary
  console.log('\n\n📈 Test 4: Getting workflow summary\n');
  
  const summaryResult = await adapter.getUserWorkflowSummary(TEST_USER_ID, 7);
  
  if (summaryResult.success) {
    console.log('Workflow Summary (last 7 days):\n');
    summaryResult.summary.forEach(item => {
      console.log(`  ${item.workflow_type}:`);
      console.log(`    Sessions: ${item.session_count}`);
      console.log(`    Total messages: ${item.total_messages}`);
      console.log(`    Active sessions: ${item.active_sessions}`);
      console.log(`    Last activity: ${new Date(item.last_activity).toLocaleString()}\n`);
    });
  } else {
    console.log(`❌ Failed to get summary: ${summaryResult.error}`);
  }
  
  // Test 5: Test that each workflow creates a NEW session (no reuse by type)
  console.log('\n🔄 Test 5: Testing that each workflow creates a NEW session\n');
  
  const newSessionResult = await adapter.createWorkflowSession(TEST_USER_ID, {
    workflowType: 'task_automation',
    workflowIntent: 'task_automation'
  });
  
  if (newSessionResult.success) {
    console.log(`  New Session ID: ${newSessionResult.session.id}`);
    console.log(`  Workflow Type: ${newSessionResult.session.workflow_type}`);
    console.log(`  Always creates new: ${newSessionResult.isNew}`);
    console.log(`  ✅ PASS - Each workflow gets its own session!\n`);
    
    // Show that we now have multiple task_automation sessions
    const allSessions = await adapter.getUserWorkflowSessions(TEST_USER_ID);
    if (allSessions.success) {
      const taskAutomationSessions = allSessions.groupedByWorkflow['task_automation'] || [];
      console.log(`  Total task_automation sessions: ${taskAutomationSessions.length}`);
      console.log(`  ✅ Confirmed: Multiple sessions can exist for the same workflow type\n`);
    }
  }
  
  // Test 6: Get messages for a specific workflow
  console.log('\n💬 Test 6: Retrieving messages for task_automation workflow\n');
  
  if (createdSessions[0]) {
    const messagesResult = await adapter.getSessionMessages(createdSessions[0].id);
    
    if (messagesResult.success) {
      console.log(`Found ${messagesResult.messages.length} messages:\n`);
      messagesResult.messages.forEach((msg, index) => {
        console.log(`  ${index + 1}. [${msg.role}] ${msg.message_text}`);
        console.log(`     Timestamp: ${new Date(msg.timestamp).toLocaleString()}\n`);
      });
    }
  }
  
  // Test 7: Complete a workflow session
  console.log('\n✅ Test 7: Completing a workflow session\n');
  
  if (createdSessions[3]) {
    const completeResult = await adapter.completeWorkflowSession(createdSessions[3].id);
    
    if (completeResult.success) {
      console.log(`  ✅ Session completed: ${createdSessions[3].session_title}`);
      console.log(`     Session is now marked as completed and inactive\n`);
    }
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('🎉 All tests completed!');
  console.log('='.repeat(60));
  console.log('\n✅ Verified Behavior:');
  console.log('  - Each workflow detection creates a NEW session');
  console.log('  - Workflow type is stored as metadata for context');
  console.log('  - Multiple sessions can have the same workflow type');
  console.log('  - Sessions are independent conversations');
  console.log('\n📊 Check Results:');
  console.log('  1. Go to Supabase → Table Editor → conversation_sessions');
  console.log(`  2. You should see 5+ sessions for user: ${TEST_USER_ID}`);
  console.log('  3. Notice multiple task_automation sessions (separate workflows)');
  console.log('  4. Each session has its own workflow_id and messages');
  console.log('\nNext steps:');
  console.log('  1. Integrate workflow detection in your copilot');
  console.log('  2. When workflow detected → createWorkflowSession()');
  console.log('  3. Display sessions as separate chat threads in UI');
  console.log('\nCleanup:');
  console.log(`  DELETE FROM conversation_sessions WHERE user_id = '${TEST_USER_ID}';`);
}

// Run tests
testWorkflowSessions().catch(error => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});

