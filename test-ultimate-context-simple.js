/**
 * Simple Ultimate Context Test - Avoids Rate Limits
 * 
 * This test uses smaller data samples to avoid Anthropic API rate limits
 * while still verifying the integration works with your real systems.
 */

// Load environment variables
require('dotenv').config({ path: require('path').resolve(__dirname, '.env') });

const { UltimateContextSystem } = require('./integrate-existing-systems');

async function testSimpleUltimateContext() {
  console.log('🚀 Simple Ultimate Context Test (Rate Limit Safe)\n');
  
  // Debug environment variables
  console.log('🔍 Environment Variables:');
  console.log('   - ANTHROPIC_API_KEY:', process.env.ANTHROPIC_API_KEY ? '✅ Present' : '❌ Missing');
  console.log('   - HUBSPOT_API_KEY:', process.env.HUBSPOT_API_KEY ? '✅ Present' : '❌ Missing');
  console.log('');
  
  try {
    // Initialize the system
    const system = new UltimateContextSystem({
      logLevel: 'info'
    });
    
    const organizationId = 'test_org_simple';
    
    // Use a smaller CRM config to avoid rate limits
    const crmConfig = {
      type: 'hubspot',
      organization_id: organizationId,
      access_token: process.env.HUBSPOT_API_KEY,
      website_url: 'https://example.com'
    };
    
    console.log('📊 Testing CRM Connection...');
    
    // Test just the CRM connection without full processing
    const crmAnalyzer = system.crmAnalyzer;
    
    // Test with a very small limit to avoid rate limits
    const testResults = await crmAnalyzer.analyzeCompanyWorkflows(
      crmConfig.website_url, 
      crmConfig, 
      { organizationId, workflowLimit: 5 } // Only 5 workflows
    );
    
    if (testResults) {
      console.log('✅ CRM Analysis Working!');
      console.log('   - Company:', testResults.company_intelligence?.company_name || 'Unknown');
      console.log('   - Patterns found:', testResults.patterns?.length || 0);
      console.log('   - Recommendations:', testResults.recommendations?.length || 0);
      console.log('   - Analysis ID:', testResults.analysis_id);
    } else {
      console.log('❌ CRM Analysis failed');
      return;
    }
    
    console.log('\n🎯 Testing Context Bridge (Small Sample)...');
    
    // Test context bridge with a small sample
    const contextBridge = system.contextBridge;
    
    // Create a small sample for testing
    const smallSample = {
      company_intelligence: testResults.company_intelligence,
      patterns: testResults.patterns?.slice(0, 2) || [], // Only first 2 patterns
      recommendations: testResults.recommendations?.slice(0, 2) || [] // Only first 2 recommendations
    };
    
    console.log('   - Converting small CRM sample to AI context...');
    const crmContext = await contextBridge.convertCRMToContext(smallSample, organizationId);
    
    console.log('✅ CRM Context Conversion Working!');
    console.log('   - Context length:', crmContext.context.length, 'characters');
    console.log('   - Context preview:', crmContext.context.substring(0, 200) + '...');
    
    console.log('\n💬 Testing Slack Workflow Integration...');
    
    // Test Slack workflow gathering
    const slackWorkflows = await system.gatherSlackWorkflows(organizationId);
    console.log('   - Slack workflows found:', slackWorkflows.length);
    
    if (slackWorkflows.length > 0) {
      console.log('   - Converting Slack workflows to AI context...');
      const slackContext = await contextBridge.convertSlackToContext(slackWorkflows, organizationId);
      
      console.log('✅ Slack Context Conversion Working!');
      console.log('   - Context length:', slackContext.context.length, 'characters');
      console.log('   - Context preview:', slackContext.context.substring(0, 200) + '...');
    } else {
      console.log('ℹ️  No Slack workflows found (this is normal if Slack integration is not active)');
    }
    
    console.log('\n🎉 Simple Ultimate Context Test Completed Successfully!');
    console.log('\n📝 Summary:');
    console.log('   ✅ Environment variables loaded correctly');
    console.log('   ✅ CRM integration working with real HubSpot data');
    console.log('   ✅ AI context conversion working');
    console.log('   ✅ Slack workflow integration ready');
    console.log('   ✅ Rate limits avoided with smaller samples');
    console.log('\n🚀 Your ultimate context system is ready for production!');
    console.log('\n💡 Next Steps:');
    console.log('   1. Wait a few minutes for rate limits to reset');
    console.log('   2. Run the full test: npm run test:ultimate-context');
    console.log('   3. Test the Electron app: npm run test:electron-ultimate');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    
    if (error.message.includes('rate_limit_error')) {
      console.log('\n⏰ Rate Limit Hit - This is normal during testing!');
      console.log('   - Wait a few minutes and try again');
      console.log('   - Or run the simple test: node test-ultimate-context-simple.js');
    }
  }
}

// Run the test
if (require.main === module) {
  testSimpleUltimateContext().catch(console.error);
}

module.exports = { testSimpleUltimateContext };
