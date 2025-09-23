/**
 * Start OAuth System - Loads .env from root directory
 */

// Load .env from current directory (root)
require('dotenv').config();

// Now start the OAuth system
const ProductionOAuthSystem = require('./oauth/production-oauth-system');

async function startSystem() {
  console.log('🚀 Starting Production OAuth System...');
  console.log('📋 Environment Check:');
  console.log(`   SLACK_CLIENT_ID: ${process.env.SLACK_CLIENT_ID ? '✅ Set' : '❌ Missing'}`);
  console.log(`   SLACK_CLIENT_SECRET: ${process.env.SLACK_CLIENT_SECRET ? '✅ Set' : '❌ Missing'}`);
  console.log(`   SLACK_BOT_TOKEN: ${process.env.SLACK_BOT_TOKEN ? '✅ Set' : '❌ Missing'}`);
  console.log(`   SLACK_SIGNING_SECRET: ${process.env.SLACK_SIGNING_SECRET ? '✅ Set' : '❌ Missing'}`);
  console.log(`   CEO_SLACK_USER_ID: ${process.env.CEO_SLACK_USER_ID || 'U01EVR49DDX'}`);
  console.log('');
  
  try {
    const system = new ProductionOAuthSystem();
    await system.start();
  } catch (error) {
    console.error('❌ Failed to start system:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  startSystem();
}
