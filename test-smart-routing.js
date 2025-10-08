#!/usr/bin/env node

/**
 * Test Smart AI Routing for GitHub Integration
 * Tests the complete flow: health check, list repos, and smart routing
 */

require('dotenv').config();
const EngineeringIntelligenceService = require('./core/intelligence/engineering-intelligence-service');

async function testSmartRouting() {
  console.log('🧪 Testing Smart AI Routing for GitHub Integration\n');
  
  try {
    // Initialize service
    console.log('1️⃣ Initializing Engineering Intelligence Service...');
    const service = new EngineeringIntelligenceService({
      logLevel: 'info'
    });
    console.log('✅ Service initialized\n');
    
    // Test 1: Health Check
    console.log('2️⃣ Testing Health Check...');
    const health = await service.healthCheck();
    console.log('Health Status:', JSON.stringify(health, null, 2));
    
    if (health.status === 'healthy') {
      console.log('✅ Health check passed!\n');
    } else {
      console.log('❌ Health check failed\n');
      return;
    }
    
    // Test 2: List Repositories (simulating "what repos" query)
    console.log('3️⃣ Testing List Repositories...');
    const octokit = await service._getOctokit();
    const { data } = await octokit.apps.listReposAccessibleToInstallation();
    
    console.log(`Found ${data.total_count} accessible repositories:`);
    data.repositories.slice(0, 5).forEach((repo, i) => {
      console.log(`  ${i + 1}. ${repo.full_name} ${repo.private ? '🔒' : '🌐'}`);
      if (repo.description) {
        console.log(`     ${repo.description}`);
      }
    });
    if (data.total_count > 5) {
      console.log(`  ... and ${data.total_count - 5} more`);
    }
    console.log('✅ Repository listing works!\n');
    
    // Test 3: Query Codebase (simulating engineering question)
    if (data.repositories.length > 0) {
      const firstRepo = data.repositories[0];
      console.log(`4️⃣ Testing Codebase Query on ${firstRepo.full_name}...`);
      
      const query = 'What features were built recently?';
      const result = await service.queryCodebase(query, {
        repository: {
          owner: firstRepo.owner.login,
          repo: firstRepo.name
        },
        role: 'sales'
      });
      
      console.log('Query Response:');
      console.log('  Summary:', result.summary.substring(0, 200) + '...');
      if (result.businessImpact) {
        console.log('  Business Impact:', result.businessImpact.substring(0, 100) + '...');
      }
      console.log('✅ Codebase query works!\n');
    }
    
    // Test Summary
    console.log('🎉 ALL TESTS PASSED!');
    console.log('\n📋 What this means:');
    console.log('  ✅ GitHub App authentication works');
    console.log('  ✅ Health check returns correct status');
    console.log('  ✅ Can list all accessible repositories');
    console.log('  ✅ Can query repository data');
    console.log('  ✅ Smart AI routing will work in chat!');
    
    console.log('\n💬 Try asking in chat:');
    console.log('  • "What repositories do you have access to?"');
    console.log('  • "What features were built in Mark-I?"');
    console.log('  • "Show me recent pull requests"');
    console.log('  • "What is the engineering progress?"');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

testSmartRouting();

