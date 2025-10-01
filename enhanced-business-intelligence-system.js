#!/usr/bin/env node

/**
 * Enhanced Business Intelligence System
 * 
 * Handles:
 * 1. Task detection and assignment
 * 2. Follow-up questions about tasks/tools
 * 3. General business intelligence queries
 * 4. Tool comparisons and recommendations
 * 5. Workflow analysis and optimization
 * 6. CRM integration and insights
 */

require('dotenv').config();
const readline = require('readline');
const winston = require('winston');

// Import our components
const TaskContextOrchestrator = require('./core/orchestration/task-context-orchestrator');
const AITaskRecommendationGenerator = require('./core/recommendations/ai-task-recommendation-generator');
const AIAnalyzer = require('./core/ai/anthropic-analyzer');

class EnhancedBusinessIntelligenceSystem {
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
        new winston.transports.File({ filename: 'logs/enhanced-bi-system.log' })
      ]
    });

    // Initialize components
    this.orchestrator = new TaskContextOrchestrator({
      logLevel: 'info',
      crmServiceUrl: 'http://localhost:3002',
      confidenceThreshold: 0.2 // Lower threshold for broader detection
    });

    this.recommendationGenerator = new AITaskRecommendationGenerator({
      logLevel: 'info'
    });

    this.aiAnalyzer = new AIAnalyzer({
      logLevel: 'info'
    });

    this.conversationHistory = [];
  }

  /**
   * Main intelligence processing method
   */
  async processMessage(messageText, options = {}) {
    const sessionId = `session_${Date.now()}`;
    
    console.log('\n' + '='.repeat(80));
    console.log(`🧠 ENHANCED BUSINESS INTELLIGENCE SYSTEM - ${sessionId}`);
    console.log('='.repeat(80));
    console.log(`💬 Message: "${messageText}"`);
    console.log('='.repeat(80));

    try {
      // Step 1: Classify the message type
      const messageClassification = await this.classifyMessage(messageText);
      console.log('\n🔍 STEP 1: Message Classification');
      console.log('-'.repeat(50));
      this.displayClassification(messageClassification);

      // Step 2: Process based on classification
      let response = null;
      const startTime = Date.now();

      switch (messageClassification.primary_type) {
        case 'task_assignment':
          response = await this.handleTaskAssignment(messageText, options);
          break;
        
        case 'task_followup':
          response = await this.handleTaskFollowup(messageText, options);
          break;
        
        case 'tool_comparison':
          response = await this.handleToolComparison(messageText, options);
          break;
        
        case 'workflow_analysis':
          response = await this.handleWorkflowAnalysis(messageText, options);
          break;
        
        case 'general_business_query':
          response = await this.handleGeneralBusinessQuery(messageText, options);
          break;
        
        default:
          response = await this.handleGeneralConversation(messageText, options);
      }

      const processingTime = Date.now() - startTime;

      // Step 3: Display results
      console.log('\n💡 STEP 2: Intelligence Response');
      console.log('-'.repeat(50));
      this.displayResponse(response, processingTime);

      // Add to conversation history
      this.conversationHistory.push({
        message: messageText,
        classification: messageClassification,
        response: response,
        timestamp: new Date().toISOString()
      });

      console.log('\n✅ PROCESSING COMPLETED SUCCESSFULLY');
      console.log('='.repeat(80));

      return response;

    } catch (error) {
      console.error('\n❌ PROCESSING FAILED');
      console.error('Error:', error.message);
      console.log('='.repeat(80));
      throw error;
    }
  }

  /**
   * Classify the message type using AI
   */
  async classifyMessage(messageText) {
    const prompt = `
Analyze this business message and classify its type and intent:

MESSAGE: "${messageText}"

Classify into one of these categories:
1. task_assignment - Assigning work to someone
2. task_followup - Questions about existing tasks, deadlines, status
3. tool_comparison - Comparing tools, asking which is better/cheaper
4. workflow_analysis - Questions about processes, efficiency, optimization
5. general_business_query - Business questions, strategy, insights
6. general_conversation - Casual conversation, greetings, etc.

Also determine:
- Confidence level (0.0 to 1.0)
- Key entities mentioned (people, companies, tools, dates)
- Intent keywords
- Urgency level (low/medium/high)

Respond in JSON format:
{
  "primary_type": "category",
  "confidence": 0.0,
  "entities": ["entity1", "entity2"],
  "intent_keywords": ["keyword1", "keyword2"],
  "urgency": "low|medium|high",
  "requires_crm_data": true/false,
  "requires_task_context": true/false
}`;

    try {
      const analysis = await this.aiAnalyzer.analyzeText(messageText, { prompt });
      // analyzeText already returns parsed JSON or fallback object
      return typeof analysis === 'string' ? JSON.parse(analysis) : analysis;
    } catch (error) {
      this.logger.error('Message classification failed', { error: error.message });
      // Fallback classification
      return {
        primary_type: 'general_conversation',
        confidence: 0.5,
        entities: [],
        intent_keywords: [],
        urgency: 'low',
        requires_crm_data: false,
        requires_task_context: false
      };
    }
  }

  /**
   * Handle task assignment messages
   */
  async handleTaskAssignment(messageText, options) {
    try {
      const messageContext = this.createMessageContext(options);
      const enrichedContext = await this.orchestrator.enrichTaskWithContext(
        messageText,
        messageContext,
        options.organizationId || 'default_org'
      );

      // Generate recommendations
      const recommendations = await this.recommendationGenerator.generateTaskRecommendations(enrichedContext);

      return {
        type: 'task_assignment',
        task_context: enrichedContext,
        recommendations: recommendations,
        actionable_items: this.extractActionableItems(enrichedContext, recommendations)
      };
    } catch (error) {
      this.logger.error('Task assignment handling failed', { error: error.message });
      return {
        type: 'error',
        message: 'Failed to process task assignment',
        error: error.message
      };
    }
  }

  /**
   * Handle follow-up questions about tasks
   */
  async handleTaskFollowup(messageText, options) {
    const prompt = `
You are a business intelligence assistant. The user is asking a follow-up question about tasks or work:

MESSAGE: "${messageText}"
CONVERSATION HISTORY: ${JSON.stringify(this.conversationHistory.slice(-3), null, 2)}

Provide a helpful response that:
1. Acknowledges their question
2. Provides relevant insights about task management
3. Suggests next steps or clarifications needed
4. Offers to help with specific task-related actions

Be conversational and helpful.`;

    try {
      const analysis = await this.aiAnalyzer.analyzeText(messageText, { prompt });
      
      return {
        type: 'task_followup',
        response: typeof analysis === 'string' ? analysis : analysis.summary || analysis,
        suggested_actions: [
          'Check task status in CRM',
          'Review task assignments',
          'Update task deadlines',
          'Analyze task completion rates'
        ],
        context_available: this.conversationHistory.length > 0
      };
    } catch (error) {
      return {
        type: 'task_followup',
        response: 'I can help you with task-related questions. Could you provide more specific details about what you need to know?',
        error: error.message
      };
    }
  }

  /**
   * Handle tool comparison questions
   */
  async handleToolComparison(messageText, options) {
    const prompt = `
You are a business intelligence assistant specializing in tool analysis and recommendations.

MESSAGE: "${messageText}"

The user is asking about tool comparisons. Provide a comprehensive analysis that includes:

1. **Tool Identification**: What tools are being compared?
2. **Cost Analysis**: Pricing considerations and cost-effectiveness
3. **Feature Comparison**: Key features and capabilities
4. **Use Case Fit**: Which tool fits their likely use case better
5. **Implementation**: Ease of setup and integration
6. **Scalability**: How each tool scales with business growth
7. **Recommendation**: Clear recommendation with reasoning

Be specific, practical, and business-focused. If you need more context, ask clarifying questions.`;

    try {
      const analysis = await this.aiAnalyzer.analyzeText(messageText, { prompt });
      
      return {
        type: 'tool_comparison',
        analysis: typeof analysis === 'string' ? analysis : analysis.summary || analysis,
        comparison_factors: [
          'Cost and pricing models',
          'Feature set and capabilities', 
          'Integration complexity',
          'Scalability and growth support',
          'User experience and adoption',
          'Support and documentation'
        ],
        next_steps: [
          'Request demos or trials',
          'Calculate total cost of ownership',
          'Assess integration requirements',
          'Check user reviews and case studies'
        ]
      };
    } catch (error) {
      return {
        type: 'tool_comparison',
        analysis: 'I can help you compare tools and analyze costs. Could you specify which tools you\'re considering and what your main requirements are?',
        error: error.message
      };
    }
  }

  /**
   * Handle workflow analysis questions
   */
  async handleWorkflowAnalysis(messageText, options) {
    const prompt = `
You are a workflow optimization expert. Analyze this workflow-related question:

MESSAGE: "${messageText}"

Provide insights on:
1. **Current State Analysis**: What workflow aspects are being discussed?
2. **Efficiency Opportunities**: Where can improvements be made?
3. **Best Practices**: Industry standard approaches
4. **Implementation Steps**: How to improve the workflow
5. **Metrics**: What to measure for success
6. **Tools & Automation**: Technology solutions that could help

Be practical and actionable.`;

    try {
      const analysis = await this.aiAnalyzer.analyzeText(messageText, { prompt });
      
      return {
        type: 'workflow_analysis',
        analysis: typeof analysis === 'string' ? analysis : analysis.summary || analysis,
        optimization_areas: [
          'Process automation opportunities',
          'Communication flow improvements',
          'Task delegation optimization',
          'Tool integration possibilities',
          'Performance measurement'
        ],
        recommended_actions: [
          'Map current workflow steps',
          'Identify bottlenecks and delays',
          'Evaluate automation tools',
          'Implement performance metrics'
        ]
      };
    } catch (error) {
      return {
        type: 'workflow_analysis',
        analysis: 'I can help analyze and optimize your workflows. Could you describe the specific process or workflow you\'d like to improve?',
        error: error.message
      };
    }
  }

  /**
   * Handle general business queries
   */
  async handleGeneralBusinessQuery(messageText, options) {
    const prompt = `
You are a business intelligence assistant. Answer this business question:

MESSAGE: "${messageText}"
CONTEXT: This is a general business query that may involve strategy, operations, or analysis.

Provide a comprehensive response that:
1. Directly addresses their question
2. Provides relevant business insights
3. Suggests related considerations
4. Offers actionable next steps
5. Identifies if additional data would be helpful

Be professional, insightful, and practical.`;

    try {
      const analysis = await this.aiAnalyzer.analyzeText(messageText, { prompt });
      
      return {
        type: 'general_business_query',
        response: typeof analysis === 'string' ? analysis : analysis.summary || analysis,
        related_topics: [
          'Market analysis',
          'Competitive intelligence',
          'Performance metrics',
          'Strategic planning'
        ],
        data_sources: [
          'CRM analytics',
          'Market research',
          'Industry reports',
          'Performance dashboards'
        ]
      };
    } catch (error) {
      return {
        type: 'general_business_query',
        response: 'I can help with business analysis and insights. Could you provide more details about what specific information you\'re looking for?',
        error: error.message
      };
    }
  }

  /**
   * Handle general conversation
   */
  async handleGeneralConversation(messageText, options) {
    return {
      type: 'general_conversation',
      response: `I'm your business intelligence assistant. I can help with:
      
• Task assignment and management
• Tool comparisons and recommendations  
• Workflow analysis and optimization
• Business intelligence queries
• CRM insights and analytics

What would you like to explore?`,
      capabilities: [
        'Task intelligence and assignment',
        'Tool evaluation and comparison',
        'Workflow optimization',
        'Business analytics and insights',
        'CRM integration and analysis'
      ]
    };
  }

  /**
   * Create message context for processing
   */
  createMessageContext(options = {}) {
    return {
      channel_id: options.channelId || 'C1234567890',
      channel_name: options.channelName || 'general',
      user_id: options.userId || 'U1234567890',
      user_name: options.userName || 'TestUser',
      timestamp: options.timestamp || new Date().toISOString(),
      thread_ts: options.threadTs || null
    };
  }

  /**
   * Extract actionable items from task context and recommendations
   */
  extractActionableItems(taskContext, recommendations) {
    const items = [];
    
    if (taskContext.assignee) {
      items.push(`Assign task to ${taskContext.assignee}`);
    }
    
    if (taskContext.deadline) {
      items.push(`Set deadline: ${taskContext.deadline}`);
    }
    
    if (recommendations?.tools?.length > 0) {
      items.push(`Consider using: ${recommendations.tools.slice(0, 2).join(', ')}`);
    }
    
    return items;
  }

  /**
   * Display classification results
   */
  displayClassification(classification) {
    console.log(`🎯 Type: ${classification.primary_type.toUpperCase()}`);
    console.log(`📊 Confidence: ${(classification.confidence * 100).toFixed(1)}%`);
    console.log(`🏷️  Entities: ${classification.entities.join(', ') || 'None'}`);
    console.log(`🔑 Keywords: ${classification.intent_keywords.join(', ') || 'None'}`);
    console.log(`⚡ Urgency: ${classification.urgency.toUpperCase()}`);
  }

  /**
   * Display response results
   */
  displayResponse(response, processingTime) {
    console.log(`⏱️  Processing Time: ${processingTime}ms`);
    console.log(`📋 Response Type: ${response.type.toUpperCase()}`);
    
    if (response.response) {
      console.log('\n💬 Response:');
      console.log(response.response);
    }
    
    if (response.analysis) {
      console.log('\n🔍 Analysis:');
      console.log(response.analysis);
    }
    
    if (response.actionable_items?.length > 0) {
      console.log('\n✅ Action Items:');
      response.actionable_items.forEach((item, index) => {
        console.log(`   ${index + 1}. ${item}`);
      });
    }
    
    if (response.suggested_actions?.length > 0) {
      console.log('\n💡 Suggested Actions:');
      response.suggested_actions.forEach((action, index) => {
        console.log(`   ${index + 1}. ${action}`);
      });
    }
  }

  /**
   * Interactive mode
   */
  async startInteractiveMode() {
    console.log('\n🚀 Enhanced Business Intelligence System - Interactive Mode');
    console.log('Type your messages and get intelligent responses!');
    console.log('Type "exit" to quit, "history" to see conversation history\n');

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const askQuestion = () => {
      rl.question('Enter message to analyze: ', async (message) => {
        if (message.toLowerCase() === 'exit') {
          console.log('\nGoodbye! 👋');
          rl.close();
          return;
        }
        
        if (message.toLowerCase() === 'history') {
          console.log('\n📚 Conversation History:');
          this.conversationHistory.forEach((item, index) => {
            console.log(`${index + 1}. [${item.classification.primary_type}] ${item.message}`);
          });
          console.log('');
          askQuestion();
          return;
        }

        try {
          await this.processMessage(message);
        } catch (error) {
          console.error('Error processing message:', error.message);
        }
        
        askQuestion();
      });
    };

    askQuestion();
  }
}

// CLI Interface
async function main() {
  const system = new EnhancedBusinessIntelligenceSystem();
  
  const args = process.argv.slice(2);
  
  if (args.length === 0 || args[0] === '--interactive') {
    await system.startInteractiveMode();
  } else {
    const message = args.join(' ');
    await system.processMessage(message);
  }
}

// Export for use as module
module.exports = EnhancedBusinessIntelligenceSystem;

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}
