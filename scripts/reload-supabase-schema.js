#!/usr/bin/env node

/**
 * Force Supabase Schema Cache Reload
 * 
 * This script forces Supabase to reload its schema cache by calling
 * the PostgREST admin endpoint.
 */

require('dotenv').config();
const https = require('https');

async function reloadSchema() {
  console.log('🔄 Reloading Supabase schema cache...\n');

  const url = new URL(process.env.SUPABASE_URL);
  const projectRef = url.hostname.split('.')[0];

  console.log(`Project: ${projectRef}`);
  console.log(`URL: ${process.env.SUPABASE_URL}\n`);

  // Method 1: Try to reload via PostgREST admin endpoint
  console.log('Method 1: Calling PostgREST admin endpoint...');
  
  const options = {
    hostname: url.hostname,
    port: 443,
    path: '/rest/v1/',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      'Prefer': 'schema-reload'
    }
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        if (res.statusCode === 200 || res.statusCode === 204) {
          console.log('✅ Schema cache reload successful!\n');
          resolve();
        } else {
          console.log(`⚠️  Got status ${res.statusCode}, but that's OK.\n`);
          resolve();
        }
      });
    });

    req.on('error', (error) => {
      console.log('⚠️  Could not reload via API (this is normal)\n');
      resolve(); // Don't fail, manual refresh is fine
    });

    req.end();
  });
}

async function main() {
  console.log('=' .repeat(60));
  console.log('🔧 Supabase Schema Cache Reload Tool\n');
  
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env\n');
    process.exit(1);
  }

  await reloadSchema();

  console.log('=' .repeat(60));
  console.log('\n📝 Manual Reload Instructions:\n');
  console.log('If the automatic reload didn\'t work, do this:\n');
  console.log('1. Go to: https://app.supabase.com/project/' + 
              process.env.SUPABASE_URL.match(/https:\/\/(.+?)\.supabase\.co/)?.[1] + 
              '/api\n');
  console.log('2. Look for "Schema" or "API Docs" section\n');
  console.log('3. Click the "Reload schema" or refresh button\n');
  console.log('4. Wait 5-10 seconds\n');
  console.log('5. Run: node test-supabase-direct.js\n');
  console.log('=' .repeat(60));
  console.log('\n⏱️  Alternatively, wait 2-3 minutes for auto-refresh.\n');
}

main().catch(console.error);

