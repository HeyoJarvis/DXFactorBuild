/**
 * Test Personalized Analysis - Run analysis with DxFactor company intelligence
 * 
 * This test runs the full CRM analysis pipeline using the DxFactor company
 * intelligence to generate personalized recommendations that should be
 * different from the generic recommendations.
 */

require('dotenv').config({ path: '../.env' });
const { Client } = require('@hubspot/api-client');
const fs = require('fs').promises;
const path = require('path');

// Import the CRM analyzer
const CRMWorkflowAnalyzer = require('./index');

async function testPersonalizedAnalysis() {
  console.log('🎯 Running PERSONALIZED CRM Analysis with DxFactor Intelligence...\n');
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const resultsDir = path.join(__dirname, 'analysis-results');
  
  // Ensure results directory exists
  try {
    await fs.mkdir(resultsDir, { recursive: true });
  } catch (error) {
    // Directory might already exist
  }

  try {
    // Initialize the CRM analyzer
    console.log('🔧 Initializing CRM Workflow Analyzer...');
    const analyzer = new CRMWorkflowAnalyzer({ logLevel: 'error' });

    // Add HubSpot adapter with DxFactor organization ID
    const hubspotConfig = {
      organization_id: 'dxfactor_com',
      type: 'hubspot',
      access_token: process.env.HUBSPOT_API_KEY || process.env.HUBSPOT_ACCESS_TOKEN,
      base_url: 'https://api.hubapi.com'
    };

    console.log('🔌 Adding HubSpot adapter for DxFactor...');
    await analyzer.addCRMAdapter(hubspotConfig);

    // Test organization context loading
    console.log('📊 Loading DxFactor organization context...');
    const orgContext = await analyzer.getOrganizationContext('dxfactor_com');
    console.log('✅ Organization Context:');
    console.log(`   🏢 Company: ${orgContext.organization_id}`);
    console.log(`   🏭 Industry: ${orgContext.industry}`);
    console.log(`   📏 Size: ${orgContext.company_size}`);
    console.log(`   💼 Business Model: ${orgContext.business_model}`);
    console.log(`   🎯 Sales Complexity: ${orgContext.sales_complexity}`);
    console.log(`   💻 Tech Sophistication: ${orgContext.tech_sophistication}`);
    console.log(`   🤖 Automation Gaps: ${orgContext.automation_gaps?.join(', ') || 'None'}`);
    console.log(`   🔗 Integration Needs: ${orgContext.integration_needs?.slice(0, 3).join(', ') || 'None'}${orgContext.integration_needs?.length > 3 ? '...' : ''}`);

    // Run the workflow analysis with DxFactor context
    console.log('\n🔍 Running workflow analysis with DxFactor intelligence...');
    const analysisResults = await analyzer.analyzeWorkflows('dxfactor_com', {
      limit: 50,
      dateRange: {
        start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
        end: new Date()
      }
    });

    // Save the personalized results
    const personalizedResults = {
      metadata: {
        timestamp: new Date().toISOString(),
        test_type: 'personalized_dxfactor_analysis',
        system_version: '1.0.0',
        organization_id: 'dxfactor_com',
        company_intelligence_used: true,
        analysis_duration_ms: Date.now() - Date.now()
      },
      organization_context: orgContext,
      analysis_results: analysisResults,
      personalization_summary: {
        company_name: 'DXFactor',
        industry: orgContext.industry,
        company_size: orgContext.company_size,
        business_model: orgContext.business_model,
        automation_gaps_count: orgContext.automation_gaps?.length || 0,
        integration_needs_count: orgContext.integration_needs?.length || 0,
        manual_processes_count: orgContext.manual_processes?.length || 0
      }
    };

    // Save results
    const filename = `personalized-analysis-dxfactor-${timestamp}.json`;
    const filepath = path.join(resultsDir, filename);
    
    await fs.writeFile(filepath, JSON.stringify(personalizedResults, null, 2));
    
    console.log('\n🎉 PERSONALIZED ANALYSIS RESULTS:');
    console.log('=====================================');
    console.log(`📊 Workflows analyzed: ${analysisResults.workflows?.length || 0}`);
    console.log(`🔍 Patterns detected: ${analysisResults.patterns?.length || 0}`);
    console.log(`🚀 Recommendations: ${analysisResults.recommendations?.length || 0}`);
    console.log(`📈 Health Score: ${analysisResults.healthScore || 'N/A'}`);
    
    if (analysisResults.recommendations && analysisResults.recommendations.length > 0) {
      console.log('\n💡 PERSONALIZED RECOMMENDATIONS:');
      analysisResults.recommendations.forEach((rec, index) => {
        console.log(`   ${index + 1}. ${rec.tool || rec.title || rec.name}`);
        console.log(`      Category: ${rec.category || 'General'}`);
        console.log(`      Reasoning: ${rec.reasoning || rec.description || 'No reasoning provided'}`);
        console.log('');
      });
    }

    console.log(`\n💾 Results saved to: ${filename}`);
    console.log('✅ Personalized analysis completed successfully!');

    return personalizedResults;

  } catch (error) {
    console.error('❌ Personalized analysis failed:', error);
    throw error;
  }
}

// Run the test
if (require.main === module) {
  testPersonalizedAnalysis()
    .then(() => {
      console.log('\n🎯 Test completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Test failed:', error.message);
      process.exit(1);
    });
}

module.exports = testPersonalizedAnalysis;
