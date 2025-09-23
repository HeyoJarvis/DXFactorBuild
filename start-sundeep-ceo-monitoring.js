/**
 * Start CEO Monitoring for Sundeep Sanghavi
 * 
 * Production-ready CEO monitoring system for CIPIO
 */

require('dotenv').config();

// Override with real CEO ID
process.env.CEO_SLACK_USER_ID = 'U01EVR49DDX';
process.env.ORGANIZATION_NAME = 'CIPIO';

const { CEOSlackMonitoring } = require('./ceo-slack-integration');

async function startSundeepCEOMonitoring() {
  console.log('🚀 Starting CEO Monitoring for Sundeep Sanghavi');
  console.log('=' .repeat(60));
  console.log('👑 CEO: Sundeep Sanghavi (U01EVR49DDX)');
  console.log('🏢 Organization: CIPIO');
  console.log('📅 Started:', new Date().toLocaleString());
  console.log('');
  
  try {
    const ceoMonitoring = new CEOSlackMonitoring();
    
    // Initialize CEO account
    await ceoMonitoring.initializeCEO('U01EVR49DDX');
    
    // Set up CIPIO team structure automatically as people interact
    console.log('🔧 CIPIO team will be auto-configured as members interact');
    console.log('');
    
    console.log('🎯 CEO MONITORING FEATURES ACTIVE:');
    console.log('   ✅ Automatic task assignment detection');
    console.log('   ✅ Task completion tracking');
    console.log('   ✅ Team productivity analytics');
    console.log('   ✅ AI-powered leadership insights');
    console.log('   ✅ Role-based access control');
    console.log('');
    
    console.log('💬 SLACK COMMANDS (CEO Only):');
    console.log('   /ceo-dashboard     - Complete team overview');
    console.log('   /task-status       - Task assignment tracking');
    console.log('   /ai-suggestions    - AI leadership insights');
    console.log('');
    
    console.log('📊 AUTOMATIC MONITORING:');
    console.log('   • All team messages captured and analyzed');
    console.log('   • Task assignments automatically detected');
    console.log('   • Task completions tracked in real-time');
    console.log('   • Team productivity trends calculated');
    console.log('   • AI suggestions generated based on patterns');
    console.log('');
    
    console.log('🔒 PRIVACY & SECURITY:');
    console.log('   • Only you (Sundeep) can see team-wide data');
    console.log('   • Team members see only their personal metrics');
    console.log('   • All access attempts logged and audited');
    console.log('   • Secure session management');
    console.log('');
    
    console.log('🚀 Starting Slack integration...');
    await ceoMonitoring.start();
    
  } catch (error) {
    console.error('❌ Failed to start CEO monitoring:', error.message);
    
    if (error.message.includes('invalid_auth') || error.message.includes('SLACK_BOT_TOKEN')) {
      console.log('');
      console.log('🔧 SLACK CONFIGURATION NEEDED:');
      console.log('Add these to your .env file:');
      console.log('   SLACK_BOT_TOKEN=xoxb-your-token-here');
      console.log('   SLACK_SIGNING_SECRET=your-signing-secret');
      console.log('   CEO_SLACK_USER_ID=U01EVR49DDX');
    }
    
    throw error;
  }
}

if (require.main === module) {
  startSundeepCEOMonitoring().catch(error => {
    console.error('💥 Startup failed:', error.message);
    process.exit(1);
  });
}

module.exports = startSundeepCEOMonitoring;
