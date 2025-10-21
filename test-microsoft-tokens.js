#!/usr/bin/env node

/**
 * Microsoft Token Debug Script
 * Checks Microsoft token state and tests initialization
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { createClient } = require('@supabase/supabase-js');

async function checkMicrosoftTokens() {
  console.log('\n🔍 Microsoft Token Debug Tool\n');

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  // Get user by email
  const email = 'avi@heyjarvis.ai'; // Change if needed

  const { data: user, error } = await supabase
    .from('users')
    .select('id, email, integration_settings')
    .eq('email', email)
    .single();

  if (error || !user) {
    console.error('❌ User not found:', error?.message);
    process.exit(1);
  }

  console.log('✅ User found:', user.email);
  console.log('User ID:', user.id);
  console.log('\n═══════════════════════════════════════════════════\n');

  const microsoft = user.integration_settings?.microsoft;

  if (!microsoft) {
    console.log('❌ NO MICROSOFT INTEGRATION SETTINGS FOUND');
    console.log('   Microsoft has never been connected to this account.');
    console.log('\n   To fix:');
    console.log('   1. Open HeyJarvis Settings');
    console.log('   2. Click "Connect" for Microsoft Teams');
    console.log('   3. Complete the OAuth flow');
    console.log('\n');
    process.exit(0);
  }

  console.log('🔵 MICROSOFT INTEGRATION SETTINGS:\n');
  console.log('authenticated:', microsoft.authenticated);
  console.log('account:', microsoft.account);
  console.log('');

  // Check access token
  if (microsoft.access_token) {
    console.log('✅ access_token: EXISTS');
    console.log('   Length:', microsoft.access_token.length, 'chars');
    console.log('   Preview:', microsoft.access_token.substring(0, 50) + '...');
  } else {
    console.log('❌ access_token: MISSING');
  }
  console.log('');

  // Check refresh token
  if (microsoft.refresh_token) {
    console.log('✅ refresh_token: EXISTS');
    console.log('   Length:', microsoft.refresh_token.length, 'chars');
    console.log('   Preview:', microsoft.refresh_token.substring(0, 50) + '...');
  } else {
    console.log('⚠️  refresh_token: MISSING (MSAL handles internally)');
  }
  console.log('');

  // Check expiry
  console.log('Token expiry:', microsoft.token_expiry || microsoft.expires_on || 'NOT SET');
  if (microsoft.token_expiry || microsoft.expires_on) {
    const expiry = new Date(microsoft.token_expiry || microsoft.expires_on);
    const now = new Date();
    const diff = expiry - now;
    const minutes = Math.floor(diff / 1000 / 60);

    console.log('Current time:', now.toISOString());
    console.log('Expires at:', expiry.toISOString());

    if (diff > 0) {
      console.log(`✅ Token valid for ${minutes} more minutes`);
    } else {
      console.log(`❌ Token EXPIRED ${Math.abs(minutes)} minutes ago!`);
      console.log('\n   This is why authentication is failing.');
      console.log('   Solution: Re-authenticate in Settings.');
    }
  }
  console.log('');

  console.log('connected_at:', microsoft.connected_at || 'NOT SET');
  console.log('last_authenticated_at:', microsoft.last_authenticated_at || 'NOT SET');

  console.log('\n═══════════════════════════════════════════════════');
  console.log('INITIALIZATION CHECK');
  console.log('═══════════════════════════════════════════════════\n');

  // Check what the auto-init logic will see
  const hasAccessToken = !!microsoft.access_token;
  const isAuthenticated = microsoft.authenticated === true;

  console.log('Checks for auto-initialization:');
  console.log('  - Has access_token?', hasAccessToken ? '✅' : '❌');
  console.log('  - authenticated === true?', isAuthenticated ? '✅' : '❌');
  console.log('');

  if (hasAccessToken) {
    console.log('✅ AUTO-INITIALIZATION SHOULD WORK');
    console.log('   The app should initialize Microsoft on startup.');
    console.log('');

    if (!isAuthenticated) {
      console.log('⚠️  WARNING: Has token but authenticated !== true');
      console.log('   This might cause issues in some code paths.');
    }

    // Check if token is expired
    if (microsoft.token_expiry || microsoft.expires_on) {
      const expiry = new Date(microsoft.token_expiry || microsoft.expires_on);
      const now = new Date();

      if (expiry < now) {
        console.log('\n❌ ISSUE FOUND: Token is expired!');
        console.log('   Even though tokens exist in DB, they\'re expired.');
        console.log('   MSAL should refresh them automatically, but if');
        console.log('   there\'s no refresh token, re-auth is required.');
        console.log('');
        console.log('   Steps to fix:');
        console.log('   1. Open Settings');
        console.log('   2. Click "Connect" for Microsoft Teams again');
        console.log('   3. Complete OAuth (should be quick)');
      }
    }
  } else {
    console.log('❌ AUTO-INITIALIZATION WILL NOT WORK');
    console.log('   No access_token found in database.');
    console.log('');
    console.log('   This means tokens were never saved properly.');
    console.log('   When you authenticated, the save operation failed.');
    console.log('');
    console.log('   Steps to fix:');
    console.log('   1. Check the logs during authentication');
    console.log('   2. Look for "💾 Saving Microsoft tokens to database"');
    console.log('   3. Check if there are any database errors');
    console.log('   4. Try re-authenticating');
  }

  console.log('\n═══════════════════════════════════════════════════');
  console.log('RAW JSON');
  console.log('═══════════════════════════════════════════════════\n');

  console.log(JSON.stringify(microsoft, null, 2));
  console.log('\n');
}

checkMicrosoftTokens().catch(console.error);
