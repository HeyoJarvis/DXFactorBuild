/**
 * Test script for the new Intelligent Background Service
 */

require('dotenv').config({ path: '../.env' });
const IntelligentBackgroundService = require('./intelligent-background-service');

async function testIntelligentService() {
  console.log('🧪 TESTING INTELLIGENT BACKGROUND SERVICE');
  console.log('============================================================');
  
  try {
    // Create service instance
    const service = new IntelligentBackgroundService({
      port: 3003, // Use different port for testing
      companyWebsite: 'https://dxfactor.com',
      logLevel: 'info'
    });
    
    console.log('✅ Service instance created');
    
    // Test event listeners
    service.on('analysis_completed', (data) => {
      console.log('📊 Analysis completed event received:', {
        organization_id: data.organizationId,
        analysis_id: data.analysisId,
        patterns: data.analysisResult.patterns?.length || 0,
        recommendations: data.analysisResult.recommendations?.length || 0
      });
    });
    
    service.on('alert_generated', (data) => {
      console.log('🔔 Alert generated event received:', {
        organization_id: data.organizationId,
        alert_type: data.alert.type,
        urgency: data.alert.urgency
      });
    });
    
    // Start the service
    console.log('🚀 Starting service...');
    await service.start();
    
    console.log('⏱️  Waiting 30 seconds for initial analysis...');
    
    // Wait for initial analysis to complete
    await new Promise(resolve => setTimeout(resolve, 30000));
    
    console.log('🔍 Testing manual analysis trigger...');
    
    // Test manual analysis
    const analysisResult = await service.runIntelligentAnalysis(
      'https://dxfactor.com',
      'test_org'
    );
    
    console.log('📋 Manual analysis results:', {
      analysis_id: analysisResult.analysis_id,
      company: analysisResult.company_name,
      patterns: analysisResult.patterns?.length || 0,
      recommendations: analysisResult.recommendations?.length || 0,
      workflows: analysisResult.workflows?.length || 0
    });
    
    console.log('✅ All tests completed successfully!');
    
    // Graceful shutdown
    setTimeout(() => {
      console.log('🛑 Shutting down test service...');
      process.kill(process.pid, 'SIGTERM');
    }, 5000);
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

// Run the test
if (require.main === module) {
  testIntelligentService();
}

module.exports = { testIntelligentService };
