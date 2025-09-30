/**
 * Test Bridge Integration
 * 
 * Tests the company intelligence bridge and context manager
 * to ensure proper integration between Python and JavaScript systems.
 */

const CompanyIntelligenceBridge = require('./company-intelligence-bridge');
const CompanyContextManager = require('./company-context-manager');
const { IntelligenceUtils } = require('./intelligence-types');

class BridgeTestSuite {
    constructor() {
        this.bridge = new CompanyIntelligenceBridge();
        this.contextManager = new CompanyContextManager();
        
        // Test companies
        this.testCompanies = [
            { name: 'Meta', url: 'https://meta.com' },
            { name: 'DxFactor', url: 'https://dxfactor.com' },
            { name: 'HubSpot', url: 'https://hubspot.com' }
        ];
    }

    async runAllTests() {
        console.log('🧪 Starting Bridge Integration Test Suite');
        console.log('=' .repeat(60));

        try {
            // Test 1: Health Check
            await this.testHealthCheck();
            
            // Test 2: Bridge Analysis
            await this.testBridgeAnalysis();
            
            // Test 3: Context Management
            await this.testContextManagement();
            
            // Test 4: Intelligence Utils
            await this.testIntelligenceUtils();
            
            // Test 5: End-to-End Integration
            await this.testEndToEndIntegration();
            
            console.log('\n✅ All tests completed successfully!');
            
        } catch (error) {
            console.error('\n❌ Test suite failed:', error.message);
            throw error;
        }
    }

    async testHealthCheck() {
        console.log('\n🏥 Test 1: Health Check');
        console.log('-'.repeat(30));
        
        const isHealthy = await this.bridge.healthCheck();
        if (!isHealthy) {
            throw new Error('Bridge health check failed');
        }
        
        console.log('✅ Bridge is healthy and ready');
    }

    async testBridgeAnalysis() {
        console.log('\n🔍 Test 2: Bridge Analysis');
        console.log('-'.repeat(30));
        
        // Test with a simple company
        const testUrl = 'https://dxfactor.com';
        console.log(`Analyzing: ${testUrl}`);
        
        // Set up event listeners
        this.bridge.on('analysisStarted', (data) => {
            console.log(`📊 Analysis started for: ${data.websiteUrl}`);
        });
        
        this.bridge.on('analysisProgress', (data) => {
            // Show progress without flooding console
            if (data.data.includes('✅') || data.data.includes('🔍')) {
                process.stdout.write('.');
            }
        });
        
        this.bridge.on('analysisCompleted', (data) => {
            console.log(`\n✅ Analysis completed for: ${data.result.company_name}`);
        });
        
        const intelligence = await this.bridge.analyzeCompany(testUrl);
        
        // Validate intelligence structure
        if (!intelligence || !intelligence.company_name) {
            throw new Error('Invalid intelligence structure returned');
        }
        
        console.log(`📋 Company: ${intelligence.company_name}`);
        console.log(`🏢 Industry: ${intelligence.organization_context.industry}`);
        console.log(`📏 Size: ${intelligence.organization_context.company_size}`);
        console.log('✅ Bridge analysis test passed');
        
        return intelligence;
    }

    async testContextManagement() {
        console.log('\n💾 Test 3: Context Management');
        console.log('-'.repeat(30));
        
        // Use intelligence from previous test or analyze a new company
        let intelligence;
        try {
            intelligence = await this.bridge.loadExistingIntelligence('https://dxfactor.com');
            if (!intelligence) {
                console.log('No existing intelligence found, analyzing...');
                intelligence = await this.bridge.analyzeCompany('https://dxfactor.com');
            }
        } catch (error) {
            console.log('Error loading existing intelligence, analyzing fresh...');
            intelligence = await this.bridge.analyzeCompany('https://dxfactor.com');
        }
        
        // Test saving context
        const orgId = await this.contextManager.saveCompanyContext(intelligence);
        console.log(`💾 Saved context with ID: ${orgId}`);
        
        // Test loading context
        const loadedContext = await this.contextManager.loadCompanyContext(orgId);
        if (!loadedContext) {
            throw new Error('Failed to load saved context');
        }
        console.log(`📄 Loaded context for: ${loadedContext.company_name}`);
        
        // Test setting current context
        await this.contextManager.setCurrentCompanyContext(orgId);
        const currentContext = await this.contextManager.getCurrentCompanyContext();
        if (!currentContext || currentContext.organization_context.organization_id !== orgId) {
            throw new Error('Failed to set current context');
        }
        console.log(`🎯 Set current context: ${currentContext.company_name}`);
        
        // Test context summary
        const summary = await this.contextManager.getContextSummary();
        if (!summary || !summary.companyName) {
            throw new Error('Failed to get context summary');
        }
        console.log(`📊 Context summary: ${summary.companyName} (${summary.industry})`);
        
        // Test listing contexts
        const allContexts = await this.contextManager.listAllContexts();
        console.log(`📋 Found ${allContexts.length} saved contexts`);
        
        console.log('✅ Context management test passed');
        return { orgId, context: loadedContext, summary };
    }

    async testIntelligenceUtils() {
        console.log('\n🔧 Test 4: Intelligence Utils');
        console.log('-'.repeat(30));
        
        // Get current context for testing
        const context = await this.contextManager.getCurrentCompanyContext();
        if (!context) {
            throw new Error('No current context available for utils testing');
        }
        
        // Test utility functions
        const isEnterprise = IntelligenceUtils.isEnterprise(context);
        const isTechSophisticated = IntelligenceUtils.isTechSophisticated(context);
        const hasComplexSales = IntelligenceUtils.hasComplexSales(context);
        
        console.log(`🏢 Is Enterprise: ${isEnterprise}`);
        console.log(`💻 Tech Sophisticated: ${isTechSophisticated}`);
        console.log(`📈 Complex Sales: ${hasComplexSales}`);
        
        // Test scoring functions
        const automationReadiness = IntelligenceUtils.getAutomationReadiness(context);
        const crmReadiness = IntelligenceUtils.getCRMReadiness(context);
        
        console.log(`🤖 Automation Readiness: ${automationReadiness}%`);
        console.log(`📊 CRM Readiness: ${crmReadiness}%`);
        
        // Test tool recommendations
        const recommendedCategories = IntelligenceUtils.getRecommendedToolCategories(context);
        console.log(`🛠️ Recommended Categories: ${recommendedCategories.join(', ')}`);
        
        // Test reasoning generation
        const reasoning = IntelligenceUtils.generateToolReasoning('HubSpot', context);
        console.log(`💡 Sample Reasoning: ${reasoning}`);
        
        // Test validation
        const validation = IntelligenceUtils.validateContext(context);
        if (!validation.isValid) {
            console.warn(`⚠️ Context validation issues: ${validation.errors.join(', ')}`);
        } else {
            console.log('✅ Context validation passed');
        }
        
        console.log('✅ Intelligence utils test passed');
    }

    async testEndToEndIntegration() {
        console.log('\n🔄 Test 5: End-to-End Integration');
        console.log('-'.repeat(30));
        
        // Simulate CRM startup flow
        console.log('🚀 Simulating CRM startup...');
        
        // Check if context exists
        const hasContext = await this.contextManager.hasCompanyContext();
        console.log(`📋 Has existing context: ${hasContext}`);
        
        if (hasContext) {
            // Load existing context
            const currentContext = await this.contextManager.getCurrentCompanyContext();
            console.log(`📄 Using existing context: ${currentContext.company_name}`);
            
            // Check if refresh is needed
            const needsRefresh = await this.contextManager.needsRefresh(
                currentContext.organization_context.organization_id
            );
            console.log(`🔄 Needs refresh: ${needsRefresh}`);
            
        } else {
            console.log('❓ No context found - would prompt user for website');
        }
        
        // Simulate tool recommendation with context
        const summary = await this.contextManager.getContextSummary();
        if (summary) {
            console.log('\n🛠️ Contextual Tool Recommendations:');
            
            const categories = IntelligenceUtils.getRecommendedToolCategories(summary);
            categories.forEach(category => {
                const reasoning = IntelligenceUtils.generateToolReasoning(
                    `${category} tools`, 
                    summary
                );
                console.log(`  • ${category}: ${reasoning}`);
            });
        }
        
        console.log('✅ End-to-end integration test passed');
    }

    async cleanup() {
        console.log('\n🧹 Cleaning up test data...');
        
        // List all contexts and optionally clean up test data
        const contexts = await this.contextManager.listAllContexts();
        console.log(`Found ${contexts.length} contexts (keeping for manual review)`);
        
        // Clear cache
        this.contextManager.clearCache();
        console.log('✅ Cleanup completed');
    }
}

// Run tests if called directly
if (require.main === module) {
    async function runTests() {
        const testSuite = new BridgeTestSuite();
        
        try {
            await testSuite.runAllTests();
            await testSuite.cleanup();
            
            console.log('\n🎉 Bridge integration is working perfectly!');
            console.log('Ready for CRM integration.');
            
        } catch (error) {
            console.error('\n💥 Test failed:', error);
            process.exit(1);
        }
    }
    
    runTests();
}

module.exports = BridgeTestSuite;


