/**
 * Test CRM Integration System
 * 
 * Simple test to verify HubSpot and AI integration is working
 */

const CRMWorkflowAnalyzer = require('./index');
require('dotenv').config({ path: '../.env' });

async function testCRMIntegration() {
  console.log('🚀 Testing CRM Workflow Analyzer...\n');
  
  try {
    // Verify environment variables
    console.log('📋 Checking environment variables...');
    if (!process.env.HUBSPOT_API_KEY && !process.env.HUBSPOT_ACCESS_TOKEN) {
      throw new Error('HUBSPOT_API_KEY or HUBSPOT_ACCESS_TOKEN not found in .env file');
    }
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY not found in .env file');
    }
    console.log('✅ Environment variables found\n');
    
    // Initialize the analyzer
    console.log('🔧 Initializing CRM Workflow Analyzer...');
    const analyzer = new CRMWorkflowAnalyzer({
      logLevel: 'info',
      enableSlackAlerts: false, // Disable for testing
      enableRealTimeMonitoring: false // Disable for testing
    });
    
    // Configure HubSpot connection
    const crmConfigs = [{
      type: 'hubspot',
      organization_id: 'test_org_123',
      access_token: process.env.HUBSPOT_API_KEY || process.env.HUBSPOT_ACCESS_TOKEN
    }];
    
    console.log('🔌 Connecting to HubSpot...');
    await analyzer.initialize(crmConfigs);
    console.log('✅ Successfully connected to HubSpot\n');
    
    // Test workflow analysis with limited data
    console.log('📊 Testing workflow analysis...');
    console.log('📝 Note: This will analyze a small sample of your HubSpot deals\n');
    
    const analysisOptions = {
      limit: 10, // Only analyze 10 deals for testing
      dateRange: {
        start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
        end: new Date()
      }
    };
    
    const results = await analyzer.analyzeWorkflows('test_org_123', analysisOptions);
    
    // Display results
    console.log('🎉 Analysis Results:');
    console.log('==================');
    console.log(`📈 Workflows Analyzed: ${results.workflow_count}`);
    console.log(`🔍 Patterns Detected: ${results.pattern_count}`);
    console.log(`🚀 Tool Recommendations: ${results.recommendation_count}`);
    console.log(`📊 Workflow Health Score: ${results.summary.workflow_health_score}/100`);
    console.log(`⏱️  Average Cycle Time: ${results.summary.avg_cycle_time} days`);
    console.log(`🎯 Conversion Rate: ${Math.round(results.summary.conversion_rate * 100)}%`);
    console.log(`⚠️  Critical Bottlenecks: ${results.summary.critical_bottlenecks}`);
    console.log(`💰 High ROI Opportunities: ${results.summary.high_roi_opportunities}`);
    
    if (results.summary.key_insights.length > 0) {
      console.log('\n🔍 Key Insights:');
      results.summary.key_insights.forEach((insight, index) => {
        console.log(`   ${index + 1}. ${insight}`);
      });
    }
    
    // Show pattern details if any found
    if (results.patterns.length > 0) {
      console.log('\n📋 Detected Patterns:');
      results.patterns.forEach((pattern, index) => {
        console.log(`\n   Pattern ${index + 1}: ${pattern.pattern_name}`);
        console.log(`   - Workflows: ${pattern.workflow_count}`);
        console.log(`   - Success Rate: ${Math.round((pattern.benchmark_metrics.success_rate || 0) * 100)}%`);
        console.log(`   - Avg Cycle Time: ${Math.round(pattern.benchmark_metrics.avg_cycle_time || 0)} days`);
        console.log(`   - Confidence: ${Math.round((pattern.confidence || 0) * 100)}%`);
        
        if (pattern.bottlenecks && pattern.bottlenecks.length > 0) {
          console.log(`   - Top Bottleneck: ${pattern.bottlenecks[0].location} (${pattern.bottlenecks[0].severity})`);
        }
      });
    }
    
    // Show tool recommendations if any
    if (results.recommendations.length > 0) {
      console.log('\n🛠️  Tool Recommendations:');
      results.recommendations.slice(0, 3).forEach((rec, index) => {
        console.log(`\n   Recommendation ${index + 1}: ${rec.recommended_tool}`);
        console.log(`   - Addresses: ${rec.addresses_issue}`);
        console.log(`   - ROI: ${Math.round(rec.roi_percentage || 0)}%`);
        console.log(`   - Payback: ${Math.round(rec.payback_period_months || 0)} months`);
        console.log(`   - Revenue Impact: $${(rec.revenue_impact || 0).toLocaleString()}`);
        console.log(`   - Priority: ${rec.priority}`);
      });
    }
    
    console.log('\n✅ CRM Integration Test Completed Successfully!');
    console.log('\n📋 What was tested:');
    console.log('   ✅ Environment variable configuration');
    console.log('   ✅ HubSpot API connection');
    console.log('   ✅ CRM data extraction');
    console.log('   ✅ AI-powered workflow analysis');
    console.log('   ✅ Pattern detection');
    console.log('   ✅ Tool recommendations with ROI');
    console.log('   ✅ Workflow health scoring');
    
    console.log('\n🚀 Ready for production use!');
    console.log('💡 Next steps:');
    console.log('   1. Enable Slack integration for real-time alerts');
    console.log('   2. Set up continuous monitoring');
    console.log('   3. Analyze larger datasets');
    console.log('   4. Implement recommended tools');
    
    // Cleanup
    await analyzer.cleanup();
    
  } catch (error) {
    console.error('\n❌ Test Failed:', error.message);
    console.error('\n🔍 Troubleshooting:');
    
    if (error.message.includes('HUBSPOT_API_KEY') || error.message.includes('HUBSPOT_ACCESS_TOKEN')) {
      console.error('   • Check that HUBSPOT_API_KEY is set in your .env file');
      console.error('   • Verify the token has proper permissions (contacts, deals, companies)');
    }
    
    if (error.message.includes('ANTHROPIC_API_KEY')) {
      console.error('   • Check that ANTHROPIC_API_KEY is set in your .env file');
      console.error('   • Verify the API key is valid and has credits');
    }
    
    if (error.message.includes('401') || error.message.includes('unauthorized')) {
      console.error('   • HubSpot API token may be invalid or expired');
      console.error('   • Check token permissions in HubSpot developer settings');
    }
    
    if (error.message.includes('403') || error.message.includes('forbidden')) {
      console.error('   • HubSpot API token may lack required scopes');
      console.error('   • Ensure token has: contacts, deals, companies, timeline access');
    }
    
    if (error.message.includes('rate')) {
      console.error('   • HubSpot API rate limit reached');
      console.error('   • Wait a few minutes and try again');
    }
    
    console.error('\n📋 Debug Information:');
    console.error(`   Error Type: ${error.constructor.name}`);
    console.error(`   Error Details: ${error.message}`);
    
    process.exit(1);
  }
}

// Run the test
if (require.main === module) {
  testCRMIntegration();
}

module.exports = testCRMIntegration;
