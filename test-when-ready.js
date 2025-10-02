#!/usr/bin/env node

/**
 * Complete System Test - Run this once cache is refreshed
 */

require('dotenv').config();
const SupabaseClient = require('./data/storage/supabase-client');

async function testCompleteSystem() {
  console.log('\n🚀 Complete System Test\n');
  console.log('=' .repeat(60));

  try {
    // Initialize client
    console.log('\n1️⃣  Initializing Supabase client...');
    const client = new SupabaseClient();
    console.log('   ✅ Client initialized\n');

    // Test connection
    console.log('2️⃣  Testing database connection...');
    const connected = await client.testConnection();
    if (connected) {
      console.log('   ✅ Connection successful!\n');
    } else {
      throw new Error('Connection test failed');
    }

    // Get stats
    console.log('3️⃣  Fetching database statistics...');
    const stats = await client.getStats();
    console.log('   ✅ Stats retrieved:');
    console.log(`      • Users: ${stats.users || 0}`);
    console.log(`      • Teams: ${stats.teams || 0}`);
    console.log(`      • Signals: ${stats.signals || 0}`);
    console.log('');

    // Test source retrieval
    console.log('4️⃣  Testing source retrieval...');
    const sources = await client.getActiveSources();
    console.log(`   ✅ Found ${sources.length} active sources:`);
    sources.forEach(s => {
      console.log(`      • ${s.name} (${s.type})`);
    });
    console.log('');

    // Test creating a test signal
    console.log('5️⃣  Testing signal creation...');
    const testSignal = {
      title: 'Test Signal from System Test',
      summary: 'This is a test signal to verify database operations',
      content: 'Full content of the test signal',
      url: 'https://example.com/test-signal',
      category: 'industry_trend',
      priority: 'low',
      trust_level: 'unverified',
      published_at: new Date(),
      source_id: sources[0]?.id || null
    };

    const signal = await client.createSignal(testSignal);
    console.log('   ✅ Signal created:');
    console.log(`      • ID: ${signal.id}`);
    console.log(`      • Title: ${signal.title}`);
    console.log('');

    // Test signal query
    console.log('6️⃣  Testing signal query...');
    const recentSignals = await client.getSignals({}, { limit: 5 });
    console.log(`   ✅ Retrieved ${recentSignals.signals.length} recent signals\n`);

    // Test cleanup (delete test signal)
    console.log('7️⃣  Cleaning up test data...');
    await client.deleteSignal(signal.id);
    console.log('   ✅ Test signal deleted\n');

    // Success!
    console.log('=' .repeat(60));
    console.log('\n🎉 SUCCESS! All systems operational!\n');
    console.log('Your Supabase integration is working perfectly.\n');
    console.log('=' .repeat(60));
    console.log('\n📚 Next steps:\n');
    console.log('   • Run full demo: node demo.js');
    console.log('   • Start Slack bot: npm run dev:delivery');
    console.log('   • Start desktop app: npm run dev:desktop');
    console.log('   • Test CRM integration: node crm-integration/background-service.js\n');

    process.exit(0);

  } catch (error) {
    console.log('\n❌ Test failed:', error.message);
    console.log('\nDetails:', error);
    
    if (error.message && error.message.includes('schema cache')) {
      console.log('\n⚠️  Schema cache issue still present.\n');
      console.log('Please follow instructions in FIX_SUPABASE_CACHE.md\n');
    }
    
    process.exit(1);
  }
}

console.log('');
console.log('╔══════════════════════════════════════════════════════════╗');
console.log('║                                                          ║');
console.log('║              HeyJarvis System Test                       ║');
console.log('║         Complete Supabase Integration Check             ║');
console.log('║                                                          ║');
console.log('╚══════════════════════════════════════════════════════════╝');

testCompleteSystem();

