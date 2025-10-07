/**
 * Microsoft 365 Integration Test Script
 * 
 * Tests the Microsoft Graph API integration to ensure:
 * - OAuth handler is properly configured
 * - Graph service can initialize
 * - Scopes are correctly set
 * - Environment variables are loaded
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const MicrosoftOAuthHandler = require('../oauth/microsoft-oauth-handler');
const MicrosoftGraphService = require('../core/integrations/microsoft-graph-service');

console.log('\n🧪 Microsoft 365 Integration Test\n');
console.log('='.repeat(50));

// Test 1: Environment Variables
console.log('\n📋 Test 1: Environment Variables');
console.log('-'.repeat(50));

const envVars = {
  'MICROSOFT_CLIENT_ID': process.env.MICROSOFT_CLIENT_ID,
  'MICROSOFT_CLIENT_SECRET': process.env.MICROSOFT_CLIENT_SECRET,
  'MICROSOFT_TENANT_ID': process.env.MICROSOFT_TENANT_ID,
  'MICROSOFT_REDIRECT_URI': process.env.MICROSOFT_REDIRECT_URI
};

let envTestPassed = true;
for (const [key, value] of Object.entries(envVars)) {
  if (value) {
    console.log(`✅ ${key}: ${key === 'MICROSOFT_CLIENT_SECRET' ? '***' + value.slice(-4) : value}`);
  } else {
    console.log(`❌ ${key}: NOT SET`);
    envTestPassed = false;
  }
}

if (!envTestPassed) {
  console.log('\n❌ Environment variables test FAILED');
  console.log('Please add the missing variables to your .env file\n');
  process.exit(1);
}

console.log('\n✅ Environment variables test PASSED');

// Test 2: Microsoft Graph Service Initialization
console.log('\n📋 Test 2: Microsoft Graph Service Initialization');
console.log('-'.repeat(50));

try {
  const graphService = new MicrosoftGraphService({
    clientId: process.env.MICROSOFT_CLIENT_ID,
    clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
    tenantId: process.env.MICROSOFT_TENANT_ID,
    logLevel: 'error' // Suppress logs during test
  });
  
  console.log('✅ Graph Service initialized successfully');
  console.log(`   Tenant ID: ${graphService.options.tenantId}`);
  console.log(`   Scopes configured: ${graphService.options.scopes.length}`);
  console.log('   Scopes:');
  graphService.options.scopes.forEach(scope => {
    console.log(`     - ${scope}`);
  });
  
} catch (error) {
  console.log('❌ Graph Service initialization FAILED');
  console.log(`   Error: ${error.message}`);
  process.exit(1);
}

console.log('\n✅ Graph Service test PASSED');

// Test 3: OAuth Handler Initialization
console.log('\n📋 Test 3: OAuth Handler Initialization');
console.log('-'.repeat(50));

try {
  const oauthHandler = new MicrosoftOAuthHandler({
    clientId: process.env.MICROSOFT_CLIENT_ID,
    clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
    tenantId: process.env.MICROSOFT_TENANT_ID,
    logLevel: 'error' // Suppress logs during test
  });
  
  console.log('✅ OAuth Handler initialized successfully');
  console.log(`   Callback port: ${oauthHandler.options.port}`);
  console.log(`   Redirect URI: ${oauthHandler.graphService.options.redirectUri}`);
  
} catch (error) {
  console.log('❌ OAuth Handler initialization FAILED');
  console.log(`   Error: ${error.message}`);
  process.exit(1);
}

console.log('\n✅ OAuth Handler test PASSED');

// Test 4: MSAL Configuration
console.log('\n📋 Test 4: MSAL Configuration');
console.log('-'.repeat(50));

try {
  const graphService = new MicrosoftGraphService({
    clientId: process.env.MICROSOFT_CLIENT_ID,
    clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
    tenantId: process.env.MICROSOFT_TENANT_ID,
    logLevel: 'error'
  });
  
  const msalConfig = graphService.msalConfig;
  
  console.log('✅ MSAL Configuration:');
  console.log(`   Authority: ${msalConfig.auth.authority}`);
  console.log(`   Client ID: ${msalConfig.auth.clientId}`);
  console.log(`   Client Secret: ***${msalConfig.auth.clientSecret.slice(-4)}`);
  
  // Verify MSAL client was created
  if (graphService.msalClient) {
    console.log('✅ MSAL Client created successfully');
  } else {
    throw new Error('MSAL Client not initialized');
  }
  
} catch (error) {
  console.log('❌ MSAL Configuration FAILED');
  console.log(`   Error: ${error.message}`);
  process.exit(1);
}

console.log('\n✅ MSAL Configuration test PASSED');

// Test 5: Required Scopes Check
console.log('\n📋 Test 5: Required Scopes Check');
console.log('-'.repeat(50));

const requiredScopes = [
  'User.Read',
  'Mail.Send',
  'Mail.ReadWrite',
  'Calendars.ReadWrite',
  'Chat.ReadWrite',
  'ChannelMessage.Send',
  'OnlineMeetings.ReadWrite'
];

const graphService = new MicrosoftGraphService({
  clientId: process.env.MICROSOFT_CLIENT_ID,
  clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
  tenantId: process.env.MICROSOFT_TENANT_ID,
  logLevel: 'error'
});

const configuredScopes = graphService.options.scopes;
const missingScopes = requiredScopes.filter(scope => !configuredScopes.includes(scope));

if (missingScopes.length > 0) {
  console.log('⚠️  Missing recommended scopes:');
  missingScopes.forEach(scope => {
    console.log(`   - ${scope}`);
  });
  console.log('\n   These scopes are optional but recommended for full functionality.');
} else {
  console.log('✅ All recommended scopes are configured');
}

console.log('\n✅ Scopes check PASSED');

// Summary
console.log('\n' + '='.repeat(50));
console.log('🎉 ALL TESTS PASSED!');
console.log('='.repeat(50));
console.log('\n✅ Your Microsoft 365 integration is properly configured!');
console.log('\n📝 Next Steps:');
console.log('   1. Restart HeyJarvis: npm run dev:desktop');
console.log('   2. Authenticate: window.electronAPI.microsoft.authenticate()');
console.log('   3. Start using Microsoft features!\n');
