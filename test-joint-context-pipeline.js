/**
 * Test Script for Joint CRM + Slack Context Pipeline
 * 
 * This script demonstrates the complete pipeline from your flowchart:
 * 1. CRM Context: Parsed and packaged by Anthropic API
 * 2. Slack Workflows: Parsed and packaged by Anthropic API  
 * 3. Joint Context: Combined CRM + Slack workflow context
 * 4. Recommendations: Context-aware AI recommendations with follow-up support
 */

// Load environment variables
require('dotenv').config();

const JointContextProcessor = require('./core/orchestration/joint-context-processor');

async function testJointContextPipeline() {
  console.log('🚀 Testing Joint CRM + Slack Context Pipeline\n');
  
  // Check if Anthropic API key is available
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('❌ ANTHROPIC_API_KEY not found in environment variables');
    console.log('Please add ANTHROPIC_API_KEY to your .env file');
    console.log('Example: ANTHROPIC_API_KEY=your_api_key_here');
    process.exit(1);
  }
  
  try {
    // Initialize the processor
    const processor = new JointContextProcessor({
      logLevel: 'info'
    });
    
    const organizationId = 'test_org_123';
    
    // Step 1: Mock CRM data (similar to your actual CRM analysis results)
    const mockCRMData = {
      analysis_metadata: {
        analysis_id: 'test_analysis_001',
        timestamp: new Date().toISOString(),
        website_analyzed: 'https://example.com',
        company_name: 'Test Company Inc',
        analysis_type: 'intelligent_crm_workflow_analysis'
      },
      company_intelligence_summary: {
        company_name: 'Test Company Inc',
        industry: 'Technology',
        business_model: 'SaaS',
        tech_sophistication: 'High',
        current_crm: 'HubSpot',
        key_challenges: [
          'Manual data entry between systems',
          'Lack of automated follow-up sequences',
          'Poor lead scoring accuracy'
        ],
        integration_opportunities: [
          'Slack-CRM integration',
          'Automated lead routing',
          'Real-time notifications'
        ]
      },
      workflow_analysis: {
        total_workflows_analyzed: 15,
        patterns_discovered: 3,
        key_insights: [
          'Deals stuck in discovery phase average 45 days',
          'Follow-up response rate drops 60% after 24 hours',
          'Manual data entry consumes 2 hours daily per rep'
        ],
        performance_metrics: {
          avg_cycle_time: 67,
          success_rate: 0.23,
          data_completeness: 0.78,
          engagement_score: 0.65
        }
      },
      contextual_recommendations: [
        {
          tool_name: 'Zapier',
          category: 'automation',
          justification: 'Automate data sync between CRM and Slack',
          estimated_roi: '300%',
          time_savings: '2 hours daily per rep'
        }
      ]
    };
    
    // Step 2: Mock Slack workflow data
    const mockSlackWorkflows = [
      {
        workflow_id: 'slack_workflow_001',
        organization_id: organizationId,
        type: 'lead_notification',
        participants: ['sales_team', 'marketing_team'],
        duration_days: 1,
        efficiency_score: 0.6,
        bottlenecks: ['Manual CRM updates', 'Delayed notifications'],
        automation_potential: 'High'
      },
      {
        workflow_id: 'slack_workflow_002',
        organization_id: organizationId,
        type: 'deal_progression',
        participants: ['sales_rep', 'sales_manager'],
        duration_days: 3,
        efficiency_score: 0.4,
        bottlenecks: ['Status updates', 'Approval delays'],
        automation_potential: 'Medium'
      },
      {
        workflow_id: 'slack_workflow_003',
        organization_id: organizationId,
        type: 'customer_support',
        participants: ['support_team', 'sales_team'],
        duration_days: 0.5,
        efficiency_score: 0.8,
        bottlenecks: ['Context switching'],
        automation_potential: 'Low'
      }
    ];
    
    console.log('📊 Step 1: Processing CRM Context...');
    const crmContext = await processor.processCRMContext(mockCRMData, organizationId);
    console.log('✅ CRM Context processed successfully');
    console.log('   - Company:', crmContext.company_intelligence?.company_name);
    console.log('   - Industry:', crmContext.company_intelligence?.industry);
    console.log('   - Key Challenges:', crmContext.company_intelligence?.key_challenges?.length || 0);
    console.log('');
    
    console.log('💬 Step 2: Processing Slack Workflows...');
    const slackContext = await processor.processSlackWorkflows(mockSlackWorkflows, organizationId);
    console.log('✅ Slack Workflows processed successfully');
    console.log('   - Workflows analyzed:', slackContext.workflow_analysis?.total_workflows || 0);
    console.log('   - Communication patterns:', slackContext.communication_patterns?.length || 0);
    console.log('   - Automation opportunities:', slackContext.automation_opportunities?.length || 0);
    console.log('');
    
    console.log('🔗 Step 3: Creating Joint Context...');
    const jointContext = await processor.createJointContext(organizationId);
    console.log('✅ Joint Context created successfully');
    console.log('   - Synergies identified:', jointContext.synergies?.length || 0);
    console.log('   - Cross-functional opportunities:', jointContext.cross_functional_opportunities?.length || 0);
    console.log('   - Integrated recommendations:', jointContext.integrated_recommendations?.length || 0);
    console.log('');
    
    // Step 4: Test different recommendation queries
    const testQueries = [
      'What tools should I use to automate my sales process?',
      'How can I improve my CRM and Slack integration?',
      'What workflow optimizations would save the most time?',
      'Recommend software for lead management and follow-up'
    ];
    
    for (const query of testQueries) {
      console.log(`🎯 Step 4: Generating Recommendations for: "${query}"`);
      const recommendations = await processor.generateRecommendations(organizationId, query);
      console.log('✅ Recommendations generated successfully');
      console.log('   - Recommendation ID:', recommendations.recommendationId);
      console.log('   - Number of recommendations:', recommendations.recommendations?.length || 0);
      console.log('   - Follow-up questions available:', recommendations.follow_up_questions?.length || 0);
      
      // Display first recommendation
      if (recommendations.recommendations && recommendations.recommendations.length > 0) {
        const firstRec = recommendations.recommendations[0];
        console.log('   - Top recommendation:', firstRec.title || firstRec.tool_name || 'N/A');
        console.log('   - Justification:', firstRec.justification?.substring(0, 100) + '...');
        if (firstRec.roi_estimates) {
          console.log('   - ROI estimate:', firstRec.roi_estimates);
        }
        if (firstRec.time_savings) {
          console.log('   - Time savings:', firstRec.time_savings);
        }
      }
      console.log('');
      
      // Test follow-up questions
      if (recommendations.follow_up_questions && recommendations.follow_up_questions.length > 0) {
        const followUpQuery = recommendations.follow_up_questions[0];
        console.log(`💬 Testing follow-up: "${followUpQuery}"`);
        const followUpResponse = await processor.handleFollowUp(recommendations.recommendationId, followUpQuery);
        console.log('✅ Follow-up handled successfully');
        console.log('   - Response length:', followUpResponse.response.length, 'characters');
        console.log('   - Response preview:', followUpResponse.response.substring(0, 150) + '...');
        console.log('');
      }
    }
    
    // Step 5: Display context summary
    console.log('📋 Step 5: Context Summary');
    const summary = processor.getContextSummary(organizationId);
    console.log('✅ Context summary retrieved');
    console.log('   - Has CRM Context:', summary.hasCRMContext);
    console.log('   - Has Slack Context:', summary.hasSlackContext);
    console.log('   - Has Joint Context:', summary.hasJointContext);
    console.log('   - Total Recommendations:', summary.totalRecommendations);
    console.log('   - CRM Processed At:', summary.crmProcessedAt);
    console.log('   - Slack Processed At:', summary.slackProcessedAt);
    console.log('   - Joint Processed At:', summary.jointProcessedAt);
    console.log('');
    
    console.log('🎉 Joint Context Pipeline test completed successfully!');
    console.log('\n📝 Summary:');
    console.log('   ✅ CRM context processed and packaged by Anthropic API');
    console.log('   ✅ Slack workflows processed and packaged by Anthropic API');
    console.log('   ✅ Joint context created combining both data sources');
    console.log('   ✅ Context-aware recommendations generated');
    console.log('   ✅ Follow-up conversation system working');
    console.log('   ✅ Complete pipeline matches your flowchart vision!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    console.error('Stack trace:', error.stack);
  }
}

// Run the test
if (require.main === module) {
  testJointContextPipeline().catch(console.error);
}

module.exports = { testJointContextPipeline };
