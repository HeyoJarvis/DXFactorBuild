require('dotenv').config();
const { createAppAuth } = require("@octokit/auth-app");
const { Octokit } = require("@octokit/rest");
const fs = require('fs');

async function testGitHubApp() {
  console.log('🔍 Testing GitHub App authentication...\n');
  
  const privateKey = fs.readFileSync(process.env.GITHUB_APP_PRIVATE_KEY_PATH, 'utf8');
  
  const octokit = new Octokit({
    authStrategy: createAppAuth,
    auth: {
      appId: process.env.GITHUB_APP_ID,
      privateKey: privateKey,
      installationId: process.env.GITHUB_APP_INSTALLATION_ID,
    },
  });
  
  console.log('✅ Authentication successful!');
  
  // Test 2: Get installation info
  console.log('\n📦 Getting installation details...');
  const { data: installation } = await octokit.apps.getInstallation({
    installation_id: process.env.GITHUB_APP_INSTALLATION_ID
  });
  
  console.log(`   Account: ${installation.account.login}`);
  console.log(`   Type: ${installation.account.type}`);
  console.log(`   App: ${installation.app_slug}`);
  
  // Test 3: List repositories (CORRECT METHOD FOR GITHUB APPS)
  console.log('\n📚 Listing accessible repositories...');
  const { data: repos } = await octokit.apps.listReposAccessibleToInstallation({
    per_page: 10
  });
  
  console.log(`   Total repositories: ${repos.total_count}`);
  console.log(`   Showing first ${Math.min(5, repos.repositories.length)}:\n`);
  repos.repositories.slice(0, 5).forEach(repo => {
    console.log(`   - ${repo.full_name} ${repo.private ? '(private)' : '(public)'}`);
  });
  
  // Test 4: Show permissions
  console.log('\n🔐 Current Permissions:');
  const permissions = installation.permissions;
  Object.keys(permissions).forEach(key => {
    console.log(`   ${key}: ${permissions[key]}`);
  });
  
  // Test 5: Check rate limit
  console.log('\n⏱️  Checking rate limits...');
  const { data: rateLimit } = await octokit.rateLimit.get();
  console.log(`   Core API: ${rateLimit.resources.core.remaining}/${rateLimit.resources.core.limit}`);
  console.log(`   Search API: ${rateLimit.resources.search.remaining}/${rateLimit.resources.search.limit}`);
  
  console.log('\n🎉 GitHub App is working correctly!\n');
}

testGitHubApp().catch(error => {
  console.error('\n❌ Error:', error.message);
  console.error('Status:', error.status);
  
  if (error.status === 403) {
    console.error('\n💡 Troubleshooting:');
    console.error('   1. Check app permissions at: https://github.com/organizations/HeyoJarvis/settings/apps');
    console.error('   2. Verify app is installed at: https://github.com/organizations/HeyoJarvis/settings/installations');
    console.error('   3. Make sure Installation ID is correct in .env');
  } else if (error.status === 401) {
    console.error('\n💡 Troubleshooting:');
    console.error('   1. Verify GITHUB_APP_ID is correct');
    console.error('   2. Check private key file exists and is valid');
    console.error('   3. Confirm GITHUB_APP_INSTALLATION_ID is correct');
  }
  
  process.exit(1);
});