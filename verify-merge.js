#!/usr/bin/env node
/**
 * Verify Merge - Check that all features are present
 * Run with: node verify-merge.js
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Verifying Feature/GithubCopilot → main merge...\n');

const checks = {
  passed: 0,
  failed: 0,
  warnings: 0
};

function check(name, condition, errorMsg = '') {
  if (condition) {
    console.log(`✅ ${name}`);
    checks.passed++;
    return true;
  } else {
    console.log(`❌ ${name}${errorMsg ? ': ' + errorMsg : ''}`);
    checks.failed++;
    return false;
  }
}

function warn(name, message) {
  console.log(`⚠️  ${name}: ${message}`);
  checks.warnings++;
}

console.log('📦 Checking Files...\n');

// Check JIRA files
check('JIRA Service', fs.existsSync('./core/integrations/jira-service.js'));
check('JIRA Adapter', fs.existsSync('./core/integrations/jira-adapter.js'));
check('JIRA OAuth Handler', fs.existsSync('./oauth/jira-oauth-handler.js'));
check('JIRA API Endpoint', fs.existsSync('./api/jira/sync.js'));

console.log();

// Check Google files
check('Google OAuth Handler', fs.existsSync('./oauth/google-oauth-handler.js'));
check('Google Gmail Service', fs.existsSync('./core/integrations/google-gmail-service.js'));

console.log();

// Check Engineering Intelligence files
check('Engineering Intelligence Service', fs.existsSync('./core/intelligence/engineering-intelligence-service.js'));
check('Code Indexer', fs.existsSync('./core/intelligence/code-indexer.js'));
check('GitHub Actions Service', fs.existsSync('./core/integrations/github-actions-service.js'));

console.log('\n🔧 Checking Code Integration...\n');

// Check desktop/main.js has all handlers
const mainJs = fs.readFileSync('./desktop/main.js', 'utf8');
check('Google OAuth Handler Import', mainJs.includes('const GoogleOAuthHandler'));
check('JIRA OAuth Handler Import', mainJs.includes('const JIRAOAuthHandler'));
check('Engineering Intelligence Import', mainJs.includes('const EngineeringIntelligenceService'));
check('Google Handler Variable', mainJs.includes('let googleOAuthHandler'));
check('JIRA Handler Variable', mainJs.includes('let jiraOAuthHandler'));
check('Engineering Intelligence Variable', mainJs.includes('let engineeringIntelligence'));
check('Google IPC Handlers Function', mainJs.includes('setupGoogleIPCHandlers'));
check('JIRA IPC Handlers', mainJs.includes("ipcMain.handle('jira:authenticate'"));
check('Google IPC Handlers', mainJs.includes("ipcMain.handle('google:authenticate'"));

console.log();

// Check preload bridge
const preloadJs = fs.readFileSync('./desktop/bridge/copilot-preload.js', 'utf8');
check('Google API in Preload', preloadJs.includes('google: {'));
check('JIRA API in Preload', preloadJs.includes('jira: {'));
check('Engineering API in Preload', preloadJs.includes('engineering: {'));

console.log();

// Check unified.html
const unifiedHtml = fs.readFileSync('./desktop/renderer/unified.html', 'utf8');
check('Google Button in UI', unifiedHtml.includes('id="googleAuthBtn"'));
check('JIRA Button in UI', unifiedHtml.includes('id="jiraAuthBtn"'));
check('GitHub Button in UI', unifiedHtml.includes('id="githubAuthBtn"'));
check('Microsoft Button in UI', unifiedHtml.includes('id="msAuthBtn"'));

console.log('\n🌍 Checking Environment Variables...\n');

// Check .env file
if (fs.existsSync('.env')) {
  const envContent = fs.readFileSync('.env', 'utf8');
  
  // Google
  const hasGoogleId = envContent.includes('GOOGLE_CLIENT_ID');
  const hasGoogleSecret = envContent.includes('GOOGLE_CLIENT_SECRET');
  if (hasGoogleId && hasGoogleSecret) {
    console.log('✅ Google credentials configured');
  } else {
    warn('Google credentials', 'Not fully configured (optional)');
  }
  
  // JIRA
  const hasJiraId = envContent.includes('JIRA_CLIENT_ID');
  const hasJiraSecret = envContent.includes('JIRA_CLIENT_SECRET');
  if (hasJiraId && hasJiraSecret) {
    console.log('✅ JIRA credentials configured');
  } else {
    warn('JIRA credentials', 'Not fully configured (optional for non-developers)');
  }
  
  // GitHub
  const hasGitHubApp = envContent.includes('GITHUB_APP_ID');
  const hasGitHubInstall = envContent.includes('GITHUB_APP_INSTALLATION_ID');
  const hasGitHubKey = envContent.includes('GITHUB_APP_PRIVATE_KEY');
  if (hasGitHubApp && hasGitHubInstall && hasGitHubKey) {
    console.log('✅ GitHub App credentials configured');
  } else {
    warn('GitHub credentials', 'Not fully configured (optional for non-developers)');
  }
} else {
  warn('.env file', 'Not found - create from .env.example');
}

console.log('\n📊 Checking Database Schema...\n');

// Check migrations
check('User Role Migration', fs.existsSync('./data/migrations/add-user-role.sql'));
check('Code Vector Store Migration', fs.existsSync('./data/migrations/create-code-vector-store.sql'));

console.log('\n' + '='.repeat(60));
console.log('📈 VERIFICATION SUMMARY');
console.log('='.repeat(60));
console.log(`✅ Passed:   ${checks.passed}`);
console.log(`❌ Failed:   ${checks.failed}`);
console.log(`⚠️  Warnings: ${checks.warnings}`);
console.log('='.repeat(60));

if (checks.failed === 0) {
  console.log('\n🎉 All critical checks passed!');
  console.log('✨ The merge preserved all features from both branches.');
  console.log('\n📝 Next steps:');
  console.log('   1. Review MERGE_SUMMARY.md for details');
  console.log('   2. Test the desktop app: npm run dev:desktop');
  console.log('   3. Test each integration (Google, JIRA, GitHub)');
  console.log('   4. When ready: git push origin main\n');
  process.exit(0);
} else {
  console.log('\n⚠️  Some checks failed. Please review the issues above.');
  console.log('   Run this script again after fixing the issues.\n');
  process.exit(1);
}

