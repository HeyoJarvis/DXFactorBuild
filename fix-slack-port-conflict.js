#!/usr/bin/env node

/**
 * Fix Slack service port conflict - Socket Mode doesn't need a port!
 */

const fs = require('fs');
const path = require('path');

console.log('🔧 Fixing Slack service port conflict...\n');

const slackServicePath = path.join(__dirname, 'desktop/main/slack-service.js');
let slackService = fs.readFileSync(slackServicePath, 'utf8');

// Remove the port configuration - Socket Mode doesn't need it
const oldConfig = `      this.app = new App({
        token: process.env.SLACK_BOT_TOKEN,
        signingSecret: process.env.SLACK_SIGNING_SECRET,
        socketMode: true,
        appToken: process.env.SLACK_APP_TOKEN,
        port: 3002 // Different port from your test
      });`;

const newConfig = `      this.app = new App({
        token: process.env.SLACK_BOT_TOKEN,
        signingSecret: process.env.SLACK_SIGNING_SECRET,
        socketMode: true,
        appToken: process.env.SLACK_APP_TOKEN
        // Socket Mode uses WebSocket, no HTTP port needed!
      });`;

if (slackService.includes('port: 3002')) {
  slackService = slackService.replace(oldConfig, newConfig);
  fs.writeFileSync(slackServicePath, slackService);
  console.log('✅ Removed port configuration from Slack service');
  console.log('   Socket Mode uses WebSocket - no HTTP port needed!');
} else {
  console.log('⚠️  Port configuration already removed or changed');
}

console.log('\n✨ Fix applied!');
console.log('\n🚀 Now restart the desktop app and test again.');
console.log('   The Slack service should work properly now.\n');

