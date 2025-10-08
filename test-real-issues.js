#!/usr/bin/env node

/**
 * Test Real GitHub Issues Data
 * Demonstrates fetching and displaying actual issues from Mark-I repository
 */

require('dotenv').config();
const EngineeringIntelligenceService = require('./core/intelligence/engineering-intelligence-service');

async function testRealIssues() {
  console.log('🧪 Testing REAL GitHub Issues Data\n');
  
  try {
    // Initialize service
    const service = new EngineeringIntelligenceService({
      logLevel: 'error' // Reduce noise
    });
    
    // Query for issues in Mark-I repository
    console.log('📋 Querying: "list all the issues in the Mark1 repository"\n');
    
    const result = await service.queryCodebase('list all the issues in the Mark1 repository', {
      repository: { owner: 'HeyoJarvis', repo: 'Mark-I' },
      role: 'sales'
    });
    
    console.log('=' .repeat(80));
    console.log('RESPONSE:');
    console.log('='.repeat(80));
    console.log(result.summary);
    console.log('='.repeat(80));
    
    console.log('\n✅ SUCCESS! You\'re seeing REAL data from your GitHub repository!\n');
    
    if (result.businessImpact) {
      console.log('\n💼 Business Impact:');
      console.log(result.businessImpact);
    }
    
    console.log('\n📊 Metadata:');
    console.log(`  - Repository: ${result.metadata.repository}`);
    console.log(`  - Timestamp: ${new Date(result.metadata.timestamp).toLocaleString()}`);
    console.log(`  - Question: ${result.metadata.question}`);
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

testRealIssues();

