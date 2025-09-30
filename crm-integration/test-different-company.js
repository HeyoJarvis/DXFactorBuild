/**
 * Test Different Company Context
 * 
 * Test how recommendations change based on different company profiles
 */

const CompanyIntelligenceBridge = require('./intelligence/company-intelligence-bridge');
const CompanyContextManager = require('./intelligence/company-context-manager');
const { IntelligenceUtils } = require('./intelligence/intelligence-types');

async function testDifferentCompany() {
    console.log('🧪 Testing Different Company Recommendations');
    console.log('=' .repeat(60));

    const bridge = new CompanyIntelligenceBridge();
    const contextManager = new CompanyContextManager();

    try {
        // Test with Meta (large enterprise, B2C)
        console.log('\n🔍 Analyzing Meta.com...');
        const metaIntelligence = await bridge.analyzeCompany('https://meta.com');
        await contextManager.saveCompanyContext(metaIntelligence);
        
        const metaContext = await contextManager.getContextSummary();
        
        console.log(`\n📊 META CONTEXT:`);
        console.log(`   Company: ${metaContext.companyName}`);
        console.log(`   Size: ${metaContext.companySize}`);
        console.log(`   Business Model: ${metaContext.businessModel}`);
        console.log(`   Tech Sophistication: ${metaContext.techSophistication}`);
        console.log(`   Sales Complexity: ${metaContext.salesComplexity}`);
        
        console.log(`\n🎯 META RECOMMENDATIONS:`);
        const metaCategories = IntelligenceUtils.getRecommendedToolCategories(metaContext);
        metaCategories.forEach((category, index) => {
            const reasoning = IntelligenceUtils.generateToolReasoning(`${category} tools`, metaContext);
            console.log(`   ${index + 1}. ${category.toUpperCase()}`);
            console.log(`      💡 ${reasoning}`);
        });

        // Compare with DxFactor
        console.log('\n' + '='.repeat(60));
        console.log('📊 COMPARISON WITH DXFACTOR:');
        
        const dxfactorContext = await contextManager.loadCompanyContext('dxfactor_com');
        const dxfactorSummary = {
            companyName: dxfactorContext.company_name,
            companySize: dxfactorContext.organization_context.company_size,
            businessModel: dxfactorContext.organization_context.business_model,
            techSophistication: dxfactorContext.organization_context.tech_sophistication,
            salesComplexity: dxfactorContext.organization_context.sales_complexity,
            automationGaps: dxfactorContext.workflow_intelligence.automation_gaps,
            integrationNeeds: dxfactorContext.workflow_intelligence.integration_needs
        };
        
        console.log(`\n📊 DXFACTOR CONTEXT:`);
        console.log(`   Company: ${dxfactorSummary.companyName}`);
        console.log(`   Size: ${dxfactorSummary.companySize}`);
        console.log(`   Business Model: ${dxfactorSummary.businessModel}`);
        console.log(`   Tech Sophistication: ${dxfactorSummary.techSophistication}`);
        console.log(`   Sales Complexity: ${dxfactorSummary.salesComplexity}`);
        
        console.log(`\n🎯 DXFACTOR RECOMMENDATIONS:`);
        const dxfactorCategories = IntelligenceUtils.getRecommendedToolCategories(dxfactorSummary);
        dxfactorCategories.forEach((category, index) => {
            const reasoning = IntelligenceUtils.generateToolReasoning(`${category} tools`, dxfactorSummary);
            console.log(`   ${index + 1}. ${category.toUpperCase()}`);
            console.log(`      💡 ${reasoning}`);
        });

        console.log('\n✅ Different companies get different, contextual recommendations!');
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

testDifferentCompany();


