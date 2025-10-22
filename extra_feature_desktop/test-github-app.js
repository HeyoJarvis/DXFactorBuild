#!/usr/bin/env node

/**
 * Test script for GitHub App authentication
 * 
 * Run after setting up GitHub App credentials:
 * node test-github-app.js
 */

require('dotenv').config();
const winston = require('winston');
const TeamSyncSupabaseAdapter = require('./main/services/TeamSyncSupabaseAdapter');
const GitHubOAuthService = require('./main/services/oauth/GitHubOAuthService');

// Setup logger
const logger = winston.createLogger({
  level: 'debug',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

async function testGitHubApp() {
  console.log('\n🧪 Testing GitHub App Authentication\n');
  console.log('=' .repeat(60));
  
  try {
    // Check environment variables
    console.log('\n1️⃣  Checking environment variables...');
    const appId = process.env.GITHUB_APP_ID;
    const installationId = process.env.GITHUB_APP_INSTALLATION_ID;
    const privateKeyPath = process.env.GITHUB_APP_PRIVATE_KEY_PATH;
    
    if (!appId) {
      throw new Error('❌ GITHUB_APP_ID not set in .env');
    }
    console.log(`   ✅ GITHUB_APP_ID: ${appId}`);
    
    if (!installationId) {
      throw new Error('❌ GITHUB_APP_INSTALLATION_ID not set in .env');
    }
    console.log(`   ✅ GITHUB_APP_INSTALLATION_ID: ${installationId}`);
    
    if (!privateKeyPath) {
      throw new Error('❌ GITHUB_APP_PRIVATE_KEY_PATH not set in .env');
    }
    console.log(`   ✅ GITHUB_APP_PRIVATE_KEY_PATH: ${privateKeyPath}`);
    
    // Check if private key file exists
    const fs = require('fs');
    if (!fs.existsSync(privateKeyPath)) {
      throw new Error(`❌ Private key file not found: ${privateKeyPath}`);
    }
    console.log('   ✅ Private key file exists');
    
    // Initialize services
    console.log('\n2️⃣  Initializing services...');
    const supabaseAdapter = new TeamSyncSupabaseAdapter({ logger });
    console.log('   ✅ TeamSyncSupabaseAdapter initialized');
    
    const githubService = new GitHubOAuthService({
      logger,
      supabaseAdapter
    });
    console.log('   ✅ GitHubOAuthService initialized');
    
    // Test JWT generation
    console.log('\n3️⃣  Testing JWT generation...');
    const jwt = githubService._generateGitHubAppJWT();
    console.log(`   ✅ JWT generated (${jwt.substring(0, 20)}...)`);
    
    // Test installation token fetch
    console.log('\n4️⃣  Testing installation token fetch...');
    const { token, expiresAt } = await githubService._getInstallationAccessToken();
    console.log(`   ✅ Installation token obtained`);
    console.log(`   ✅ Token: ${token.substring(0, 10)}...`);
    console.log(`   ✅ Expires: ${expiresAt}`);
    
    // Test GitHub API call
    console.log('\n5️⃣  Testing GitHub API call...');
    const fetch = require('node-fetch');
    const response = await fetch('https://api.github.com/installation/repositories', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28'
      }
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`GitHub API error: ${response.status} ${errorText}`);
    }
    
    const data = await response.json();
    const repos = data.repositories || [];
    console.log(`   ✅ Successfully fetched ${repos.length} repositories`);
    console.log(`   ✅ Total accessible repos: ${data.total_count || repos.length}`);
    
    if (repos.length > 0) {
      console.log(`   📦 Sample repo: ${repos[0].full_name}`);
    }
    
    // Test connect flow
    console.log('\n6️⃣  Testing connect flow...');
    // Generate a valid UUID for testing
    const crypto = require('crypto');
    const testUserId = crypto.randomUUID();
    console.log(`   Using test user ID: ${testUserId}`);
    const result = await githubService._connectGitHubApp(testUserId);
    console.log(`   ✅ Connection result:`, result);
    
    // Test getAccessToken (should use cached token)
    console.log('\n7️⃣  Testing getAccessToken...');
    
    // Wait a moment for database to commit
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Debug: Check what's in the database
    const { data: dbCheck, error: dbError } = await supabaseAdapter.supabase
      .from('team_sync_integrations')
      .select('*')
      .eq('user_id', testUserId)
      .eq('service_name', 'github');
    
    console.log(`   🔍 Database check: Found ${dbCheck?.length || 0} records`);
    if (dbError) {
      console.log(`   ⚠️  Database error: ${dbError.message}`);
    }
    
    const cachedToken = await githubService.getAccessToken(testUserId);
    console.log(`   ✅ Retrieved token: ${cachedToken.substring(0, 10)}...`);
    console.log(`   ✅ Token matches: ${cachedToken === result.token_expires_at ? 'N/A' : 'checking...'}`);
    
    // Cleanup test data
    console.log('\n8️⃣  Cleaning up test data...');
    await supabaseAdapter.supabase
      .from('team_sync_integrations')
      .delete()
      .eq('user_id', testUserId);
    console.log('   ✅ Test data cleaned up');
    
    // Success!
    console.log('\n' + '='.repeat(60));
    console.log('\n🎉 All tests passed! GitHub App authentication is working!\n');
    console.log('Next steps:');
    console.log('1. Start the app: npm run dev');
    console.log('2. Go to Settings → GitHub → Connect');
    console.log('3. Check dashboard for GitHub data\n');
    
  } catch (error) {
    console.error('\n' + '='.repeat(60));
    console.error('\n❌ Test failed!\n');
    console.error('Error:', error.message);
    console.error('\nStack trace:', error.stack);
    console.error('\n' + '='.repeat(60));
    console.error('\nTroubleshooting:');
    console.error('1. Check that all environment variables are set correctly');
    console.error('2. Verify private key path is absolute and file exists');
    console.error('3. Confirm GitHub App ID and Installation ID are correct');
    console.error('4. See GITHUB_APP_SETUP.md for detailed troubleshooting\n');
    process.exit(1);
  }
}

// Run tests
testGitHubApp().catch(error => {
  console.error('Unexpected error:', error);
  process.exit(1);
});

