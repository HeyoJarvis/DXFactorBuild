#!/usr/bin/env node

/**
 * Direct Supabase Test - Bypasses cache to test real operations
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

async function testSupabase() {
  console.log('🧪 Testing Supabase with direct queries...\n');

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

  try {
    // Test 1: Count companies
    console.log('1️⃣  Counting companies...');
    const { data: companies, error: compError, count } = await supabase
      .from('companies')
      .select('*', { count: 'exact' });
    
    if (compError) throw compError;
    console.log(`   ✅ Found ${companies.length} companies\n`);

    // Test 2: Count sources
    console.log('2️⃣  Counting sources...');
    const { data: sources, error: srcError } = await supabase
      .from('sources')
      .select('*');
    
    if (srcError) throw srcError;
    console.log(`   ✅ Found ${sources.length} sources\n`);

    // Test 3: Try to create a test user
    console.log('3️⃣  Creating test user...');
    const { data: user, error: userError } = await supabase
      .from('users')
      .insert({
        email: 'test@example.com',
        name: 'Test User',
        user_role: 'analyst'
      })
      .select()
      .single();

    if (userError) {
      if (userError.code === '23505') {
        console.log('   ℹ️  Test user already exists (that\'s OK!)\n');
      } else {
        throw userError;
      }
    } else {
      console.log(`   ✅ Created user: ${user.email} (ID: ${user.id})\n`);
    }

    // Test 4: Query users
    console.log('4️⃣  Querying users...');
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, email, name, created_at')
      .limit(5);

    if (usersError) throw usersError;
    console.log(`   ✅ Found ${users.length} users:`);
    users.forEach(u => {
      console.log(`      • ${u.email} - ${u.name}`);
    });
    console.log('');

    // Test 5: Test SupabaseClient wrapper
    console.log('5️⃣  Testing SupabaseClient wrapper...');
    const SupabaseClient = require('./data/storage/supabase-client');
    const client = new SupabaseClient();
    
    const stats = await client.getStats();
    console.log('   ✅ Database stats:');
    console.log(`      • Users: ${stats.users || 0}`);
    console.log(`      • Teams: ${stats.teams || 0}`);
    console.log(`      • Signals: ${stats.signals || 0}`);
    console.log('');

    console.log('🎉 All tests passed! Your Supabase is fully operational.\n');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Details:', error);
    process.exit(1);
  }
}

testSupabase();

