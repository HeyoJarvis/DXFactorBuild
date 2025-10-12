/**
 * Test Script for Engineering Intelligence System
 * 
 * This script tests the end-to-end flow:
 * 1. Backend API endpoint
 * 2. Authentication
 * 3. Rate limiting
 * 4. Engineering Intelligence Service
 */

require('dotenv').config();
const https = require('https');
const http = require('http');
const jwt = require('jsonwebtoken');
const { URL } = require('url');

// Simple fetch implementation using native http/https
function fetch(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const protocol = urlObj.protocol === 'https:' ? https : http;
    
    const requestOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: options.headers || {}
    };
    
    const req = protocol.request(requestOptions, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          json: async () => JSON.parse(data)
        });
      });
    });
    
    req.on('error', reject);
    
    if (options.body) {
      req.write(options.body);
    }
    
    req.end();
  });
}

const API_URL = process.env.API_BASE_URL || 'http://localhost:3000';
const JWT_SECRET = process.env.JWT_SECRET || 'your-jwt-secret-key';

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  console.log('\n' + '='.repeat(60));
  log(title, 'cyan');
  console.log('='.repeat(60));
}

function logTest(name, passed, details = '') {
  const status = passed ? '✅ PASS' : '❌ FAIL';
  const statusColor = passed ? 'green' : 'red';
  log(`${status}: ${name}`, statusColor);
  if (details) {
    console.log(`   ${details}`);
  }
}

// Generate a test JWT token
function generateTestToken() {
  return jwt.sign(
    {
      userId: 'test-user-123',
      email: 'test@heyjarvis.ai',
      slackUserId: 'U123456',
      fallback: true // Use fallback mode for testing
    },
    JWT_SECRET,
    { expiresIn: '1h' }
  );
}

// Test 1: Health Check
async function testHealthCheck() {
  logSection('Test 1: Health Check');
  
  try {
    const response = await fetch(`${API_URL}/health`);
    const data = await response.json();
    
    const passed = response.status === 200 && data.status === 'healthy';
    logTest('Health check endpoint', passed, `Status: ${data.status}`);
    
    return passed;
  } catch (error) {
    logTest('Health check endpoint', false, `Error: ${error.message}`);
    return false;
  }
}

// Test 2: Authentication Required
async function testAuthenticationRequired() {
  logSection('Test 2: Authentication Required');
  
  try {
    const response = await fetch(`${API_URL}/api/engineering/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        query: 'Test query without auth'
      })
    });
    
    const data = await response.json();
    
    const passed = response.status === 401 && data.code === 'NO_TOKEN';
    logTest('Rejects requests without authentication', passed, 
      `Status: ${response.status}, Code: ${data.code}`);
    
    return passed;
  } catch (error) {
    logTest('Rejects requests without authentication', false, `Error: ${error.message}`);
    return false;
  }
}

// Test 3: Valid Query with Authentication
async function testValidQuery() {
  logSection('Test 3: Valid Query with Authentication');
  
  const token = generateTestToken();
  
  try {
    const response = await fetch(`${API_URL}/api/engineering/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        query: 'What is the status of our SSO integration?',
        context: { role: 'sales' }
      })
    });
    
    const data = await response.json();
    
    // Check if GitHub token is configured
    if (response.status === 503) {
      logTest('Valid query execution', false, 
        'GitHub token not configured. Add GITHUB_TOKEN to .env');
      log('⚠️  This is expected if you haven\'t configured GitHub token yet', 'yellow');
      return false;
    }
    
    const passed = response.status === 200 && 
                   data.success && 
                   data.result && 
                   data.result.summary;
    
    logTest('Valid query execution', passed, 
      passed ? `Summary: ${data.result.summary.substring(0, 100)}...` : 
               `Status: ${response.status}, Error: ${data.error || 'Unknown'}`);
    
    if (passed && data.result.businessImpact) {
      log(`   Business Impact: ${data.result.businessImpact.substring(0, 100)}...`, 'blue');
    }
    
    if (passed && data.result.actionItems && data.result.actionItems.length > 0) {
      log(`   Action Items: ${data.result.actionItems.length} items`, 'blue');
    }
    
    return passed;
  } catch (error) {
    logTest('Valid query execution', false, `Error: ${error.message}`);
    return false;
  }
}

// Test 4: Invalid Query (Missing Query Text)
async function testInvalidQuery() {
  logSection('Test 4: Invalid Query (Missing Query Text)');
  
  const token = generateTestToken();
  
  try {
    const response = await fetch(`${API_URL}/api/engineering/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        context: { role: 'sales' }
      })
    });
    
    const data = await response.json();
    
    const passed = response.status === 400 && data.code === 'INVALID_QUERY';
    logTest('Rejects invalid queries', passed, 
      `Status: ${response.status}, Code: ${data.code}`);
    
    return passed;
  } catch (error) {
    logTest('Rejects invalid queries', false, `Error: ${error.message}`);
    return false;
  }
}

// Test 5: Rate Limiting
async function testRateLimiting() {
  logSection('Test 5: Rate Limiting');
  
  const token = generateTestToken();
  let rateLimitHit = false;
  let successCount = 0;
  
  log('Sending 12 requests to test rate limit (10 per 15 minutes)...', 'yellow');
  
  try {
    for (let i = 0; i < 12; i++) {
      const response = await fetch(`${API_URL}/api/engineering/query`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          query: `Test query ${i + 1}`,
          context: { role: 'sales' }
        })
      });
      
      if (response.status === 429) {
        rateLimitHit = true;
        const data = await response.json();
        log(`   Request ${i + 1}: Rate limit hit (${data.code})`, 'yellow');
        break;
      } else if (response.status === 200 || response.status === 503) {
        successCount++;
        log(`   Request ${i + 1}: Success (${response.status})`, 'green');
      } else {
        log(`   Request ${i + 1}: Unexpected status ${response.status}`, 'red');
      }
      
      // Small delay between requests
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // Rate limiting should kick in after 10 requests
    const passed = rateLimitHit && successCount <= 10;
    logTest('Rate limiting enforced', passed, 
      `Successful requests: ${successCount}, Rate limit hit: ${rateLimitHit}`);
    
    return passed;
  } catch (error) {
    logTest('Rate limiting enforced', false, `Error: ${error.message}`);
    return false;
  }
}

// Test 6: Engineering Intelligence Service
async function testEngineeringService() {
  logSection('Test 6: Engineering Intelligence Service');
  
  try {
    const EngineeringIntelligenceService = require('./core/intelligence/engineering-intelligence-service');
    
    // Check if GitHub token is configured
    if (!process.env.GITHUB_TOKEN || process.env.GITHUB_TOKEN === 'your_github_token_here') {
      logTest('Engineering Intelligence Service', false, 
        'GitHub token not configured. Add GITHUB_TOKEN to .env');
      log('⚠️  This is expected if you haven\'t configured GitHub token yet', 'yellow');
      return false;
    }
    
    const service = new EngineeringIntelligenceService({
      githubToken: process.env.GITHUB_TOKEN,
      repository: {
        owner: process.env.GITHUB_REPO_OWNER,
        repo: process.env.GITHUB_REPO_NAME
      }
    });
    
    const result = await service.queryCodebase('What is the status of SSO?', { role: 'sales' });
    
    const passed = result.success && 
                   result.summary && 
                   result.businessImpact;
    
    logTest('Engineering Intelligence Service', passed, 
      passed ? `Summary: ${result.summary.substring(0, 100)}...` : 
               'Failed to get valid response');
    
    return passed;
  } catch (error) {
    logTest('Engineering Intelligence Service', false, `Error: ${error.message}`);
    return false;
  }
}

// Run all tests
async function runAllTests() {
  log('\n🧪 Engineering Intelligence System - End-to-End Tests', 'cyan');
  log('Testing production-ready backend API architecture\n', 'cyan');
  
  const results = [];
  
  // Run tests sequentially
  results.push(await testHealthCheck());
  results.push(await testAuthenticationRequired());
  results.push(await testValidQuery());
  results.push(await testInvalidQuery());
  results.push(await testRateLimiting());
  results.push(await testEngineeringService());
  
  // Summary
  logSection('Test Summary');
  
  const passed = results.filter(r => r).length;
  const total = results.length;
  const percentage = Math.round((passed / total) * 100);
  
  log(`\nTests Passed: ${passed}/${total} (${percentage}%)`, 
    percentage === 100 ? 'green' : percentage >= 50 ? 'yellow' : 'red');
  
  if (percentage < 100) {
    log('\n⚠️  Some tests failed. Common issues:', 'yellow');
    log('   1. Backend server not running: npm start', 'yellow');
    log('   2. GitHub token not configured: Add GITHUB_TOKEN to .env', 'yellow');
    log('   3. Invalid JWT_SECRET: Check .env configuration', 'yellow');
  } else {
    log('\n✅ All tests passed! Engineering Intelligence is ready for production.', 'green');
  }
  
  log('\n📚 For more information, see ENGINEERING_INTELLIGENCE_PRODUCTION.md\n', 'cyan');
}

// Run tests
runAllTests().catch(error => {
  log(`\n❌ Test suite failed: ${error.message}`, 'red');
  console.error(error);
  process.exit(1);
});
