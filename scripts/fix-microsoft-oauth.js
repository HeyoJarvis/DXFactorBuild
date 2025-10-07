#!/usr/bin/env node

/**
 * Fix Microsoft OAuth handler to properly await getAuthUrl()
 */

const fs = require('fs');
const path = require('path');

const OAUTH_FILE = path.join(__dirname, '../oauth/microsoft-oauth-handler.js');

console.log('🔧 Fixing Microsoft OAuth handler...\n');

let content = fs.readFileSync(OAUTH_FILE, 'utf8');

// Fix the server listen callback to be async and await getAuthUrl
const oldCode = `        this.server.listen(this.options.port, () => {
          this.logger.info('OAuth server started', { port: this.options.port });
          
          // Get authorization URL
          const authUrl = this.graphService.getAuthUrl();
          
          this.logger.info('Authorization URL generated', { authUrl });
          
          // Store promise resolver
          this.pendingAuth = { resolve, reject };
          
          // Open browser to authorization URL
          const { shell } = require('electron');
          shell.openExternal(authUrl);
        });`;

const newCode = `        this.server.listen(this.options.port, async () => {
          this.logger.info('OAuth server started', { port: this.options.port });
          
          try {
            // Get authorization URL (this is async!)
            const authUrl = await this.graphService.getAuthUrl();
            
            this.logger.info('Authorization URL generated', { authUrl: authUrl.substring(0, 50) + '...' });
            
            // Store promise resolver
            this.pendingAuth = { resolve, reject };
            
            // Open browser to authorization URL
            const { shell } = require('electron');
            shell.openExternal(authUrl);
          } catch (error) {
            this.logger.error('Failed to generate auth URL', { error: error.message });
            reject(error);
            this._stopServer();
          }
        });`;

if (content.includes('const authUrl = this.graphService.getAuthUrl();')) {
  content = content.replace(oldCode, newCode);
  fs.writeFileSync(OAUTH_FILE, content);
  console.log('✅ Microsoft OAuth handler fixed!');
  console.log('   - Made server listen callback async');
  console.log('   - Added await for getAuthUrl()');
  console.log('   - Added error handling\n');
} else {
  console.log('⏭️  OAuth handler already fixed or code structure changed\n');
}

console.log('📝 Next steps:');
console.log('   1. Restart HeyJarvis');
console.log('   2. Click the Microsoft button');
console.log('   3. Authenticate!\n');
