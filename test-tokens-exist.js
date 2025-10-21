#!/usr/bin/env node

/**
 * Quick Token Existence Check
 * Checks if integration tokens are actually saved in the database
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { createClient } = require('@supabase/supabase-js');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function checkTokens() {
  console.log('\n🔍 HeyJarvis Token Existence Checker\n');
  console.log('This script checks if your integration tokens are saved in the database.\n');

  // Check environment variables
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('❌ Error: Missing Supabase environment variables');
    console.error('   Make sure .env file exists with SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  console.log('✅ Connected to Supabase');
  console.log('📊 Database:', process.env.SUPABASE_URL);
  console.log('');

  // Ask for email
  const email = await question('Enter your email address: ');

  if (!email) {
    console.error('❌ Email required');
    process.exit(1);
  }

  console.log(`\n🔎 Looking up user: ${email}...\n`);

  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('id, email, name, integration_settings, created_at, last_login_at')
      .eq('email', email)
      .single();

    if (error || !user) {
      console.error('❌ User not found in database');
      console.error('   Error:', error?.message || 'User does not exist');
      rl.close();
      process.exit(1);
    }

    console.log('✅ User found!\n');
    console.log('═══════════════════════════════════════════════════');
    console.log('USER INFORMATION');
    console.log('═══════════════════════════════════════════════════');
    console.log(`ID:         ${user.id}`);
    console.log(`Email:      ${user.email}`);
    console.log(`Name:       ${user.name || 'N/A'}`);
    console.log(`Created:    ${user.created_at}`);
    console.log(`Last Login: ${user.last_login_at || 'Never'}`);
    console.log('');

    console.log('═══════════════════════════════════════════════════');
    console.log('INTEGRATION STATUS');
    console.log('═══════════════════════════════════════════════════');

    const integrations = user.integration_settings || {};

    // Check Microsoft
    console.log('\n🟦 MICROSOFT TEAMS / GRAPH');
    console.log('───────────────────────────────────────────────────');
    if (integrations.microsoft) {
      const ms = integrations.microsoft;
      console.log(`Status:         ${ms.authenticated ? '✅ Authenticated' : '❌ Not Authenticated'}`);
      console.log(`Account:        ${ms.account || 'N/A'}`);
      console.log(`Access Token:   ${ms.access_token ? '✅ EXISTS (' + ms.access_token.substring(0, 20) + '...)' : '❌ MISSING'}`);
      console.log(`Refresh Token:  ${ms.refresh_token ? '✅ EXISTS (' + ms.refresh_token.substring(0, 20) + '...)' : '❌ MISSING (MSAL may handle internally)'}`);
      console.log(`Token Expiry:   ${ms.token_expiry || 'N/A'}`);
      console.log(`Connected At:   ${ms.connected_at || 'N/A'}`);
      console.log(`Last Auth:      ${ms.last_authenticated_at || 'N/A'}`);

      // Check if token is expired
      if (ms.token_expiry) {
        const expiry = new Date(ms.token_expiry);
        const now = new Date();
        if (expiry < now) {
          console.log(`\n⚠️  WARNING: Access token EXPIRED at ${ms.token_expiry}`);
          console.log('   This token needs to be refreshed.');
        } else {
          const minutesLeft = Math.floor((expiry - now) / 1000 / 60);
          console.log(`\n✅ Token valid for ${minutesLeft} more minutes`);
        }
      }
    } else {
      console.log('❌ NOT CONFIGURED');
      console.log('   Microsoft has never been connected to this account.');
    }

    // Check Google
    console.log('\n\n🔴 GOOGLE WORKSPACE / GMAIL');
    console.log('───────────────────────────────────────────────────');
    if (integrations.google) {
      const g = integrations.google;
      console.log(`Status:         ${g.authenticated ? '✅ Authenticated' : '❌ Not Authenticated'}`);
      console.log(`Email:          ${g.email || 'N/A'}`);
      console.log(`Name:           ${g.name || 'N/A'}`);
      console.log(`Access Token:   ${g.access_token ? '✅ EXISTS (' + g.access_token.substring(0, 20) + '...)' : '❌ MISSING'}`);
      console.log(`Refresh Token:  ${g.refresh_token ? '✅ EXISTS (' + g.refresh_token.substring(0, 20) + '...)' : '❌ MISSING'}`);
      console.log(`Token Expiry:   ${g.token_expiry || 'N/A'}`);
      console.log(`Connected At:   ${g.connected_at || 'N/A'}`);
      console.log(`Last Auth:      ${g.last_authenticated_at || 'N/A'}`);

      // Check if token is expired
      if (g.token_expiry) {
        const expiry = new Date(g.token_expiry);
        const now = new Date();
        if (expiry < now) {
          console.log(`\n⚠️  WARNING: Access token EXPIRED at ${g.token_expiry}`);
          console.log('   This token needs to be refreshed.');
        } else {
          const minutesLeft = Math.floor((expiry - now) / 1000 / 60);
          console.log(`✅ Token valid for ${minutesLeft} more minutes`);
        }
      }
    } else {
      console.log('❌ NOT CONFIGURED');
      console.log('   Google has never been connected to this account.');
    }

    // Check JIRA
    console.log('\n\n🟦 JIRA / ATLASSIAN');
    console.log('───────────────────────────────────────────────────');
    if (integrations.jira) {
      const j = integrations.jira;
      console.log(`Status:         ${j.authenticated ? '✅ Authenticated' : '❌ Not Authenticated'}`);
      console.log(`Cloud ID:       ${j.cloud_id || 'N/A'}`);
      console.log(`Site URL:       ${j.site_url || 'N/A'}`);
      console.log(`Access Token:   ${j.access_token ? '✅ EXISTS (' + j.access_token.substring(0, 20) + '...)' : '❌ MISSING'}`);
      console.log(`Refresh Token:  ${j.refresh_token ? '✅ EXISTS (' + j.refresh_token.substring(0, 20) + '...)' : '❌ MISSING'}`);
      console.log(`Token Expiry:   ${j.token_expiry || 'N/A'}`);
      console.log(`Connected At:   ${j.connected_at || 'N/A'}`);
    } else {
      console.log('❌ NOT CONFIGURED');
      console.log('   JIRA has never been connected to this account.');
    }

    console.log('\n\n═══════════════════════════════════════════════════');
    console.log('DIAGNOSIS');
    console.log('═══════════════════════════════════════════════════\n');

    let hasIssues = false;

    // Diagnose issues
    if (integrations.microsoft?.authenticated && !integrations.microsoft?.access_token) {
      console.log('🔴 ISSUE: Microsoft marked as authenticated but no access token saved!');
      console.log('   → Tokens are not being saved to database after OAuth');
      hasIssues = true;
    }

    if (integrations.google?.authenticated && !integrations.google?.access_token) {
      console.log('🔴 ISSUE: Google marked as authenticated but no access token saved!');
      console.log('   → Tokens are not being saved to database after OAuth');
      hasIssues = true;
    }

    if (integrations.microsoft?.access_token) {
      const expiry = new Date(integrations.microsoft.token_expiry);
      if (expiry < new Date()) {
        console.log('🟡 WARNING: Microsoft token expired');
        console.log('   → Token should auto-refresh on next use');
        if (!integrations.microsoft.refresh_token) {
          console.log('   → No refresh token stored (MSAL manages internally)');
        }
      }
    }

    if (integrations.google?.access_token) {
      const expiry = new Date(integrations.google.token_expiry);
      if (expiry < new Date()) {
        console.log('🟡 WARNING: Google token expired');
        console.log('   → Token should auto-refresh on next use');
        if (!integrations.google.refresh_token) {
          console.log('   🔴 ISSUE: No refresh token! Cannot auto-refresh.');
          console.log('   → User will need to re-authenticate');
          hasIssues = true;
        }
      }
    }

    if (!hasIssues && (integrations.microsoft?.access_token || integrations.google?.access_token)) {
      console.log('✅ Tokens appear to be saved correctly in the database!');
      console.log('');
      console.log('If integrations still require re-auth, the issue is likely:');
      console.log('  1. Services not initializing on app start');
      console.log('  2. Connection check failing');
      console.log('  3. UI not detecting initialized services');
      console.log('');
      console.log('Run the app with console output to see initialization logs.');
    } else if (!integrations.microsoft && !integrations.google && !integrations.jira) {
      console.log('ℹ️  No integrations have been configured yet.');
      console.log('   Connect an integration in Settings to test persistence.');
    }

    console.log('\n═══════════════════════════════════════════════════\n');

  } catch (error) {
    console.error('❌ Error checking tokens:', error);
  }

  rl.close();
}

checkTokens().catch(console.error);
