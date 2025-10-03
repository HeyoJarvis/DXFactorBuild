#!/usr/bin/env node

/**
 * Add comprehensive debug logging to Slack service
 */

const fs = require('fs');
const path = require('path');

console.log('🔧 Adding debug logging to Slack service...\n');

const slackServicePath = path.join(__dirname, 'desktop/main/slack-service.js');
let slackService = fs.readFileSync(slackServicePath, 'utf8');

// Add detailed logging to setupEventHandlers
const oldSetupStart = `  setupEventHandlers() {
    // Handle @hj2 mentions
    this.app.event('app_mention', async ({ event }) => {`;

const newSetupStart = `  setupEventHandlers() {
    this.logger.info('🔧 Setting up Slack event handlers...');
    
    // Log ALL events for debugging
    this.app.event(/.*/,async ({ event, body }) => {
      this.logger.debug('📡 Slack event received', { 
        type: event.type,
        subtype: event.subtype,
        user: event.user,
        channel: event.channel 
      });
    });
    
    // Handle @hj2 mentions
    this.app.event('app_mention', async ({ event }) => {`;

if (!slackService.includes('Log ALL events for debugging') && slackService.includes(oldSetupStart)) {
  slackService = slackService.replace(oldSetupStart, newSetupStart);
  console.log('✅ Added event logging');
}

// Add logging to start() method
const oldStart = `      await this.app.start();
      this.isConnected = true;
      
      this.logger.info('✅ Slack service started successfully and listening for events');`;

const newStart = `      this.logger.info('🚀 Calling app.start()...');
      await this.app.start();
      this.isConnected = true;
      
      this.logger.info('✅ Slack service started successfully and listening for events');
      this.logger.info('📋 Event handlers registered:', {
        mention_handler: true,
        message_handler: true,
        error_handler: true
      });`;

if (!slackService.includes('Calling app.start()') && slackService.includes(oldStart)) {
  slackService = slackService.replace(oldStart, newStart);
  console.log('✅ Added start() logging');
}

// Add more detailed message logging
const oldMessageLog = `        this.logger.info('💬 MESSAGE RECEIVED!', { 
          user: message.user, 
          channel: message.channel,
          channelType: context.channelType,
          text: message.text?.substring(0, 50) 
        });`;

const newMessageLog = `        this.logger.info('💬 MESSAGE RECEIVED!', { 
          user: message.user, 
          channel: message.channel,
          channelType: context.channelType,
          text: message.text?.substring(0, 50),
          subtype: message.subtype,
          bot_id: message.bot_id,
          ts: message.ts
        });`;

if (slackService.includes(oldMessageLog)) {
  slackService = slackService.replace(oldMessageLog, newMessageLog);
  console.log('✅ Enhanced message logging');
}

// Write back
fs.writeFileSync(slackServicePath, slackService);

console.log('\n✨ Debug logging added!');
console.log('\n🧪 What you\'ll see now:');
console.log('  • 📡 Slack event received - for EVERY event');
console.log('  • 🚀 Calling app.start() - when starting');
console.log('  • 📋 Event handlers registered - confirmation');
console.log('  • 💬 MESSAGE RECEIVED! - with full details');
console.log('\n🔍 This will help us see:');
console.log('  1. If events are arriving at all');
console.log('  2. What type of events are coming');
console.log('  3. Why messages might be filtered out\n');

