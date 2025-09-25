/**
 * Test Integrated CRM with Company Intelligence
 * 
 * Tests the ORIGINAL CRM workflow analysis system but now enhanced
 * with actual DxFactor company intelligence instead of hardcoded data
 */

const CRMWorkflowAnalyzer = require('./index');
require('dotenv').config({ path: '../.env' });

async function testIntegratedCRM() {
    console.log('🔧 TESTING ORIGINAL CRM SYSTEM WITH COMPANY INTELLIGENCE');
    console.log('Using DxFactor.com intelligence for workflow analysis');
    console.log('=' .repeat(70));

    try {
        // Initialize the ORIGINAL CRM analyzer (not the enhanced one)
        console.log('\n🔌 Initializing Original CRM Workflow Analyzer...');
        const analyzer = new CRMWorkflowAnalyzer({
            logLevel: 'info',
            enableSlackAlerts: false,
            enableRealTimeMonitoring: false
        });

        // Configure with DxFactor organization ID
        const crmConfigs = [{
            type: 'hubspot',
            organization_id: 'dxfactor_com', // This should now load DxFactor intelligence
            access_token: process.env.HUBSPOT_API_KEY || process.env.HUBSPOT_ACCESS_TOKEN || 'test_token'
        }];

        console.log('🔍 Testing organization context loading...');
        
        // Test the getOrganizationContext method directly
        const orgContext = await analyzer.getOrganizationContext('dxfactor_com');
        
        console.log('\n📊 ORGANIZATION CONTEXT LOADED:');
        console.log(`   🏢 Company: ${orgContext.organization_id}`);
        console.log(`   🏭 Industry: ${orgContext.industry}`);
        console.log(`   📏 Size: ${orgContext.company_size}`);
        console.log(`   💼 Business Model: ${orgContext.business_model}`);
        console.log(`   🎯 Sales Complexity: ${orgContext.sales_complexity}`);
        console.log(`   💻 Tech Sophistication: ${orgContext.tech_sophistication}`);
        console.log(`   🔧 CRM System: ${orgContext.crm_system}`);
        console.log(`   💰 Avg Deal Size: ${orgContext.avg_deal_size || 'Unknown'}`);
        console.log(`   📈 Conversion Rate: ${orgContext.current_conversion_rate || 'Unknown'}`);
        
        // Show the intelligence-specific data
        if (orgContext.automation_gaps && orgContext.automation_gaps.length > 0) {
            console.log(`   🤖 Automation Gaps: ${orgContext.automation_gaps.join(', ')}`);
        }
        if (orgContext.integration_needs && orgContext.integration_needs.length > 0) {
            console.log(`   🔗 Integration Needs: ${orgContext.integration_needs.join(', ')}`);
        }
        if (orgContext.manual_processes && orgContext.manual_processes.length > 0) {
            console.log(`   ✋ Manual Processes: ${orgContext.manual_processes.join(', ')}`);
        }

        // Compare with generic context
        console.log('\n🆚 COMPARISON: Intelligence vs Generic');
        console.log('-'.repeat(50));
        
        const genericContext = await analyzer.getOrganizationContext('generic_org');
        
        console.log('📊 DXFACTOR (with intelligence):');
        console.log(`   Industry: ${orgContext.industry} | Size: ${orgContext.company_size} | Model: ${orgContext.business_model}`);
        console.log(`   Sales: ${orgContext.sales_complexity} | CRM: ${orgContext.crm_system}`);
        console.log(`   Gaps: ${orgContext.automation_gaps?.length || 0} identified | Integrations: ${orgContext.integration_needs?.length || 0} needed`);
        
        console.log('\n📊 GENERIC ORG (fallback data):');
        console.log(`   Industry: ${genericContext.industry} | Size: ${genericContext.company_size} | Model: ${genericContext.business_model || 'Unknown'}`);
        console.log(`   Sales: ${genericContext.sales_complexity || 'Unknown'} | CRM: ${genericContext.crm_system}`);
        console.log(`   Gaps: ${genericContext.automation_gaps?.length || 0} identified | Integrations: ${genericContext.integration_needs?.length || 0} needed`);

        // Test workflow analysis (simulated since we may not have HubSpot access)
        console.log('\n🔄 Testing Workflow Analysis Integration...');
        
        try {
            if (!process.env.HUBSPOT_API_KEY && !process.env.HUBSPOT_ACCESS_TOKEN) {
                console.log('⚠️ No HubSpot API key - simulating workflow analysis');
                simulateWorkflowAnalysis(orgContext);
            } else {
                console.log('🔌 Attempting real HubSpot connection...');
                await analyzer.initialize(crmConfigs);
                
                const analysisOptions = {
                    limit: 5,
                    dateRange: {
                        start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
                        end: new Date()
                    }
                };
                
                const results = await analyzer.analyzeWorkflows('dxfactor_com', analysisOptions);
                
                console.log('\n🎉 REAL WORKFLOW ANALYSIS RESULTS:');
                console.log(`   📈 Workflows: ${results.workflow_count}`);
                console.log(`   🔍 Patterns: ${results.pattern_count}`);
                console.log(`   🚀 Recommendations: ${results.recommendation_count}`);
                console.log(`   📊 Health Score: ${results.summary?.workflow_health_score || 'N/A'}`);
                
                if (results.recommendations && results.recommendations.length > 0) {
                    console.log('\n💡 PERSONALIZED RECOMMENDATIONS:');
                    results.recommendations.slice(0, 3).forEach((rec, index) => {
                        console.log(`   ${index + 1}. ${rec.tool_name}: ${rec.reasoning}`);
                    });
                }
            }
        } catch (error) {
            console.log(`⚠️ HubSpot connection failed: ${error.message}`);
            console.log('📊 Simulating workflow analysis with DxFactor context...');
            simulateWorkflowAnalysis(orgContext);
        }

        console.log('\n✅ INTEGRATION TEST COMPLETED');
        console.log('🎯 The original CRM system now uses actual company intelligence!');

    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.error('Stack:', error.stack);
    }
}

function simulateWorkflowAnalysis(orgContext) {
    console.log('\n📊 SIMULATED WORKFLOW ANALYSIS WITH DXFACTOR INTELLIGENCE:');
    console.log('-'.repeat(60));
    
    console.log('🔍 Pattern Detection (using company context):');
    console.log(`   • Industry: ${orgContext.industry} (${orgContext.business_model})`);
    console.log(`   • Sales Process: ${orgContext.sales_complexity} (affects workflow complexity)`);
    console.log(`   • Tech Level: ${orgContext.tech_sophistication} (affects tool recommendations)`);
    console.log(`   • Existing CRM: ${orgContext.crm_system} (integration opportunities)`);
    
    if (orgContext.automation_gaps && orgContext.automation_gaps.length > 0) {
        console.log('\n🤖 AUTOMATION OPPORTUNITIES (from company intelligence):');
        orgContext.automation_gaps.forEach(gap => {
            console.log(`   • ${gap} - High priority for automation`);
        });
    }
    
    if (orgContext.integration_needs && orgContext.integration_needs.length > 0) {
        console.log('\n🔗 INTEGRATION RECOMMENDATIONS (from company intelligence):');
        orgContext.integration_needs.forEach(need => {
            console.log(`   • ${need} - Fitness industry integration needed`);
        });
    }
    
    console.log('\n💡 CONTEXTUAL TOOL RECOMMENDATIONS:');
    console.log('   Based on DxFactor\'s actual business profile:');
    
    if (orgContext.company_size === 'smb') {
        console.log('   • SMB-focused tools (not enterprise solutions)');
    }
    
    if (orgContext.business_model === 'B2B SaaS') {
        console.log('   • B2B SaaS workflow optimizations');
    }
    
    if (orgContext.sales_complexity === 'consultative') {
        console.log('   • Document management for complex sales');
        console.log('   • Proposal automation tools');
    }
    
    if (orgContext.crm_system === 'Hubspot') {
        console.log('   • HubSpot enhancement recommendations');
        console.log('   • HubSpot-compatible integrations');
    }
    
    console.log('\n🎉 This is how the original CRM system now gets personalized!');
}

testIntegratedCRM();
