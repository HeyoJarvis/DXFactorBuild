/**
 * Debug Bridge Test
 * 
 * Simple test to debug the Python bridge execution
 */

const CompanyIntelligenceBridge = require('./company-intelligence-bridge');

async function debugBridge() {
    console.log('🔍 Debug Bridge Test');
    
    const bridge = new CompanyIntelligenceBridge();
    
    // Set up detailed event listeners
    bridge.on('analysisStarted', (data) => {
        console.log('📊 Analysis started:', data);
    });
    
    bridge.on('analysisProgress', (data) => {
        console.log('📈 Progress:', data.data.trim());
    });
    
    bridge.on('analysisCompleted', (data) => {
        console.log('✅ Analysis completed:', data);
    });
    
    bridge.on('analysisError', (data) => {
        console.log('❌ Analysis error:', data);
    });
    
    try {
        console.log('🏥 Health check...');
        const healthy = await bridge.healthCheck();
        console.log('Health:', healthy);
        
        console.log('🔍 Testing analysis...');
        const result = await bridge.analyzeCompany('https://dxfactor.com');
        console.log('✅ Success:', result.company_name);
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error('Stack:', error.stack);
    }
}

debugBridge();

