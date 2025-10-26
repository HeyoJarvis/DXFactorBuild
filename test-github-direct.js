/**
 * Test GitHub Direct Connection
 * Verifies that GitHubService can connect and list repositories
 */

require('dotenv').config();
const GitHubService = require('./desktop2/main/services/GitHubService');
const winston = require('winston');

// Setup logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.colorize(),
    winston.format.simple()
  ),
  transports: [new winston.transports.Console()]
});

async function testGitHubConnection() {
  console.log('\n🧪 Testing GitHub Direct Connection...\n');

  // Check configuration
  console.log('📋 Configuration Check:');
  console.log('  GITHUB_APP_ID:', process.env.GITHUB_APP_ID ? '✅ Set' : '❌ Missing');
  console.log('  GITHUB_APP_INSTALLATION_ID:', process.env.GITHUB_APP_INSTALLATION_ID ? '✅ Set' : '❌ Missing');
  console.log('  GITHUB_APP_PRIVATE_KEY_PATH:', process.env.GITHUB_APP_PRIVATE_KEY_PATH ? '✅ Set' : '❌ Missing');
  console.log('  GITHUB_TOKEN:', process.env.GITHUB_TOKEN ? '✅ Set' : '❌ Missing');
  console.log('');

  // Create service
  const githubService = new GitHubService({ logger, supabaseAdapter: {} });

  // Check if configured
  const isConfigured = githubService.isConfigured();
  console.log('🔧 GitHub Configured:', isConfigured ? '✅ YES' : '❌ NO');
  
  if (!isConfigured) {
    console.log('\n❌ GitHub not configured. Please set up credentials in .env\n');
    process.exit(1);
  }

  console.log('');

  // Initialize
  console.log('🚀 Initializing GitHub service...');
  const initResult = await githubService.initialize();
  
  if (!initResult.success) {
    console.log('❌ Initialization failed:', initResult.error);
    process.exit(1);
  }
  
  console.log('✅ GitHub service initialized successfully!\n');

  // List repositories
  console.log('📚 Listing repositories...');
  const listResult = await githubService.listRepositories({ per_page: 10 });
  
  if (!listResult.success) {
    console.log('❌ Failed to list repositories:', listResult.error);
    process.exit(1);
  }

  console.log(`✅ Found ${listResult.count} repositories:\n`);
  
  listResult.repositories.forEach((repo, idx) => {
    console.log(`  ${idx + 1}. ${repo.full_name}`);
    console.log(`     ${repo.description || 'No description'}`);
    console.log(`     🌟 ${repo.stargazers_count} ⑂ ${repo.forks_count} 🔧 ${repo.language || 'N/A'}`);
    console.log('');
  });

  console.log('🎉 All tests passed! GitHub Direct Connection is working!\n');
}

testGitHubConnection().catch(error => {
  console.error('\n💥 Test failed:', error.message);
  console.error(error.stack);
  process.exit(1);
});


