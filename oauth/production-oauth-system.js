/**
 * Production OAuth System - Complete Integration
 * 
 * Combines all components for production-ready Slack OAuth delegation
 * Ready for immediate testing with real users
 */

require('dotenv').config();

const SlackOAuthManager = require('./slack-oauth-manager');
const MessageCollector = require('./message-collector');
const OAuthWebServer = require('./oauth-web-server');
const EnhancedCEOMonitoring = require('./enhanced-ceo-monitoring');
const winston = require('winston');

class ProductionOAuthSystem {
  constructor(options = {}) {
    this.options = {
      webServerPort: process.env.OAUTH_PORT || 3001,
      logLevel: 'info',
      ...options
    };
    
    this.logger = winston.createLogger({
      level: this.options.logLevel,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'logs/production-oauth.log' })
      ],
      defaultMeta: { service: 'production-oauth' }
    });
    
    // Initialize all components
    this.oauthManager = new SlackOAuthManager();
    this.messageCollector = new MessageCollector(this.oauthManager);
    this.webServer = new OAuthWebServer({ port: this.options.webServerPort });
    this.ceoMonitoring = new EnhancedCEOMonitoring();
    
    this.isRunning = false;
  }

  /**
   * Validate environment configuration
   */
  validateEnvironment() {
    const required = [
      'SLACK_CLIENT_ID',
      'SLACK_CLIENT_SECRET', 
      'SLACK_BOT_TOKEN',
      'SLACK_SIGNING_SECRET'
    ];
    
    const missing = required.filter(key => !process.env[key]);
    
    if (missing.length > 0) {
      throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }
    
    // Set defaults for optional variables
    if (!process.env.SLACK_REDIRECT_URI) {
      process.env.SLACK_REDIRECT_URI = `http://localhost:${this.options.webServerPort}/auth/slack/callback`;
      this.logger.warn('SLACK_REDIRECT_URI not set, using default', { 
        redirectUri: process.env.SLACK_REDIRECT_URI 
      });
    }
    
    if (!process.env.ENCRYPTION_KEY) {
      process.env.ENCRYPTION_KEY = require('crypto').randomBytes(32).toString('hex');
      this.logger.warn('ENCRYPTION_KEY not set, generated temporary key (not suitable for production)');
    }
    
    this.logger.info('Environment validation passed');
  }

  /**
   * Setup system integration
   */
  setupIntegration() {
    // Hook message collector to CEO monitoring
    const originalInitialize = this.messageCollector.initializeUserCollection.bind(this.messageCollector);
    this.messageCollector.initializeUserCollection = async (userId) => {
      const result = await originalInitialize(userId);
      
      // Notify CEO monitoring of new user
      const tokenData = await this.oauthManager.getUserTokenData(userId);
      if (tokenData) {
        await this.ceoMonitoring.processNewOAuthUser(userId, tokenData.slack_user_id);
      }
      
      return result;
    };
    
    this.logger.info('System integration setup complete');
  }

  /**
   * Start the complete production system
   */
  async start() {
    try {
      this.logger.info('Starting Production OAuth System...');
      
      // Validate environment
      this.validateEnvironment();
      
      // Setup integration
      this.setupIntegration();
      
      // Start web server
      await this.webServer.start();
      
      // Start CEO monitoring
      await this.ceoMonitoring.start();
      
      this.isRunning = true;
      
      console.log('\n🎉 PRODUCTION OAUTH SYSTEM RUNNING!');
      console.log('=' .repeat(60));
      console.log('\n🌐 OAuth Web Interface:');
      console.log(`   URL: http://localhost:${this.options.webServerPort}`);
      console.log(`   Connect Slack: http://localhost:${this.options.webServerPort}/auth/slack`);
      console.log(`   API Docs: http://localhost:${this.options.webServerPort}/api/system/stats`);
      
      console.log('\n👑 CEO Slack Commands:');
      console.log('   /ceo-dashboard-enhanced     - Complete team visibility');
      console.log('   /team-conversations         - Communication analysis');
      console.log('   /task-tracking-enhanced     - Task tracking across all conversations');
      console.log('   /user-interaction-analysis  - Analyze user interactions');
      
      console.log('\n🔧 System Configuration:');
      console.log(`   CEO User ID: ${process.env.CEO_SLACK_USER_ID || 'U01EVR49DDX'}`);
      console.log(`   Organization: ${process.env.ORGANIZATION_NAME || 'CIPIO'}`);
      console.log(`   Redirect URI: ${process.env.SLACK_REDIRECT_URI}`);
      console.log(`   Encryption: ${process.env.ENCRYPTION_KEY ? 'Enabled' : 'Temporary Key'}`);
      
      console.log('\n🚀 Ready for Testing:');
      console.log('   1. You: Go to OAuth URL and connect your Slack');
      console.log('   2. Sundeep: Go to OAuth URL and connect his Slack');
      console.log('   3. Test: Send DMs between you and Sundeep');
      console.log('   4. CEO Commands: Use enhanced commands to see complete data');
      console.log('   5. API: Check stats and conversation analysis');
      
      console.log('\n📊 Live System Stats:');
      await this.printSystemStats();
      
      this.logger.info('Production OAuth System started successfully');
      
    } catch (error) {
      this.logger.error('Failed to start production system', { error: error.message });
      console.error('\n❌ STARTUP FAILED:', error.message);
      throw error;
    }
  }

  /**
   * Print current system statistics
   */
  async printSystemStats() {
    try {
      const oauthStats = this.oauthManager.getSystemStats();
      const messageStats = this.messageCollector.getSystemStats();
      
      console.log(`   • Authorized Users: ${oauthStats.total_authorized_users}`);
      console.log(`   • Messages Collected: ${messageStats.total_messages || 0}`);
      console.log(`   • Conversations Analyzed: ${messageStats.total_conversations || 0}`);
      console.log(`   • Unique Channels: ${messageStats.unique_conversation_channels || 0}`);
      
      if (oauthStats.authorized_users.length > 0) {
        console.log('\n   👥 Current Authorized Users:');
        oauthStats.authorized_users.forEach(user => {
          console.log(`      • ${user.real_name} (${user.team_name})`);
        });
      }
      
    } catch (error) {
      console.log('   • Unable to load stats');
    }
  }

  /**
   * Stop the production system
   */
  async stop() {
    try {
      this.logger.info('Stopping Production OAuth System...');
      
      await this.webServer.stop();
      // CEO monitoring will stop with the process
      
      this.isRunning = false;
      
      console.log('\n🛑 Production OAuth System stopped');
      this.logger.info('Production OAuth System stopped successfully');
      
    } catch (error) {
      this.logger.error('Error stopping production system', { error: error.message });
      throw error;
    }
  }

  /**
   * Get system health status
   */
  getHealthStatus() {
    return {
      running: this.isRunning,
      components: {
        oauth_manager: !!this.oauthManager,
        message_collector: !!this.messageCollector,
        web_server: !!this.webServer,
        ceo_monitoring: !!this.ceoMonitoring
      },
      stats: {
        oauth: this.oauthManager.getSystemStats(),
        messages: this.messageCollector.getSystemStats()
      },
      environment: {
        slack_client_id: !!process.env.SLACK_CLIENT_ID,
        slack_client_secret: !!process.env.SLACK_CLIENT_SECRET,
        slack_bot_token: !!process.env.SLACK_BOT_TOKEN,
        slack_signing_secret: !!process.env.SLACK_SIGNING_SECRET,
        encryption_key: !!process.env.ENCRYPTION_KEY,
        redirect_uri: process.env.SLACK_REDIRECT_URI
      }
    };
  }

  /**
   * Test system functionality
   */
  async runSystemTest() {
    console.log('\n🧪 Running System Tests...');
    
    const tests = [
      {
        name: 'OAuth Manager',
        test: () => this.oauthManager.generateOAuthURL('test-user')
      },
      {
        name: 'Message Collector',
        test: () => this.messageCollector.getSystemStats()
      },
      {
        name: 'Web Server Health',
        test: async () => {
          const fetch = require('node-fetch');
          const response = await fetch(`http://localhost:${this.options.webServerPort}/health`);
          return response.json();
        }
      }
    ];
    
    for (const test of tests) {
      try {
        await test.test();
        console.log(`   ✅ ${test.name}: PASS`);
      } catch (error) {
        console.log(`   ❌ ${test.name}: FAIL - ${error.message}`);
      }
    }
    
    console.log('\n🧪 System Tests Complete');
  }
}

/**
 * CLI interface for production system
 */
async function main() {
  const system = new ProductionOAuthSystem();
  
  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n\n🛑 Shutting down Production OAuth System...');
    await system.stop();
    process.exit(0);
  });
  
  process.on('SIGTERM', async () => {
    console.log('\n\n🛑 Received SIGTERM, shutting down...');
    await system.stop();
    process.exit(0);
  });
  
  // Start the system
  try {
    await system.start();
    
    // Keep alive and show periodic stats
    setInterval(async () => {
      console.log('\n📊 System Status Update:');
      await system.printSystemStats();
    }, 60000); // Every minute
    
  } catch (error) {
    console.error('Failed to start system:', error.message);
    process.exit(1);
  }
}

module.exports = ProductionOAuthSystem;

// Run if executed directly
if (require.main === module) {
  main().catch(console.error);
}
