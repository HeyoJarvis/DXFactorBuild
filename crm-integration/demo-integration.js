/**
 * Demo: Company Intelligence + CRM Integration
 * 
 * This demo shows how the Python company intelligence system
 * integrates with the JavaScript CRM system to provide
 * contextual, personalized recommendations.
 */

const CompanyIntelligenceBridge = require('./intelligence/company-intelligence-bridge');
const CompanyContextManager = require('./intelligence/company-context-manager');
const { IntelligenceUtils } = require('./intelligence/intelligence-types');

class CRMIntelligenceDemo {
    constructor() {
        this.bridge = new CompanyIntelligenceBridge();
        this.contextManager = new CompanyContextManager();
    }

    async runDemo() {
        console.log('🚀 CRM + Company Intelligence Integration Demo');
        console.log('=' .repeat(60));

        try {
            // Step 1: Simulate CRM startup
            await this.simulateCRMStartup();
            
            // Step 2: Show contextual recommendations
            await this.showContextualRecommendations();
            
            // Step 3: Simulate workflow suggestions
            await this.simulateWorkflowSuggestions();
            
            console.log('\n✅ Demo completed successfully!');
            
        } catch (error) {
            console.error('❌ Demo failed:', error.message);
        }
    }

    async simulateCRMStartup() {
        console.log('\n🔄 Step 1: CRM System Startup');
        console.log('-'.repeat(40));
        
        // Check if company context exists
        const hasContext = await this.contextManager.hasCompanyContext();
        console.log(`📋 Existing company context: ${hasContext ? 'Found' : 'Not found'}`);
        
        if (!hasContext) {
            console.log('❓ No company context found - would prompt user for website');
            console.log('💡 For demo, analyzing DxFactor...');
            
            // Gather intelligence for demo
            const intelligence = await this.bridge.analyzeCompany('https://dxfactor.com');
            await this.contextManager.saveCompanyContext(intelligence);
            
            console.log(`✅ Company intelligence gathered: ${intelligence.company_name}`);
        }
        
        // Load current context
        const context = await this.contextManager.getCurrentCompanyContext();
        console.log(`🏢 Current company: ${context.company_name}`);
        console.log(`🏭 Industry: ${context.organization_context.industry}`);
        console.log(`📏 Size: ${context.organization_context.company_size}`);
        console.log(`💼 Business Model: ${context.organization_context.business_model}`);
    }

    async showContextualRecommendations() {
        console.log('\n🛠️ Step 2: Contextual Tool Recommendations');
        console.log('-'.repeat(40));
        
        const summary = await this.contextManager.getContextSummary();
        
        // Calculate readiness scores
        const crmReadiness = IntelligenceUtils.getCRMReadiness(summary);
        const automationReadiness = IntelligenceUtils.getAutomationReadiness(summary);
        
        console.log(`📊 CRM Readiness: ${crmReadiness}%`);
        console.log(`🤖 Automation Readiness: ${automationReadiness}%`);
        
        // Get recommended categories
        const categories = IntelligenceUtils.getRecommendedToolCategories(summary);
        console.log(`\n🎯 Recommended Tool Categories:`);
        
        categories.forEach((category, index) => {
            const reasoning = IntelligenceUtils.generateToolReasoning(
                `${category} tools`, 
                summary
            );
            console.log(`  ${index + 1}. ${category.toUpperCase()}`);
            console.log(`     💡 ${reasoning}`);
        });
    }

    async simulateWorkflowSuggestions() {
        console.log('\n💡 Step 3: Intelligent Workflow Suggestions');
        console.log('-'.repeat(40));
        
        const summary = await this.contextManager.getContextSummary();
        
        // Simulate specific tool recommendations based on context
        console.log('🔍 Analyzing company context for workflow improvements...\n');
        
        // CRM Recommendations
        if (summary.crmSystem === 'Unknown' || !summary.crmSystem) {
            if (summary.companySize === 'enterprise') {
                console.log('📈 CRM RECOMMENDATION: Salesforce');
                console.log(`   🎯 Why: ${summary.companyName} is an enterprise company with ${summary.salesComplexity} sales`);
                console.log('   ⚡ Impact: Manage complex sales processes and large deal volumes');
            } else {
                console.log('📈 CRM RECOMMENDATION: HubSpot');
                console.log(`   🎯 Why: Perfect for ${summary.companyName}'s ${summary.companySize} size and ${summary.businessModel} model`);
                console.log('   ⚡ Impact: All-in-one platform for sales, marketing, and service');
            }
        }
        
        // Automation Recommendations
        if (summary.automationGaps && summary.automationGaps.length > 0) {
            console.log('\n🤖 AUTOMATION RECOMMENDATION: Zapier');
            console.log(`   🎯 Why: Address automation gaps in ${summary.automationGaps.slice(0, 2).join(', ')}`);
            console.log('   ⚡ Impact: Reduce manual work and improve efficiency');
        }
        
        // Integration Recommendations
        if (summary.integrationNeeds && summary.integrationNeeds.length > 0) {
            console.log('\n🔗 INTEGRATION RECOMMENDATION: Custom API Connectors');
            console.log(`   🎯 Why: Connect with existing systems: ${summary.integrationNeeds.slice(0, 3).join(', ')}`);
            console.log('   ⚡ Impact: Seamless data flow between platforms');
        }
        
        // Industry-specific recommendations
        if (summary.industry === 'Technology' && summary.techSophistication === 'high') {
            console.log('\n📊 ANALYTICS RECOMMENDATION: Advanced Analytics Suite');
            console.log(`   🎯 Why: ${summary.companyName} has high tech sophistication and can leverage advanced analytics`);
            console.log('   ⚡ Impact: Data-driven decision making and performance optimization');
        }
        
        console.log('\n🎉 All recommendations are personalized based on company intelligence!');
    }
}

// Run demo if called directly
if (require.main === module) {
    const demo = new CRMIntelligenceDemo();
    demo.runDemo();
}

module.exports = CRMIntelligenceDemo;


