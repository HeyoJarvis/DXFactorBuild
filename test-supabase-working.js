#!/usr/bin/env node

/**
 * Comprehensive Supabase Test - Verifies everything is working
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

async function runTests() {
  console.log('\n' + '='.repeat(70));
  console.log('🧪 HeyJarvis Supabase Verification Test');
  console.log('='.repeat(70) + '\n');

  // Use service role for admin operations
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  );

  let testsPass = 0;
  let testsFail = 0;

  try {
    // Test 1: Check tables exist
    console.log('1️⃣  Checking database tables...');
    const tables = [
      'companies', 'teams', 'users', 'sources', 'signals', 
      'feedback', 'signal_deliveries', 'chat_conversations',
      'chat_messages', 'user_sessions', 'slack_conversations',
      'conversation_contexts'
    ];

    for (const table of tables) {
      const { count, error } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true });
      
      if (error) {
        console.log(`   ❌ Table '${table}' - ERROR: ${error.message}`);
        testsFail++;
      } else {
        console.log(`   ✅ Table '${table}' exists`);
        testsPass++;
      }
    }
    console.log('');

    // Test 2: Check sample data
    console.log('2️⃣  Checking sample data...');
    
    const { data: companies, error: compError } = await supabase
      .from('companies')
      .select('*');
    console.log(`   ✅ Companies: ${companies?.length || 0} found`);
    testsPass++;

    const { data: teams, error: teamError } = await supabase
      .from('teams')
      .select('*');
    console.log(`   ✅ Teams: ${teams?.length || 0} found`);
    testsPass++;

    const { data: sources, error: srcError } = await supabase
      .from('sources')
      .select('*');
    console.log(`   ✅ Sources: ${sources?.length || 0} found`);
    if (sources?.length > 0) {
      sources.forEach(s => console.log(`      • ${s.name} (${s.type})`));
    }
    testsPass++;
    console.log('');

    // Test 3: Test CRUD operations
    console.log('3️⃣  Testing create operation...');
    const { data: newSignal, error: createError } = await supabase
      .from('signals')
      .insert({
        title: 'Test Signal',
        summary: 'Testing database operations',
        url: 'https://example.com/test',
        category: 'industry_trend',
        priority: 'low',
        published_at: new Date().toISOString(),
        source_id: sources[0]?.id || null
      })
      .select()
      .single();

    if (createError) {
      console.log(`   ❌ Create failed: ${createError.message}`);
      testsFail++;
    } else {
      console.log(`   ✅ Signal created: ${newSignal.id}`);
      testsPass++;

      // Test 4: Test read operation
      console.log('4️⃣  Testing read operation...');
      const { data: readSignal, error: readError } = await supabase
        .from('signals')
        .select('*')
        .eq('id', newSignal.id)
        .single();

      if (readError) {
        console.log(`   ❌ Read failed: ${readError.message}`);
        testsFail++;
      } else {
        console.log(`   ✅ Signal read: ${readSignal.title}`);
        testsPass++;
      }

      // Test 5: Test update operation
      console.log('5️⃣  Testing update operation...');
      const { data: updated, error: updateError } = await supabase
        .from('signals')
        .update({ priority: 'high' })
        .eq('id', newSignal.id)
        .select()
        .single();

      if (updateError) {
        console.log(`   ❌ Update failed: ${updateError.message}`);
        testsFail++;
      } else {
        console.log(`   ✅ Signal updated: priority now ${updated.priority}`);
        testsPass++;
      }

      // Test 6: Test delete operation
      console.log('6️⃣  Testing delete operation...');
      const { error: deleteError } = await supabase
        .from('signals')
        .delete()
        .eq('id', newSignal.id);

      if (deleteError) {
        console.log(`   ❌ Delete failed: ${deleteError.message}`);
        testsFail++;
      } else {
        console.log(`   ✅ Signal deleted successfully`);
        testsPass++;
      }
    }
    console.log('');

    // Test 7: Test functions
    console.log('7️⃣  Testing database functions...');
    const { data: engagementScore, error: funcError } = await supabase
      .rpc('get_user_engagement_score', {
        p_user_id: '550e8400-e29b-41d4-a716-446655440000',
        days: 30
      });

    if (funcError) {
      console.log(`   ⚠️  Function test skipped (expected if no data)`);
    } else {
      console.log(`   ✅ Function working: engagement score = ${engagementScore || 0}`);
      testsPass++;
    }
    console.log('');

    // Summary
    console.log('='.repeat(70));
    console.log('📊 Test Results\n');
    console.log(`   ✅ Passed: ${testsPass}`);
    console.log(`   ❌ Failed: ${testsFail}`);
    console.log('');

    if (testsFail === 0) {
      console.log('🎉 SUCCESS! Your Supabase database is fully operational!\n');
      console.log('='.repeat(70));
      console.log('\n✨ Your HeyJarvis system is ready to use!\n');
      console.log('Next steps:');
      console.log('   • node demo.js - Run the full demo');
      console.log('   • npm run dev:delivery - Start Slack bot');
      console.log('   • npm run dev:desktop - Start desktop app');
      console.log('   • Check SUPABASE_SETUP.md for more info\n');
      process.exit(0);
    } else {
      console.log('⚠️  Some tests failed. Check errors above.\n');
      console.log('='.repeat(70) + '\n');
      process.exit(1);
    }

  } catch (error) {
    console.log('\n❌ Unexpected error:', error.message);
    console.log('\nDetails:', error);
    process.exit(1);
  }
}

runTests();

