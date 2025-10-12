/**
 * Test GitHub App Connection
 * Verifies that GitHub App credentials are working
 */

require('dotenv').config();
const fs = require('fs');

async function testConnection() {
  console.log('🔍 Testing GitHub App Connection\n');

  // Check environment variables
  console.log('📋 Environment Variables:');
  console.log('  GITHUB_APP_ID:', process.env.GITHUB_APP_ID || '❌ NOT SET');
  console.log('  GITHUB_APP_INSTALLATION_ID:', process.env.GITHUB_APP_INSTALLATION_ID || '❌ NOT SET');
  console.log('  GITHUB_APP_PRIVATE_KEY_PATH:', process.env.GITHUB_APP_PRIVATE_KEY_PATH || '❌ NOT SET');
  console.log();

  // Check if private key file exists
  if (process.env.GITHUB_APP_PRIVATE_KEY_PATH) {
    const keyPath = process.env.GITHUB_APP_PRIVATE_KEY_PATH;
    console.log('🔐 Checking private key file...');
    console.log('  Path:', keyPath);
    
    if (fs.existsSync(keyPath)) {
      console.log('  ✅ File exists');
      const keyContent = fs.readFileSync(keyPath, 'utf8');
      console.log('  Size:', keyContent.length, 'bytes');
      console.log('  Starts with:', keyContent.substring(0, 30) + '...');
    } else {
      console.log('  ❌ File NOT found!');
      return;
    }
  } else {
    console.log('❌ GITHUB_APP_PRIVATE_KEY_PATH not set');
    return;
  }
  console.log();

  // Test GitHub API connection
  console.log('🌐 Testing GitHub API connection...');
  try {
    const { createAppAuth } = await import('@octokit/auth-app');
    const { Octokit } = await import('@octokit/rest');

    const privateKey = fs.readFileSync(process.env.GITHUB_APP_PRIVATE_KEY_PATH, 'utf8');

    const octokit = new Octokit({
      authStrategy: createAppAuth,
      auth: {
        appId: process.env.GITHUB_APP_ID,
        privateKey: privateKey,
        installationId: process.env.GITHUB_APP_INSTALLATION_ID,
      },
    });

    console.log('  ✅ Octokit initialized');

    // Test authentication
    console.log('  Testing authentication...');
    const { data } = await octokit.rateLimit.get();
    console.log('  ✅ Authentication successful!');
    console.log('  Rate limit:', data.rate.limit);
    console.log('  Remaining:', data.rate.remaining);

    // Get accessible repositories
    console.log('\n📦 Testing repository access...');
    const { data: repos } = await octokit.apps.listReposAccessibleToInstallation();
    console.log('  ✅ Can access', repos.total_count, 'repositories:');
    repos.repositories.forEach((repo, i) => {
      console.log(`    ${i + 1}. ${repo.full_name}`);
    });

    console.log('\n✅ GitHub App connection is working perfectly!');
    console.log('\nIf the desktop app still shows "not connected", the issue is in the health check logic.');

  } catch (error) {
    console.error('\n❌ Connection failed:', error.message);
    console.error('\nFull error:', error);
  }
}

testConnection().catch(console.error);

