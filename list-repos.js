/**
 * Simple script to list accessible GitHub repositories
 * Run this first to find the correct repo name for testing
 */

require('dotenv').config();
const { Octokit } = require('@octokit/rest');
const { createAppAuth } = require('@octokit/auth-app');
const fs = require('fs');

async function listRepos() {
  try {
    console.log('🔍 Fetching repositories from GitHub App...\n');

    // Read private key
    const privateKey = fs.readFileSync(process.env.GITHUB_APP_PRIVATE_KEY_PATH, 'utf8');

    // Create authenticated Octokit instance
    const octokit = new Octokit({
      authStrategy: createAppAuth,
      auth: {
        appId: process.env.GITHUB_APP_ID,
        privateKey: privateKey,
        installationId: process.env.GITHUB_APP_INSTALLATION_ID,
      },
    });

    // List repositories
    const { data } = await octokit.rest.apps.listReposAccessibleToInstallation();

    if (data.repositories.length === 0) {
      console.log('❌ No repositories found!');
      console.log('\nPossible reasons:');
      console.log('1. GitHub App is not installed on any repositories');
      console.log('2. Installation ID is incorrect');
      console.log('3. App permissions don\'t include repository access');
      console.log('\nTo fix:');
      console.log('1. Go to: https://github.com/settings/installations');
      console.log('2. Find your "HeyJarvis" app');
      console.log('3. Configure which repositories it can access');
      return;
    }

    console.log(`✅ Found ${data.repositories.length} accessible repositories:\n`);

    data.repositories.forEach((repo, i) => {
      console.log(`${i + 1}. ${repo.full_name}`);
      console.log(`   Owner: ${repo.owner.login}`);
      console.log(`   Repo: ${repo.name}`);
      console.log(`   Branch: ${repo.default_branch}`);
      console.log(`   Private: ${repo.private ? 'Yes' : 'No'}`);
      console.log(`   URL: ${repo.html_url}`);
      console.log('');
    });

    // Suggest test configuration
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('💡 To test the code indexer with one of these repos:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const firstRepo = data.repositories[0];
    console.log('Option 1: Add to .env file:');
    console.log(`TEST_REPO_OWNER=${firstRepo.owner.login}`);
    console.log(`TEST_REPO_NAME=${firstRepo.name}`);

    console.log('\nOption 2: Run test with environment variables:');
    console.log(`TEST_REPO_OWNER=${firstRepo.owner.login} TEST_REPO_NAME=${firstRepo.name} node test-code-indexer.js`);

    console.log('\nOption 3: Edit test-code-indexer.js lines 72-75:');
    console.log(`const testRepo = {`);
    console.log(`  owner: '${firstRepo.owner.login}',`);
    console.log(`  repo: '${firstRepo.name}',`);
    console.log(`  branch: '${firstRepo.default_branch}'`);
    console.log(`};`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('\nDebug Info:');
    console.error('GITHUB_APP_ID:', process.env.GITHUB_APP_ID ? 'Set ✓' : 'Missing ✗');
    console.error('GITHUB_APP_INSTALLATION_ID:', process.env.GITHUB_APP_INSTALLATION_ID ? 'Set ✓' : 'Missing ✗');
    console.error('GITHUB_APP_PRIVATE_KEY_PATH:', process.env.GITHUB_APP_PRIVATE_KEY_PATH ? 'Set ✓' : 'Missing ✗');
    
    if (process.env.GITHUB_APP_PRIVATE_KEY_PATH) {
      const keyExists = fs.existsSync(process.env.GITHUB_APP_PRIVATE_KEY_PATH);
      console.error('Private key file exists:', keyExists ? 'Yes ✓' : 'No ✗');
    }
  }
}

listRepos();

