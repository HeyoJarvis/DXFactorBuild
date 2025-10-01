#!/usr/bin/env node

/**
 * Task Intelligence System Tester
 * 
 * Tests the complete AI-powered task intelligence pipeline with real CRM data.
 * No mock data - uses actual HubSpot CRM and Anthropic AI.
 * 
 * Usage:
 *   node test-task-intelligence-system.js "Hey John, can you follow up with Acme Corp by Friday?"
 *   node test-task-intelligence-system.js --interactive
 */

require('dotenv').config();
const readline = require('readline');
const winston = require('winston');

// Import our components
const TaskContextOrchestrator = require('./core/orchestration/task-context-orchestrator');
const AITaskRecommendationGenerator = require('./core/recommendations/ai-task-recommendation-generator');

class TaskIntelligenceSystemTester {
  constructor() {
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.colorize(),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
          return `${timestamp} [${level}] ${message} ${Object.keys(meta).length ? JSON.stringify(meta, null, 2) : ''}`;
        })
      ),
      transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'logs/task-intelligence-test.log' })
      ]
    });

    // Initialize components with real service URLs
    this.orchestrator = new TaskContextOrchestrator({
      logLevel: 'info',
      crmServiceUrl: 'http://localhost:3002'
    });

    this.recommendationGenerator = new AITaskRecommendationGenerator({
      logLevel: 'info'
    });

    this.testResults = [];
  }

  /**
   * Test the complete task intelligence pipeline
   */
  async testTaskMessage(messageText, options = {}) {
    const testId = `test_${Date.now()}`;
    
    console.log('\n' + '='.repeat(80));
    console.log(`🧪 TESTING TASK INTELLIGENCE SYSTEM - ${testId}`);
    console.log('='.repeat(80));
    console.log(`📝 Message: "${messageText}"`);
    console.log('='.repeat(80));

    try {
      // Step 1: Check if intelligent background service is running
      await this.checkServices();

      // Step 2: Prepare message context (simulate real Slack message)
      const messageContext = this.createMessageContext(options);
      
      console.log('\n🔍 STEP 1: Task Context Analysis');
      console.log('-'.repeat(50));
      
      // Step 3: Analyze task with CRM context
      const startTime = Date.now();
      const enrichedContext = await this.orchestrator.enrichTaskWithContext(
        messageText,
        messageContext,
        options.organizationId || 'default_org'
      );

      const analysisTime = Date.now() - startTime;
      
      // Display analysis results
      this.displayTaskAnalysis(enrichedContext, analysisTime);

      // Step 4: Generate recommendations based on confidence and type
      let recommendations = null;
      if (enrichedContext.confidence_score >= 0.2) {
        console.log('\n💡 STEP 2: AI Recommendation Generation');
        console.log('-'.repeat(50));
        
        const recStartTime = Date.now();
        
        if (enrichedContext.is_task) {
          // Generate task-specific recommendations
          recommendations = await this.recommendationGenerator.generateTaskRecommendations(enrichedContext);
        } else {
          // Generate general business intelligence recommendations
          recommendations = await this.generateGeneralRecommendations(messageText, enrichedContext);
        }
        
        const recTime = Date.now() - recStartTime;
        this.displayRecommendations(recommendations, recTime);
      } else {
        console.log('\n❌ STEP 2: Skipped (Confidence too low)');
        console.log('-'.repeat(50));
        console.log(`Confidence: ${enrichedContext.confidence_score} (minimum: 0.2)`);
      }

      // Step 5: Simulate delivery
      if (recommendations) {
        console.log('\n📤 STEP 3: Delivery Simulation');
        console.log('-'.repeat(50));
        this.simulateDelivery(enrichedContext, recommendations);
      }

      // Step 6: Store test result
      const testResult = {
        testId,
        messageText,
        enrichedContext,
        recommendations,
        analysisTime,
        recTime: recommendations ? Date.now() - startTime : 0,
        success: true,
        timestamp: new Date()
      };

      this.testResults.push(testResult);

      console.log('\n✅ TEST COMPLETED SUCCESSFULLY');
      console.log('='.repeat(80));
      
      return testResult;

    } catch (error) {
      console.log('\n❌ TEST FAILED');
      console.log('-'.repeat(50));
      console.error('Error:', error.message);
      console.log('='.repeat(80));
      
      const testResult = {
        testId,
        messageText,
        error: error.message,
        success: false,
        timestamp: new Date()
      };
      
      this.testResults.push(testResult);
      throw error;
    }
  }

  /**
   * Generate general business intelligence recommendations
   */
  async generateGeneralRecommendations(messageText, context) {
    try {
      const AIAnalyzer = require('./core/ai/anthropic-analyzer');
      const aiAnalyzer = new AIAnalyzer();

      const prompt = `
You are a business intelligence assistant. Generate helpful recommendations for this query:

MESSAGE: "${messageText}"
CONTEXT: ${JSON.stringify(context, null, 2)}

Provide recommendations in this JSON format:
{
  "type": "general_business_intelligence",
  "recommendations": [
    {
      "title": "Recommendation Title",
      "description": "Detailed description",
      "priority": "high|medium|low",
      "category": "analysis|tools|process|strategy"
    }
  ],
  "insights": [
    "Key insight 1",
    "Key insight 2"
  ],
  "next_steps": [
    "Actionable step 1",
    "Actionable step 2"
  ]
}`;

      const analysis = await aiAnalyzer.analyzeText(messageText, { prompt });
      return typeof analysis === 'string' ? JSON.parse(analysis) : analysis;
    } catch (error) {
      this.logger.error('General recommendations generation failed', { error: error.message });
      return {
        type: 'general_business_intelligence',
        recommendations: [
          {
            title: 'Business Analysis',
            description: 'I can help analyze your business questions and provide insights.',
            priority: 'medium',
            category: 'analysis'
          }
        ],
        insights: ['Consider providing more context for better analysis'],
        next_steps: ['Clarify specific requirements', 'Gather relevant data']
      };
    }
  }

  /**
   * Check if required services are running
   */
  async checkServices() {
    console.log('🔍 Checking required services...');
    
    try {
      const fetch = require('node-fetch');
      
      // Check intelligent background service
      const healthResponse = await fetch('http://localhost:3002/health');
      if (!healthResponse.ok) {
        throw new Error('Intelligent background service not responding');
      }
      
      const healthData = await healthResponse.json();
      console.log('✅ Intelligent Background Service:', healthData.status);
      
      // Check if we have CRM data
      const analysisResponse = await fetch('http://localhost:3002/analysis/latest/default_org');
      if (analysisResponse.ok) {
        const analysisData = await analysisResponse.json();
        console.log('✅ CRM Analysis Available:', `${analysisData.workflows?.length || 0} workflows`);
      } else {
        console.log('⚠️  No CRM analysis found - will trigger new analysis');
      }
      
      // Check company intelligence
      const intelligenceResponse = await fetch('http://localhost:3002/intelligence/default_org');
      if (intelligenceResponse.ok) {
        const intelligenceData = await intelligenceResponse.json();
        console.log('✅ Company Intelligence Available:', intelligenceData.company_name || 'Available');
      } else {
        console.log('⚠️  No company intelligence found');
      }
      
    } catch (error) {
      console.error('❌ Service check failed:', error.message);
      console.log('\n💡 Make sure to start the intelligent background service:');
      console.log('   cd crm-integration && ./start-intelligent-service.sh');
      throw new Error('Required services not available');
    }
  }

  /**
   * Create realistic message context
   */
  createMessageContext(options = {}) {
    return {
      channel_id: options.channelId || 'C1234567890',
      channel_name: options.channelName || 'general',
      user_id: options.userId || 'U0987654321',
      timestamp: new Date(),
      conversation_type: options.conversationType || 'channel',
      organization_id: options.organizationId || 'default_org'
    };
  }

  /**
   * Display task analysis results
   */
  displayTaskAnalysis(enrichedContext, analysisTime) {
    console.log(`⏱️  Analysis Time: ${analysisTime}ms`);
    console.log(`🎯 Is Task: ${enrichedContext.is_task ? '✅ YES' : '❌ NO'}`);
    console.log(`📊 Confidence: ${(enrichedContext.confidence_score * 100).toFixed(1)}%`);
    
    if (enrichedContext.is_task) {
      console.log(`👤 Assignee: ${enrichedContext.assignee || 'Not specified'}`);
      console.log(`📋 Task Type: ${enrichedContext.task_type}`);
      console.log(`⚡ Urgency: ${enrichedContext.urgency}`);
      console.log(`📝 Action: ${enrichedContext.action_required}`);
      
      if (enrichedContext.crm_matches && enrichedContext.crm_matches.length > 0) {
        console.log(`🔗 CRM Matches: ${enrichedContext.crm_matches.length} found`);
        enrichedContext.crm_matches.forEach((match, i) => {
          console.log(`   ${i + 1}. ${match.entity} → ${match.crm_match} (${match.match_type})`);
        });
      }
      
      if (enrichedContext.context_analysis) {
        console.log(`🏢 Business Stage: ${enrichedContext.context_analysis.business_stage || 'Unknown'}`);
        console.log(`⚠️  Criticality: ${enrichedContext.context_analysis.criticality || 'Medium'}`);
      }
    }
  }

  /**
   * Display recommendation results
   */
  displayRecommendations(recommendations, recTime) {
    console.log(`⏱️  Generation Time: ${recTime}ms`);
    console.log(`📊 Confidence: ${(recommendations.confidence_score * 100).toFixed(1)}%`);
    
    if (recommendations.tool_recommendations && recommendations.tool_recommendations.length > 0) {
      console.log(`🛠️  Tool Recommendations (${recommendations.tool_recommendations.length}):`);
      
      recommendations.tool_recommendations.forEach((tool, i) => {
        console.log(`\n   ${i + 1}. ${tool.tool_name} (${tool.category})`);
        console.log(`      💡 Why: ${tool.reasoning}`);
        console.log(`      ⏰ Time Savings: ${tool.time_savings_hours || 0}h`);
        console.log(`      🎯 Success Rate: ${((tool.success_probability || 0) * 100).toFixed(0)}%`);
        console.log(`      💰 Cost: ${tool.cost_estimate || 'Unknown'}`);
      });
    }
    
    if (recommendations.step_by_step_guidance && recommendations.step_by_step_guidance.steps) {
      console.log(`\n📋 Step-by-Step Guide (${recommendations.step_by_step_guidance.steps.length} steps):`);
      console.log(`⏱️  Estimated Time: ${recommendations.step_by_step_guidance.total_estimated_time_hours || 0}h`);
      
      recommendations.step_by_step_guidance.steps.forEach((step, i) => {
        console.log(`\n   Step ${step.step_number}: ${step.title}`);
        console.log(`   📝 ${step.description}`);
        console.log(`   ⏰ ${step.estimated_time_minutes || 0} minutes`);
      });
    }
    
    if (recommendations.personalized_message) {
      console.log(`\n💬 Personalized Message:`);
      console.log(`   ${recommendations.personalized_message}`);
    }
  }

  /**
   * Simulate delivery to various channels
   */
  simulateDelivery(enrichedContext, recommendations) {
    console.log('📱 Would deliver to:');
    
    if (enrichedContext.assignee) {
      console.log(`   ✅ Slack DM to: ${enrichedContext.assignee}`);
    }
    
    console.log('   ✅ Desktop Dashboard');
    
    if (enrichedContext.urgency === 'high') {
      console.log('   ✅ Slack Thread (high urgency)');
    }
    
    console.log(`\n📊 Delivery Summary:`);
    console.log(`   Task ID: ${enrichedContext.task_id}`);
    console.log(`   Channels: ${enrichedContext.assignee ? '3' : '2'}`);
    console.log(`   Priority: ${enrichedContext.urgency}`);
  }

  /**
   * Run interactive testing mode
   */
  async runInteractive() {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    console.log('\n🤖 INTERACTIVE TASK INTELLIGENCE TESTER');
    console.log('=====================================');
    console.log('Enter task messages to test the AI system.');
    console.log('Type "exit" to quit, "stats" for statistics.\n');

    const askQuestion = () => {
      rl.question('Enter message to test: ', async (input) => {
        if (input.toLowerCase() === 'exit') {
          this.showStats();
          rl.close();
          return;
        }
        
        if (input.toLowerCase() === 'stats') {
          this.showStats();
          askQuestion();
          return;
        }
        
        if (input.trim()) {
          try {
            await this.testTaskMessage(input.trim());
          } catch (error) {
            console.log('Test failed, continuing...');
          }
        }
        
        askQuestion();
      });
    };

    askQuestion();
  }

  /**
   * Show testing statistics
   */
  showStats() {
    console.log('\n📊 TESTING STATISTICS');
    console.log('='.repeat(50));
    console.log(`Total Tests: ${this.testResults.length}`);
    console.log(`Successful: ${this.testResults.filter(r => r.success).length}`);
    console.log(`Failed: ${this.testResults.filter(r => !r.success).length}`);
    
    const successfulTests = this.testResults.filter(r => r.success);
    if (successfulTests.length > 0) {
      const tasksDetected = successfulTests.filter(r => r.enrichedContext?.is_task).length;
      const avgConfidence = successfulTests.reduce((sum, r) => sum + (r.enrichedContext?.confidence_score || 0), 0) / successfulTests.length;
      const recommendationsGenerated = successfulTests.filter(r => r.recommendations).length;
      
      console.log(`Tasks Detected: ${tasksDetected}/${successfulTests.length}`);
      console.log(`Average Confidence: ${(avgConfidence * 100).toFixed(1)}%`);
      console.log(`Recommendations Generated: ${recommendationsGenerated}`);
    }
    console.log('='.repeat(50));
  }

  /**
   * Test with predefined examples
   */
  async runExamples() {
    const examples = [
      "Hey John, can you follow up with Acme Corp about the contract by Friday?",
      "Sarah, please schedule a demo with the new prospect for next week",
      "Can someone update the CRM with the latest deal information?",
      "Mike, reach out to the client and get their feedback on the proposal",
      "We need to send the invoice to DXFactor by end of day",
      "Just wanted to let everyone know the meeting is at 3pm",
      "The weather is nice today",
      "Please review the document and send your comments by tomorrow"
    ];

    console.log('\n🧪 RUNNING EXAMPLE TESTS');
    console.log('='.repeat(50));

    for (let i = 0; i < examples.length; i++) {
      console.log(`\nExample ${i + 1}/${examples.length}:`);
      try {
        await this.testTaskMessage(examples[i]);
        await new Promise(resolve => setTimeout(resolve, 1000)); // Brief pause between tests
      } catch (error) {
        console.log('Example failed, continuing...');
      }
    }

    this.showStats();
  }
}

// Main execution
async function main() {
  const tester = new TaskIntelligenceSystemTester();
  const args = process.argv.slice(2);

  try {
    if (args.length === 0 || args[0] === '--interactive') {
      await tester.runInteractive();
    } else if (args[0] === '--examples') {
      await tester.runExamples();
    } else {
      // Test single message
      const message = args.join(' ');
      await tester.testTaskMessage(message);
    }
  } catch (error) {
    console.error('\n❌ Testing failed:', error.message);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n👋 Goodbye!');
  process.exit(0);
});

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

module.exports = TaskIntelligenceSystemTester;
