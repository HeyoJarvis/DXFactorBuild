/**
 * Microsoft 365 Integration Setup Script
 * 
 * Interactive script to help configure Microsoft Graph API integration
 */

const readline = require('readline');
const fs = require('fs');
const path = require('path');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function main() {
  console.log('\n🚀 HeyJarvis - Microsoft 365 Integration Setup\n');
  console.log('This script will help you configure Microsoft Graph API integration.\n');
  
  console.log('📋 Prerequisites:');
  console.log('  1. Azure AD application created');
  console.log('  2. API permissions configured');
  console.log('  3. Client secret generated\n');
  
  const proceed = await question('Have you completed the prerequisites? (y/n): ');
  
  if (proceed.toLowerCase() !== 'y') {
    console.log('\n📖 Please follow the setup guide in MICROSOFT_365_INTEGRATION.md');
    console.log('   Run this script again when ready.\n');
    rl.close();
    return;
  }
  
  console.log('\n✏️  Enter your Microsoft configuration:\n');
  
  const clientId = await question('Microsoft Client ID: ');
  const clientSecret = await question('Microsoft Client Secret: ');
  const tenantId = await question('Microsoft Tenant ID (or "common"): ') || 'common';
  const redirectUri = await question('Redirect URI (or press Enter for default): ') || 'http://localhost:8889/auth/microsoft/callback';
  
  console.log('\n🔍 Validating configuration...\n');
  
  // Basic validation
  if (!clientId || clientId.length < 30) {
    console.error('❌ Invalid Client ID. Please check your Azure app configuration.');
    rl.close();
    return;
  }
  
  if (!clientSecret || clientSecret.length < 20) {
    console.error('❌ Invalid Client Secret. Please check your Azure app configuration.');
    rl.close();
    return;
  }
  
  console.log('✅ Configuration looks good!\n');
  
  // Read existing .env
  const envPath = path.join(__dirname, '..', '.env');
  let envContent = '';
  
  if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, 'utf8');
  }
  
  // Update or add Microsoft variables
  const microsoftVars = {
    'MICROSOFT_CLIENT_ID': clientId,
    'MICROSOFT_CLIENT_SECRET': clientSecret,
    'MICROSOFT_TENANT_ID': tenantId,
    'MICROSOFT_REDIRECT_URI': redirectUri
  };
  
  Object.entries(microsoftVars).forEach(([key, value]) => {
    const regex = new RegExp(`^${key}=.*$`, 'm');
    if (regex.test(envContent)) {
      envContent = envContent.replace(regex, `${key}=${value}`);
    } else {
      envContent += `\n${key}=${value}`;
    }
  });
  
  // Write back to .env
  fs.writeFileSync(envPath, envContent.trim() + '\n');
  
  console.log('✅ Configuration saved to .env\n');
  
  console.log('🎉 Setup complete!\n');
  console.log('Next steps:');
  console.log('  1. Restart HeyJarvis');
  console.log('  2. Authenticate with Microsoft: window.electronAPI.microsoft.authenticate()');
  console.log('  3. Start using Microsoft 365 features!\n');
  
  console.log('📖 For usage examples, see: MICROSOFT_365_INTEGRATION.md\n');
  
  rl.close();
}

main().catch(error => {
  console.error('\n❌ Setup failed:', error.message);
  rl.close();
  process.exit(1);
});
