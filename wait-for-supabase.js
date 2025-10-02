#!/usr/bin/env node

/**
 * Wait for Supabase Cache to Refresh
 * Polls the database until the cache is ready
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const MAX_ATTEMPTS = 40; // 40 attempts = ~2 minutes
const RETRY_DELAY = 3000; // 3 seconds

async function checkCache() {
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  try {
    const { data, error } = await supabase
      .from('companies')
      .select('count')
      .limit(1);

    if (error) {
      if (error.code === 'PGRST205') {
        return { ready: false, error: 'Cache not refreshed yet' };
      }
      return { ready: false, error: error.message };
    }

    return { ready: true, error: null };
  } catch (err) {
    return { ready: false, error: err.message };
  }
}

async function waitForCache() {
  console.log('\n⏳ Waiting for Supabase cache to refresh...\n');
  console.log('This usually takes 30 seconds to 2 minutes.\n');
  console.log('=' .repeat(60));

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    process.stdout.write(`\r🔄 Attempt ${attempt}/${MAX_ATTEMPTS}... `);

    const result = await checkCache();

    if (result.ready) {
      console.log('\n\n' + '=' .repeat(60));
      console.log('✅ Cache is ready! Database is accessible.\n');
      console.log('🚀 Running complete system test...\n');
      console.log('=' .repeat(60));
      
      // Run the complete test
      const SupabaseClient = require('./data/storage/supabase-client');
      const client = new SupabaseClient();
      
      try {
        const stats = await client.getStats();
        console.log('\n✅ Database Stats:');
        console.log(`   • Users: ${stats.users || 0}`);
        console.log(`   • Teams: ${stats.teams || 0}`);
        console.log(`   • Signals: ${stats.signals || 0}`);
        
        const sources = await client.getActiveSources();
        console.log(`   • Active Sources: ${sources.length}`);
        
        console.log('\n🎉 SUCCESS! Your Supabase is fully operational!\n');
        console.log('=' .repeat(60));
        console.log('\n📚 Ready to use:\n');
        console.log('   ✅ node demo.js - Run full demo');
        console.log('   ✅ npm run dev:delivery - Start Slack bot');
        console.log('   ✅ npm run dev:desktop - Start desktop app');
        console.log('   ✅ node test-when-ready.js - Full system test\n');
        
        return true;
      } catch (err) {
        console.log('\n⚠️  Cache ready but encountered:', err.message);
        console.log('Try running: node test-when-ready.js\n');
        return true;
      }
    }

    // Wait before next attempt
    if (attempt < MAX_ATTEMPTS) {
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
    }
  }

  console.log('\n\n' + '=' .repeat(60));
  console.log('⏰ Timeout reached. Cache taking longer than expected.\n');
  console.log('📝 Manual action required:\n');
  console.log('1. Go to: https://app.supabase.com/project/ydbujcuddfgiubjjajuq/api');
  console.log('2. Click "Reload schema" button (top-right)');
  console.log('3. Wait 10 seconds');
  console.log('4. Run: node test-when-ready.js\n');
  console.log('OR just wait another minute and run this script again.\n');
  console.log('See FIX_SUPABASE_CACHE.md for detailed instructions.\n');
  
  return false;
}

async function main() {
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║                                                          ║');
  console.log('║        Supabase Cache Refresh Monitor                    ║');
  console.log('║                                                          ║');
  console.log('╚══════════════════════════════════════════════════════════╝');

  const success = await waitForCache();
  process.exit(success ? 0 : 1);
}

main();

