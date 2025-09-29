/**
 * Test the Intelligent CRM Analyzer - Complete workflow from website to recommendations
 */

require('dotenv').config({ path: '../.env' });
const IntelligentCRMAnalyzer = require('./intelligent-crm-analyzer');

async function testIntelligentAnalysis() {
  console.log('🚀 TESTING INTELLIGENT CRM ANALYZER');
  console.log('='.repeat(60));
  
  try {
    // Initialize the analyzer
    const analyzer = new IntelligentCRMAnalyzer({
      logLevel: 'info',
      pythonPath: '../company-intelligence-py',
      outputDir: './analysis-results'
    });

    // Test configuration
    const websiteUrl = 'https://dxfactor.com'; // Company to analyze
    const crmConfig = {
      type: 'hubspot',
      access_token: process.env.HUBSPOT_API_KEY,
      organization_id: 'dxfactor_intelligent_analysis',
      dealProperties: [
        'amount', 'dealname', 'dealstage', 'pipeline', 'createdate', 
        'hs_lastmodifieddate', 'closedate', 'dealtype', 'hs_analytics_source', 
        'hs_deal_stage_probability', 'num_associated_contacts'
      ],
      contactProperties: [
        'firstname', 'lastname', 'email', 'jobtitle', 'company', 'phone', 
        'hs_lead_status', 'lifecyclestage', 'createdate'
      ],
      companyProperties: [
        'name', 'domain', 'industry', 'numberofemployees', 'annualrevenue', 
        'city', 'state', 'country', 'type', 'createdate'
      ]
    };

    const analysisOptions = {
      workflowLimit: 20, // Analyze 20 workflows for comprehensive patterns
      includeArchived: false // Focus on active deals
    };

    console.log('\n📋 ANALYSIS CONFIGURATION');
    console.log('-'.repeat(40));
    console.log(`🌐 Website: ${websiteUrl}`);
    console.log(`🔧 CRM: HubSpot`);
    console.log(`📊 Workflow Limit: ${analysisOptions.workflowLimit}`);
    console.log(`🎯 Analysis Type: Complete Intelligence + CRM Analysis`);

    // Run the complete analysis
    console.log('\n🎯 STARTING COMPLETE ANALYSIS...');
    console.log('-'.repeat(40));
    
    const startTime = Date.now();
    const analysisReport = await analyzer.analyzeCompanyWorkflows(
      websiteUrl, 
      crmConfig, 
      analysisOptions
    );
    const analysisTime = (Date.now() - startTime) / 1000;

    // Display results
    console.log('\n✅ ANALYSIS COMPLETE!');
    console.log('='.repeat(60));
    console.log(`⏱️  Total Analysis Time: ${analysisTime.toFixed(2)} seconds`);
    
    console.log('\n📊 COMPANY INTELLIGENCE SUMMARY');
    console.log('-'.repeat(40));
    const compSummary = analysisReport.company_intelligence_summary;
    console.log(`🏢 Company: ${compSummary.company_name}`);
    console.log(`🏭 Industry: ${compSummary.industry}`);
    console.log(`💼 Business Model: ${compSummary.business_model}`);
    console.log(`🔧 Tech Level: ${compSummary.tech_sophistication}`);
    console.log(`💾 Current CRM: ${compSummary.current_crm}`);
    
    if (compSummary.key_challenges?.length > 0) {
      console.log(`\n🚨 Key Challenges Identified:`);
      compSummary.key_challenges.forEach((challenge, i) => {
        console.log(`   ${i + 1}. ${challenge}`);
      });
    }
    
    if (compSummary.integration_opportunities?.length > 0) {
      console.log(`\n🔗 Integration Opportunities:`);
      compSummary.integration_opportunities.forEach((opp, i) => {
        console.log(`   ${i + 1}. ${opp}`);
      });
    }

    console.log('\n🔍 WORKFLOW ANALYSIS RESULTS');
    console.log('-'.repeat(40));
    const workflowAnalysis = analysisReport.workflow_analysis;
    console.log(`📈 Workflows Analyzed: ${workflowAnalysis.total_workflows_analyzed}`);
    console.log(`🎯 Patterns Discovered: ${workflowAnalysis.patterns_discovered}`);
    
    const metrics = workflowAnalysis.performance_metrics;
    console.log(`\n📊 Performance Metrics:`);
    console.log(`   • Avg Cycle Time: ${Math.round(metrics.avg_cycle_time)} days`);
    console.log(`   • Success Rate: ${Math.round(metrics.success_rate * 100)}%`);
    console.log(`   • Data Completeness: ${Math.round(metrics.data_completeness * 100)}%`);
    console.log(`   • Engagement Score: ${Math.round(metrics.engagement_score * 100)}%`);

    if (workflowAnalysis.pattern_summary?.length > 0) {
      console.log(`\n🔍 Discovered Patterns:`);
      workflowAnalysis.pattern_summary.forEach((pattern, i) => {
        console.log(`   ${i + 1}. ${pattern.name} (${pattern.type})`);
        console.log(`      • Workflows: ${pattern.workflow_count}`);
        console.log(`      • Confidence: ${Math.round(pattern.confidence * 100)}%`);
        if (pattern.primary_issues?.length > 0) {
          console.log(`      • Issues: ${pattern.primary_issues.join(', ')}`);
        }
      });
    }

    console.log('\n💡 CONTEXTUAL RECOMMENDATIONS');
    console.log('-'.repeat(40));
    const recommendations = analysisReport.contextual_recommendations;
    console.log(`📋 Total Recommendations: ${recommendations.total_recommendations}`);
    
    if (recommendations.high_priority?.length > 0) {
      console.log(`\n🔥 High Priority Recommendations:`);
      recommendations.high_priority.slice(0, 5).forEach((rec, i) => {
        console.log(`   ${i + 1}. ${rec.tool_name || rec.recommendation}`);
        if (rec.business_impact) {
          console.log(`      💰 Impact: ${rec.business_impact}`);
        }
        if (rec.implementation_effort) {
          console.log(`      ⚡ Effort: ${rec.implementation_effort}`);
        }
      });
    }
    
    if (recommendations.quick_wins?.length > 0) {
      console.log(`\n⚡ Quick Wins (Low Effort, High Impact):`);
      recommendations.quick_wins.slice(0, 3).forEach((rec, i) => {
        console.log(`   ${i + 1}. ${rec.tool_name || rec.recommendation}`);
      });
    }

    if (recommendations.roi_projections) {
      console.log(`\n💰 ROI Projections:`);
      const roi = recommendations.roi_projections;
      console.log(`   • Investment: $${roi.total_investment_estimate?.toLocaleString() || 'TBD'}`);
      console.log(`   • Annual Savings: $${roi.projected_annual_savings?.toLocaleString() || 'TBD'}`);
      console.log(`   • Payback: ${roi.payback_period_months} months`);
    }

    if (recommendations.implementation_roadmap?.length > 0) {
      console.log(`\n🗺️  Implementation Roadmap:`);
      recommendations.implementation_roadmap.forEach((phase, i) => {
        console.log(`   ${phase.phase}:`);
        phase.recommendations.slice(0, 3).forEach(rec => {
          console.log(`     • ${rec}`);
        });
      });
    }

    console.log('\n📁 SAVED FILES');
    console.log('-'.repeat(40));
    console.log(`📄 Analysis ID: ${analysisReport.analysis_metadata.analysis_id}`);
    console.log(`📂 Results saved to: ./analysis-results/`);
    console.log(`🔍 Look for files with timestamp: ${analysisReport.analysis_metadata.timestamp}`);

    console.log('\n🎉 INTELLIGENT ANALYSIS COMPLETE!');
    console.log('='.repeat(60));
    
    return analysisReport;

  } catch (error) {
    console.error('\n❌ ANALYSIS FAILED');
    console.error('-'.repeat(40));
    console.error(`Error: ${error.message}`);
    console.error(`Stack: ${error.stack}`);
    
    // Check for common issues
    if (error.message.includes('Company intelligence extraction failed')) {
      console.error('\n💡 Troubleshooting Tips:');
      console.error('   • Check if Python dependencies are installed');
      console.error('   • Verify ANTHROPIC_API_KEY is set');
      console.error('   • Ensure website URL is accessible');
    } else if (error.message.includes('No workflows found')) {
      console.error('\n💡 Troubleshooting Tips:');
      console.error('   • Check HUBSPOT_API_KEY is valid');
      console.error('   • Verify HubSpot has deals with contacts');
      console.error('   • Try increasing workflowLimit');
    }
    
    throw error;
  }
}

// Run the test
if (require.main === module) {
  testIntelligentAnalysis()
    .then(() => {
      console.log('\n✅ Test completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Test failed:', error.message);
      process.exit(1);
    });
}

module.exports = { testIntelligentAnalysis };

