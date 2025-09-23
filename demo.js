#!/usr/bin/env node

/**
 * HeyJarvis Demo Script
 * 
 * This script demonstrates the core functionality of HeyJarvis:
 * 1. Signal ingestion and processing
 * 2. Entity extraction and enrichment
 * 3. Relevance scoring and filtering
 * 4. Alert generation
 */

// Load environment variables
require('dotenv').config();

const path = require('path');
const winston = require('winston');

// Import our modules
const { SignalSchema, UserSchema, SignalHelpers, SupabaseClient, SignalRepository } = require('./data');
const RSSAdapter = require('./core/signals/ingestion/adapters/rss-adapter');
const EntityLinker = require('./core/signals/enrichment/entity-linker');
const AIAnalyzer = require('./core/signals/enrichment/ai-analyzer');
const ImpactScorer = require('./core/signals/enrichment/impact-scorer');
const UserModel = require('./core/relevance/context-engine/user-model');
const AlertCard = require('./delivery/slack/blocks/alert-card');

// Setup logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.colorize(),
    winston.format.simple()
  ),
  transports: [new winston.transports.Console()]
});

class HeyJarvisDemo {
  constructor() {
    this.logger = logger;
    this.supabase = new SupabaseClient({ logLevel: 'info' });
    this.signalRepository = new SignalRepository({ logLevel: 'info' });
    this.entityLinker = new EntityLinker({ logLevel: 'info' });
    this.aiAnalyzer = new AIAnalyzer({ logLevel: 'info' });
    this.impactScorer = new ImpactScorer({ logLevel: 'info' });
    this.userModel = new UserModel({ logLevel: 'info' });
    this.alertCard = new AlertCard();
  }

  async run() {
    try {
      this.logger.info('🚀 Starting HeyJarvis Demo');
      this.logger.info('==================================');
      
      // Demo 1: Database Connection
      await this.demoDatabaseConnection();
      
      // Demo 2: Signal Processing
      await this.demoSignalProcessing();
      
      // Demo 3: Entity Extraction
      await this.demoEntityExtraction();
      
      // Demo 3: AI Analysis with Claude
      await this.demoAIAnalysis();
      
      // Demo 4: Relevance Scoring
      await this.demoRelevanceScoring();
      
      // Demo 5: Alert Generation
      await this.demoAlertGeneration();
      
      this.logger.info('==================================');
      this.logger.info('✅ HeyJarvis Demo Complete!');
      this.logger.info('');
      this.logger.info('🎯 Next Steps:');
      this.logger.info('1. Configure your Slack tokens in .env');
      this.logger.info('2. Set up your competitive context');
      this.logger.info('3. Add your intelligence sources');
      this.logger.info('4. Start receiving personalized signals!');
      
    } catch (error) {
      this.logger.error('❌ Demo failed:', error.message);
      process.exit(1);
    }
  }

  async demoDatabaseConnection() {
    this.logger.info('');
    this.logger.info('🗄️  Demo 1: Supabase Database Connection');
    this.logger.info('----------------------------------------');
    
    // Test database connection
    this.logger.info('Testing Supabase connection...');
    
    try {
      const isConnected = await this.supabase.testConnection();
      
      if (isConnected) {
        this.logger.info('✅ Supabase connection successful');
        
        // Get database statistics
        const stats = await this.supabase.getStats();
        this.logger.info('📊 Database Statistics:');
        Object.entries(stats).forEach(([table, count]) => {
          this.logger.info(`  • ${table}: ${count} records`);
        });
        
      } else {
        this.logger.warn('⚠️  Supabase connection failed - using demo mode');
        this.logger.info('💡 To connect to Supabase:');
        this.logger.info('   1. Create a Supabase project at https://supabase.com');
        this.logger.info('   2. Update SUPABASE_URL and SUPABASE_ANON_KEY in .env');
        this.logger.info('   3. Run: node data/migrations/supabase-setup.js');
      }
      
    } catch (error) {
      this.logger.warn('⚠️  Supabase not configured - using demo mode');
      this.logger.info('💡 This demo will show you what the system can do');
      this.logger.info('   Real functionality requires Supabase configuration');
    }
  }

  async demoSignalProcessing() {
    this.logger.info('');
    this.logger.info('📡 Demo 2: Signal Processing');
    this.logger.info('----------------------------');
    
    // Create a mock source
    const mockSource = {
      id: 'demo-source-1',
      name: 'TechCrunch',
      type: 'rss',
      url: 'https://techcrunch.com/feed/',
      category: 'industry',
      status: 'active',
      trust_score: 0.8,
      polling_config: {
        interval_minutes: 60,
        timeout_seconds: 30,
        max_retries: 3,
        retry_backoff_minutes: 5,
        requests_per_minute: 10,
        concurrent_requests: 1,
        max_items_per_poll: 10,
        max_content_length: 5000,
        active_hours: { start: '00:00', end: '23:59', timezone: 'UTC' },
        skip_weekends: false
      },
      extraction_config: {
        min_content_length: 100,
        max_content_length: 5000,
        expected_language: 'en',
        auto_translate: false,
        dedup_window_hours: 24,
        similarity_threshold: 0.8
      },
      auth_config: { type: 'none' },
      target_companies: ['OpenAI', 'Google', 'Microsoft'],
      target_keywords: ['AI', 'machine learning', 'GPT'],
      exclude_keywords: ['spam', 'advertisement'],
      quality_metrics: {
        total_polls: 0,
        successful_polls: 0,
        failed_polls: 0,
        success_rate: 0,
        total_items_found: 0,
        valid_items_extracted: 0,
        duplicate_items: 0,
        low_quality_items: 0,
        avg_processing_time_ms: 0,
        avg_items_per_poll: 0,
        recent_errors: [],
        last_successful_poll: null,
        consecutive_failures: 0,
        uptime_percentage: 1,
        avg_relevance_score: 0.5,
        user_feedback_score: 0.5,
        last_calculated: new Date()
      },
      is_public: true,
      allowed_teams: [],
      created_by_team: null,
      last_poll_at: null,
      next_poll_at: new Date(),
      tags: ['demo', 'tech'],
      priority: 'medium',
      created_at: new Date(),
      updated_at: new Date(),
      created_by: 'demo-user'
    };

    // Create RSS adapter
    this.logger.info('Creating RSS adapter...');
    const adapter = new RSSAdapter(mockSource, { logLevel: 'error' });
    
    this.logger.info(`✅ RSS adapter created for: ${mockSource.name}`);
    this.logger.info(`📊 Source trust score: ${mockSource.trust_score}`);
    this.logger.info(`⏱️  Polling interval: ${mockSource.polling_config.interval_minutes} minutes`);
  }

  async demoEntityExtraction() {
    this.logger.info('');
    this.logger.info('🧠 Demo 2: Entity Extraction');
    this.logger.info('-----------------------------');
    
    // Create a mock signal
    const mockSignal = {
      id: 'signal-demo-1',
      title: 'OpenAI Announces GPT-4 Turbo with Enhanced Capabilities',
      summary: 'OpenAI has released GPT-4 Turbo, featuring improved performance and reduced costs. The new model shows significant improvements in coding tasks and supports a 128k context window. CEO Sam Altman announced the release at the DevDay conference.',
      content: 'OpenAI has announced the release of GPT-4 Turbo, the latest iteration of their flagship language model. The new model features enhanced performance across various tasks, particularly in coding and mathematical reasoning. According to CEO Sam Altman, GPT-4 Turbo offers significant cost reductions compared to previous versions while maintaining superior quality. The model now supports a 128,000 token context window, allowing for much longer conversations and document processing. The announcement was made at OpenAI DevDay, where the company also unveiled new API features and developer tools.',
      url: 'https://techcrunch.com/2024/01/15/openai-gpt-4-turbo',
      category: 'product_launch',
      priority: 'high',
      trust_level: 'reliable',
      published_at: new Date(),
      discovered_at: new Date(),
      source_id: 'demo-source-1',
      status: 'raw',
      keywords: ['OpenAI', 'GPT-4', 'Turbo', 'AI', 'language model'],
      language: 'en'
    };

    // Create user context
    const userContext = {
      competitors: ['OpenAI', 'Anthropic', 'Google'],
      our_products: [
        { name: 'CompetitorAI', category: 'AI Assistant' }
      ],
      technologies: ['GPT', 'Transformer', 'NLP'],
      focus_areas: ['artificial intelligence', 'machine learning', 'language models']
    };

    this.logger.info('Extracting entities from signal...');
    this.logger.info(`Signal: "${mockSignal.title}"`);
    
    const entities = await this.entityLinker.extractEntities(mockSignal, userContext);
    
    this.logger.info(`✅ Extracted ${entities.length} entities:`);
    entities.forEach(entity => {
      const relevanceIndicator = entity.relevance > 0.7 ? '🔥' : entity.relevance > 0.4 ? '⚡' : '💡';
      this.logger.info(`  ${relevanceIndicator} ${entity.type}: ${entity.name} (confidence: ${(entity.confidence * 100).toFixed(0)}%, relevance: ${(entity.relevance * 100).toFixed(0)}%)`);
    });
  }

  async demoAIAnalysis() {
    this.logger.info('');
    this.logger.info('🤖 Demo 3: AI Analysis with Claude');
    this.logger.info('-----------------------------------');
    
    // Create a mock signal for AI analysis
    const mockSignal = {
      id: 'signal-ai-demo',
      title: 'Anthropic Releases Claude 3.5 Sonnet with Enhanced Reasoning',
      summary: 'Anthropic has unveiled Claude 3.5 Sonnet, featuring significant improvements in coding, mathematics, and reasoning tasks. The model shows 40% better performance on coding benchmarks and includes new vision capabilities for analyzing charts and documents.',
      content: 'Anthropic today announced the release of Claude 3.5 Sonnet, the latest iteration in their Claude 3.5 model family. The new model demonstrates substantial improvements across multiple domains, with particularly notable advances in coding tasks where it achieves a 40% improvement over previous versions. The model also introduces enhanced vision capabilities, allowing it to analyze complex charts, graphs, and documents with unprecedented accuracy. According to Anthropic, Claude 3.5 Sonnet maintains the same safety standards while offering faster processing speeds and more nuanced understanding of context.',
      category: 'product_launch',
      priority: 'high',
      trust_level: 'official',
      published_at: new Date(),
      source_name: 'Anthropic Blog',
      keywords: ['Anthropic', 'Claude', 'AI', 'reasoning', 'coding']
    };

    const userContext = {
      role: 'product_manager',
      competitors: ['Anthropic', 'OpenAI', 'Google'],
      our_products: [{ name: 'AI Assistant Platform' }],
      focus_areas: ['artificial intelligence', 'competitive analysis'],
      industry: 'Technology'
    };

    this.logger.info('Analyzing signal with Anthropic Claude...');
    this.logger.info(`Signal: "${mockSignal.title}"`);
    this.logger.info(`AI Model: ${this.aiAnalyzer.getStats().model}`);
    
    let mockAnalysis;
    
    if (!this.aiAnalyzer.isConfigured()) {
      this.logger.warn('⚠️  Anthropic API not configured - using mock analysis');
      
      // Show what the analysis would look like
      mockAnalysis = {
        summary: 'Anthropic releases improved Claude model with better coding and reasoning capabilities',
        impact_assessment: {
          competitive_threat: 0.8,
          market_opportunity: 0.6,
          strategic_importance: 0.9,
          urgency: 0.7,
          confidence: 0.9,
          reasoning: 'Direct competitor product launch with significant capability improvements'
        },
        insights: [
          '40% improvement in coding benchmarks indicates major technical advancement',
          'Enhanced vision capabilities expand use cases beyond text',
          'Maintained safety standards while improving performance shows mature development'
        ],
        sentiment: 0.1,
        business_implications: [
          'Need to evaluate our AI capabilities against new Claude benchmarks',
          'Consider how vision capabilities might affect our product roadmap'
        ],
        recommended_actions: [
          'Conduct competitive analysis of Claude 3.5 Sonnet capabilities',
          'Review our AI model performance against new benchmarks'
        ]
      };
      
      this.logger.info('✅ Mock AI Analysis Results:');
    } else {
      try {
        const analysis = await this.aiAnalyzer.analyzeSignal(mockSignal, userContext);
        this.logger.info('✅ Claude Analysis Results:');
        mockAnalysis = analysis;
      } catch (error) {
        this.logger.error(`❌ Analysis failed: ${error.message}`);
        return;
      }
    }
    
    this.logger.info(`📝 Summary: ${mockAnalysis.summary}`);
    this.logger.info(`🎯 Impact Assessment:`);
    this.logger.info(`  • Competitive Threat: ${(mockAnalysis.impact_assessment.competitive_threat * 100).toFixed(0)}%`);
    this.logger.info(`  • Market Opportunity: ${(mockAnalysis.impact_assessment.market_opportunity * 100).toFixed(0)}%`);
    this.logger.info(`  • Strategic Importance: ${(mockAnalysis.impact_assessment.strategic_importance * 100).toFixed(0)}%`);
    this.logger.info(`  • Urgency: ${(mockAnalysis.impact_assessment.urgency * 100).toFixed(0)}%`);
    
    this.logger.info(`🔍 Key Insights:`);
    mockAnalysis.insights.forEach((insight, i) => {
      this.logger.info(`  ${i + 1}. ${insight}`);
    });
    
    this.logger.info(`💼 Recommended Actions:`);
    mockAnalysis.recommended_actions.forEach((action, i) => {
      this.logger.info(`  ${i + 1}. ${action}`);
    });
  }

  async demoRelevanceScoring() {
    this.logger.info('');
    this.logger.info('🎯 Demo 4: Relevance Scoring');
    this.logger.info('-----------------------------');
    
    // Create mock user
    const mockUser = {
      id: 'demo-user-1',
      email: 'demo@company.com',
      name: 'Demo User',
      context: {
        role: 'product_manager',
        seniority: 'senior',
        department: 'Product',
        focus_areas: ['artificial intelligence', 'competitive analysis'],
        company_size: 'medium',
        industry: 'Technology',
        primary_competitors: ['OpenAI', 'Anthropic'],
        secondary_competitors: ['Google', 'Microsoft'],
        partner_companies: ['AWS', 'Azure'],
        products_owned: ['AI Assistant', 'Analytics Platform'],
        technologies_used: ['Python', 'TensorFlow', 'React'],
        markets_served: ['Enterprise', 'SMB']
      },
      notifications: {
        slack: {
          enabled: true,
          threshold: 0.7,
          work_hours_only: true,
          batch_digest: false,
          channels: []
        },
        desktop: {
          enabled: true,
          threshold: 0.5,
          notifications: true,
          sound: false,
          auto_launch: true
        }
      },
      work_schedule: {
        timezone: 'America/New_York',
        work_days: [1, 2, 3, 4, 5],
        start_time: '09:00',
        end_time: '17:00',
        respect_schedule: true
      }
    };

    // Create mock signal with entities
    const mockSignal = {
      id: 'signal-demo-2',
      title: 'Anthropic Raises $450M Series C for Claude AI Development',
      summary: 'Anthropic has secured $450 million in Series C funding to accelerate development of Claude, their AI assistant. The round was led by Spark Capital with participation from Google and Salesforce.',
      category: 'funding',
      priority: 'high',
      trust_level: 'verified',
      published_at: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
      keywords: ['Anthropic', 'Claude', 'AI', 'funding', 'Series C'],
      entities: [
        { type: 'company', name: 'Anthropic', confidence: 0.95, relevance: 0.9, is_competitor: true },
        { type: 'company', name: 'Google', confidence: 0.9, relevance: 0.7 },
        { type: 'product', name: 'Claude', confidence: 0.8, relevance: 0.8 }
      ],
      source_id: 'demo-source-1'
    };

    this.logger.info('Calculating relevance score...');
    this.logger.info(`User: ${mockUser.name} (${mockUser.context.role})`);
    this.logger.info(`Signal: "${mockSignal.title}"`);
    
    const relevanceResult = await this.userModel.calculateRelevance(mockSignal, mockUser);
    
    this.logger.info(`✅ Relevance Score: ${(relevanceResult.score * 100).toFixed(1)}%`);
    this.logger.info('📊 Component Scores:');
    Object.entries(relevanceResult.components).forEach(([component, score]) => {
      const percentage = (score * 100).toFixed(1);
      const indicator = score > 0.7 ? '🟢' : score > 0.4 ? '🟡' : '🔴';
      this.logger.info(`  ${indicator} ${component.replace('_', ' ')}: ${percentage}%`);
    });
    this.logger.info(`💡 Why relevant: ${relevanceResult.explanation}`);
  }

  async demoAlertGeneration() {
    this.logger.info('');
    this.logger.info('📱 Demo 4: Alert Generation');
    this.logger.info('----------------------------');
    
    // Create a high-priority signal
    const criticalSignal = {
      id: 'signal-demo-3',
      title: 'Major Competitor Launches Direct Alternative to Your Product',
      summary: 'OpenAI has announced a new enterprise AI assistant that directly competes with existing solutions in the market. The product features advanced reasoning capabilities and enterprise-grade security.',
      category: 'product_launch',
      priority: 'critical',
      trust_level: 'official',
      published_at: new Date(),
      url: 'https://openai.com/blog/enterprise-assistant',
      entities: [
        { type: 'company', name: 'OpenAI', confidence: 0.95, relevance: 1.0, is_competitor: true },
        { type: 'product', name: 'Enterprise Assistant', confidence: 0.9, relevance: 0.9 }
      ],
      source_id: 'demo-source-1',
      source_name: 'OpenAI Blog'
    };

    const mockUser = {
      id: 'demo-user-1',
      context: { role: 'product_manager' }
    };

    this.logger.info('Generating Slack alert card...');
    this.logger.info(`Signal Priority: ${criticalSignal.priority.toUpperCase()}`);
    
    // Generate different alert types
    const standardAlert = this.alertCard.createAlertCard(criticalSignal, mockUser, {
      relevance_explanation: 'Direct competitor product launch affecting your market segment'
    });

    const criticalAlert = this.alertCard.createCriticalAlert(criticalSignal, mockUser);

    this.logger.info('✅ Alert cards generated:');
    this.logger.info(`📄 Standard alert: ${standardAlert.length} blocks`);
    this.logger.info(`🚨 Critical alert: ${criticalAlert.length} blocks`);
    
    // Show a simplified version of what the alert contains
    this.logger.info('');
    this.logger.info('📋 Alert Preview:');
    this.logger.info(`🚨 ${criticalSignal.title}`);
    this.logger.info(`📊 Category: ${criticalSignal.category.replace('_', ' ')}`);
    this.logger.info(`🔗 Source: ${criticalSignal.source_name}`);
    this.logger.info(`⏰ Published: just now`);
    this.logger.info(`🎯 Why relevant: Direct competitor product launch affecting your market segment`);
    this.logger.info('');
    this.logger.info('Available Actions: 🚩 Flag | 📋 Create Task | 📤 Share | 👍 Helpful | 👎 Not Relevant');
  }
}

// Run the demo
if (require.main === module) {
  const demo = new HeyJarvisDemo();
  demo.run().catch(error => {
    console.error('Demo failed:', error);
    process.exit(1);
  });
}

module.exports = HeyJarvisDemo;
