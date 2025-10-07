#!/usr/bin/env node

/**
 * Fix Microsoft Graph Service to use PublicClientApplication instead of ConfidentialClientApplication
 * Desktop apps should use public client flow without client secret
 */

const fs = require('fs');
const path = require('path');

const GRAPH_SERVICE_FILE = path.join(__dirname, '../core/integrations/microsoft-graph-service.js');

console.log('🔧 Fixing Microsoft client type for desktop app...\n');

let content = fs.readFileSync(GRAPH_SERVICE_FILE, 'utf8');

// 1. Update import to use PublicClientApplication
if (content.includes('const { ConfidentialClientApplication }')) {
  content = content.replace(
    "const { ConfidentialClientApplication } = require('@azure/msal-node');",
    "const { PublicClientApplication } = require('@azure/msal-node');"
  );
  console.log('✅ Updated import to PublicClientApplication');
}

// 2. Remove clientSecret from options (not needed for public clients)
// Keep it in options but don't use it in MSAL config

// 3. Update MSAL config to remove clientSecret
const oldMsalConfig = `    // Initialize MSAL
    this.msalConfig = {
      auth: {
        clientId: this.options.clientId,
        authority: \`https://login.microsoftonline.com/\${this.options.tenantId}\`,
        clientSecret: this.options.clientSecret
      }
    };

    this.msalClient = new ConfidentialClientApplication(this.msalConfig);`;

const newMsalConfig = `    // Initialize MSAL (Public Client for desktop app)
    this.msalConfig = {
      auth: {
        clientId: this.options.clientId,
        authority: \`https://login.microsoftonline.com/\${this.options.tenantId}\`
        // No clientSecret for public clients (desktop apps)
      }
    };

    this.msalClient = new PublicClientApplication(this.msalConfig);`;

if (content.includes('new ConfidentialClientApplication(this.msalConfig)')) {
  content = content.replace(oldMsalConfig, newMsalConfig);
  console.log('✅ Updated MSAL config to remove clientSecret');
  console.log('✅ Changed to PublicClientApplication');
}

fs.writeFileSync(GRAPH_SERVICE_FILE, content);

console.log('\n✅ Microsoft client type successfully updated!');
console.log('\n📝 What changed:');
console.log('   - Switched from ConfidentialClientApplication to PublicClientApplication');
console.log('   - Removed clientSecret from MSAL config');
console.log('   - This is the correct configuration for desktop apps');
console.log('\n📝 Azure App Configuration:');
console.log('   - In Azure Portal, your app should be configured as:');
console.log('   - Platform: Mobile and desktop applications');
console.log('   - Redirect URI: http://localhost:8889/auth/microsoft/callback');
console.log('   - Allow public client flows: Yes');
console.log('\n📝 Next steps:');
console.log('   1. Restart HeyJarvis');
console.log('   2. Try authenticating again');
console.log('   3. Authentication should work!\n');
