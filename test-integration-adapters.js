#!/usr/bin/env node

/**
 * Test Integration Adapters
 * Verifies that Slack and CRM adapters work correctly
 */

require('dotenv').config();

async function testSlackAdapter() {
  console.log('\n🔵 Testing Slack Supabase Adapter...\n');
  
  const SlackAdapter = require('./delivery/slack/supabase-adapter');
  const adapter = new SlackAdapter();

  try {
    // Test 1: Get/Create User
    console.log('1️⃣  Testing user creation...');
    const mockSlackUser = {
      id: 'U12345TEST',
      real_name: 'Test User',
      profile: {
        email: 'test.integration@example.com',
        display_name: 'Test User',
        image_192: 'https://example.com/avatar.png',
        team: 'T12345'
      },
      tz: 'America/New_York',
      tz_offset: -18000
    };

    const user = await adapter.getOrCreateUser(mockSlackUser);
    console.log(`   ✅ User created: ${user.email} (ID: ${user.id})\n`);

    // Test 2: Get Sources for Testing
    console.log('2️⃣  Getting sources...');
    const sources = await adapter.supabase.getActiveSources();
    console.log(`   ✅ Found ${sources.length} sources\n`);

    if (sources.length === 0) {
      console.log('   ⚠️  No sources found. Skipping signal tests.\n');
      return { success: true, user };
    }

    // Test 3: Create and Track Signal
    console.log('3️⃣  Testing signal creation and tracking...');
    const testSignal = await adapter.supabase.createSignal({
      title: 'Integration Test Signal',
      summary: 'Testing Slack adapter integration',
      url: 'https://example.com/test',
      category: 'industry_trend',
      priority: 'low',
      published_at: new Date(),
      source_id: sources[0].id
    });
    console.log(`   ✅ Signal created: ${testSignal.id}\n`);

    // Test 4: Track Delivery
    console.log('4️⃣  Testing delivery tracking...');
    const delivery = await adapter.trackDelivery({
      signal_id: testSignal.id,
      user_id: user.id,
      channel: 'C12345',
      message_ts: '1234567890.123456',
      urgency: 'low',
      metadata: { test: true }
    });
    console.log(`   ✅ Delivery tracked: ${delivery?.id || 'success'}\n`);

    // Test 5: Record Feedback
    console.log('5️⃣  Testing feedback recording...');
    const feedback = await adapter.recordFeedback({
      user_id: user.id,
      signal_id: testSignal.id,
      feedback_type: 'explicit_rating',
      value: true,
      comment: 'Test feedback from integration',
      context: { test: true }
    });
    console.log(`   ✅ Feedback recorded: ${feedback.id}\n`);

    // Test 6: Mark as Read
    console.log('6️⃣  Testing mark as read...');
    await adapter.markSignalRead(testSignal.id, user.id);
    console.log(`   ✅ Signal marked as read\n`);

    // Cleanup
    console.log('7️⃣  Cleaning up test data...');
    await adapter.supabase.deleteSignal(testSignal.id);
    console.log(`   ✅ Test signal deleted\n`);

    console.log('🎉 Slack adapter tests passed!\n');
    return { success: true, user };

  } catch (error) {
    console.log(`❌ Slack adapter test failed: ${error.message}\n`);
    console.error(error);
    return { success: false, error };
  }
}

async function testCRMAdapter() {
  console.log('\n🟢 Testing CRM Supabase Adapter...\n');

  const CRMAdapter = require('./crm-integration/supabase-adapter');
  const adapter = new CRMAdapter();

  try {
    const orgId = 'test-org-123';

    // Test 1: Store Analysis
    console.log('1️⃣  Testing analysis storage...');
    const mockAnalysis = {
      organizationName: 'Test Company',
      urgency: 'medium',
      dealAnalysis: {
        totalValue: 50000,
        dealCount: 3
      },
      recommendations: [
        { type: 'follow_up', priority: 'high', description: 'Test recommendation' }
      ],
      intelligenceData: {
        entities: ['Company A', 'Product B'],
        keywords: ['AI', 'technology'],
        confidenceScore: 0.8
      }
    };

    const signal = await adapter.storeAnalysis(orgId, mockAnalysis);
    console.log(`   ✅ Analysis stored: ${signal.id}\n`);

    // Test 2: Get Analysis History
    console.log('2️⃣  Testing analysis history retrieval...');
    const history = await adapter.getAnalysisHistory(orgId);
    console.log(`   ✅ Found ${history.length} analysis records\n`);

    // Test 3: Store Alert
    console.log('3️⃣  Testing alert storage...');
    const mockAlert = {
      title: 'Test Alert',
      message: 'This is a test alert',
      type: 'opportunity',
      severity: 'high',
      context: {
        test: true,
        opportunity_value: 100000
      }
    };

    const alertSignal = await adapter.storeAlert(orgId, mockAlert);
    console.log(`   ✅ Alert stored: ${alertSignal.id}\n`);

    // Test 4: Get Recent Alerts
    console.log('4️⃣  Testing recent alerts retrieval...');
    const alerts = await adapter.getRecentAlerts(orgId);
    console.log(`   ✅ Found ${alerts.length} recent alerts\n`);

    // Test 5: Store Company Intelligence
    console.log('5️⃣  Testing company intelligence storage...');
    const mockCompany = {
      name: 'Test Intelligence Company',
      description: 'A test company for integration testing',
      website: 'https://testcompany.example.com',
      confidenceScore: 0.85,
      industries: ['Technology', 'AI'],
      keywords: ['artificial intelligence', 'machine learning']
    };

    const source = await adapter.storeCompanyIntelligence(mockCompany);
    console.log(`   ✅ Company intelligence stored: ${source.id}\n`);

    // Test 6: Recommendation Effectiveness
    console.log('6️⃣  Testing recommendation tracking...');
    const effectiveness = await adapter.getRecommendationEffectiveness(orgId);
    console.log(`   ✅ Effectiveness metrics retrieved: ${effectiveness.total_recommendations} total\n`);

    // Cleanup
    console.log('7️⃣  Cleaning up test data...');
    await adapter.supabase.deleteSignal(signal.id);
    await adapter.supabase.deleteSignal(alertSignal.id);
    console.log(`   ✅ Test data cleaned up\n`);

    console.log('🎉 CRM adapter tests passed!\n');
    return { success: true };

  } catch (error) {
    console.log(`❌ CRM adapter test failed: ${error.message}\n`);
    console.error(error);
    return { success: false, error };
  }
}

async function main() {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║                                                          ║');
  console.log('║        Integration Adapters Test Suite                   ║');
  console.log('║                                                          ║');
  console.log('╚══════════════════════════════════════════════════════════╝');

  const slackResult = await testSlackAdapter();
  const crmResult = await testCRMAdapter();

  console.log('='.repeat(60));
  console.log('\n📊 Test Summary\n');
  console.log(`   Slack Adapter: ${slackResult.success ? '✅ PASSED' : '❌ FAILED'}`);
  console.log(`   CRM Adapter:   ${crmResult.success ? '✅ PASSED' : '❌ FAILED'}`);
  console.log('');

  if (slackResult.success && crmResult.success) {
    console.log('🎉 All integration adapters are working!\n');
    console.log('✨ Your systems are ready to integrate with Supabase.\n');
    console.log('Next steps:');
    console.log('   1. Update delivery/slack/app.js to use the adapter');
    console.log('   2. Update crm-integration/intelligent-background-service.js');
    console.log('   3. See INTEGRATION_GUIDE.md for detailed instructions\n');
    process.exit(0);
  } else {
    console.log('⚠️  Some tests failed. Check errors above.\n');
    process.exit(1);
  }
}

main().catch(error => {
  console.error('\n❌ Test suite failed:', error);
  process.exit(1);
});

