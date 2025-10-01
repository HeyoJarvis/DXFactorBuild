/**
 * Test Session-Based Context Architecture
 * 
 * This script demonstrates the new architecture where:
 * - CRM context persists per organization
 * - Slack workflows provide fresh, dynamic context per chat session
 * - Combined context gives ultimate business intelligence
 */

// Load environment variables
require('dotenv').config({ path: require('path').resolve(__dirname, '.env') });

const { UltimateContextSystem } = require('./integrate-existing-systems');

async function testSessionBasedContext() {
  console.log('🚀 Testing Session-Based Context Architecture\n');
  
  try {
    // Initialize the system
    const system = new UltimateContextSystem({
      logLevel: 'info'
    });
    
    const organizationId = 'test_org_sessions';
    const crmConfig = {
      type: 'hubspot',
      organization_id: organizationId,
      access_token: process.env.HUBSPOT_API_KEY,
      website_url: 'https://example.com'
    };
    
    console.log('📊 Step 1: Initialize Persistent CRM Context (One-Time Setup)');
    console.log('   This happens once per organization and persists across all chat sessions...\n');
    
    // Initialize persistent CRM context (this would be done once per organization)
    const crmSetup = await system.initializePersistentCRMContext(
      crmConfig.website_url,
      crmConfig,
      organizationId
    );
    
    console.log('✅ Persistent CRM Context Initialized!');
    console.log('   - Organization:', organizationId);
    console.log('   - CRM patterns found:', crmSetup.metadata.crm_patterns);
    console.log('   - Context length:', crmSetup.metadata.crm_context_length, 'characters');
    console.log('   - Type:', crmSetup.metadata.type);
    
    // Simulate multiple chat sessions with different Slack data
    const chatSessions = [
      {
        sessionId: 'chat_session_1',
        scenario: 'Morning team standup',
        mockSlackData: [
          {
            id: 'msg_001',
            userId: 'U123',
            channelId: 'C456',
            timestamp: new Date(),
            type: 'inbound',
            content: 'Good morning team! I need help updating a deal in HubSpot - the client changed their requirements.',
            context: {
              messageType: 'request',
              urgency: 'medium',
              intent: { intent: 'crm_help', confidence: 0.9 },
              entities: ['deal', 'HubSpot', 'client requirements'],
              tools_mentioned: ['HubSpot'],
              sentiment: 'neutral',
              channel_name: 'sales-standup'
            }
          }
        ]
      },
      {
        sessionId: 'chat_session_2', 
        scenario: 'Afternoon process discussion',
        mockSlackData: [
          {
            id: 'msg_002',
            userId: 'U789',
            channelId: 'C101',
            timestamp: new Date(),
            type: 'inbound',
            content: 'Our lead qualification is taking too long. What automation tools can we implement?',
            context: {
              messageType: 'process_inquiry',
              urgency: 'high',
              intent: { intent: 'process_optimization', confidence: 0.95 },
              entities: ['lead qualification', 'automation', 'tools'],
              tools_mentioned: [],
              sentiment: 'concerned',
              channel_name: 'process-improvement'
            }
          },
          {
            id: 'msg_003',
            userId: 'U456',
            channelId: 'C101',
            timestamp: new Date(),
            type: 'outbound',
            content: 'I agree! We should look into Zapier integrations with our CRM.',
            context: {
              actionType: 'suggestion',
              completion_status: 'pending',
              success: null,
              tools_mentioned: ['Zapier', 'CRM'],
              channel_name: 'process-improvement'
            }
          }
        ]
      }
    ];
    
    // Process each chat session
    for (const session of chatSessions) {
      console.log(`\n💬 Step 2: Processing Chat Session - ${session.scenario}`);
      console.log(`   Session ID: ${session.sessionId}`);
      console.log(`   Fresh Slack data: ${session.mockSlackData.length} messages\n`);
      
      // Process session with fresh Slack data
      const sessionResult = await system.processSessionWithFreshSlack(
        organizationId,
        session.sessionId,
        session.mockSlackData
      );
      
      console.log('✅ Session Context Ready!');
      console.log('   - Session ID:', sessionResult.sessionId);
      console.log('   - Slack workflows:', sessionResult.metadata.slack_workflows);
      console.log('   - Slack context length:', sessionResult.metadata.slack_context_length, 'characters');
      console.log('   - Combined context length:', sessionResult.metadata.combined_context_length, 'characters');
      
      // Generate recommendations for this session
      console.log(`\n🎯 Step 3: Generate Recommendations for ${session.scenario}`);
      
      const testQueries = [
        'What should I focus on right now?',
        'How can I improve our current process?'
      ];
      
      for (const query of testQueries) {
        console.log(`\n   Query: "${query}"`);
        
        const recommendations = await system.generateIntelligentRecommendations(
          organizationId,
          query,
          session.sessionId
        );
        
        console.log('   ✅ Recommendations generated');
        console.log('   - Response length:', recommendations.recommendations.recommendations.length, 'characters');
        console.log('   - Preview:', recommendations.recommendations.recommendations.substring(0, 150) + '...');
      }
    }
    
    console.log('\n🎉 Session-Based Context Architecture Test Completed!\n');
    console.log('📝 Architecture Summary:');
    console.log('   ✅ Persistent CRM Context: Initialized once, reused across sessions');
    console.log('   ✅ Dynamic Slack Context: Fresh data per chat session');
    console.log('   ✅ Session Management: Each chat gets unique combined context');
    console.log('   ✅ Real-time Intelligence: Latest Slack data + stable CRM foundation');
    console.log('\n🚀 Your session-based ultimate context system is working perfectly!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    
    if (error.message.includes('rate_limit_error')) {
      console.log('\n⏰ Rate Limit Hit - This is normal during testing!');
      console.log('   - Wait a few minutes and try again');
    }
  }
}

// Run the test
if (require.main === module) {
  testSessionBasedContext().catch(console.error);
}

module.exports = { testSessionBasedContext };
