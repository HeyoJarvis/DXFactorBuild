#!/usr/bin/env node

/**
 * Simple Task Intelligence Tester
 * 
 * Tests task detection and CRM integration without requiring AI API.
 * Uses pattern matching and your real CRM data.
 */

require('dotenv').config();

async function testTaskDetection(message) {
  console.log('\n🧪 SIMPLE TASK DETECTION TEST');
  console.log('='.repeat(50));
  console.log(`📝 Message: "${message}"`);
  console.log('='.repeat(50));

  // Step 1: Pattern-based task detection
  const taskResult = analyzeTaskPattern(message);
  
  console.log('\n🔍 PATTERN ANALYSIS:');
  console.log(`🎯 Is Task: ${taskResult.isTask ? '✅ YES' : '❌ NO'}`);
  console.log(`👤 Assignee: ${taskResult.assignee || 'Not found'}`);
  console.log(`📋 Task Type: ${taskResult.taskType}`);
  console.log(`⚡ Urgency: ${taskResult.urgency}`);
  console.log(`📊 Confidence: ${(taskResult.confidence * 100).toFixed(1)}%`);

  // Step 2: Check CRM data
  try {
    const fetch = require('node-fetch');
    const response = await fetch('http://localhost:3002/analysis/latest/default_org');
    
    if (response.ok) {
      const crmData = await response.json();
      console.log('\n🏢 CRM CONTEXT:');
      console.log(`📊 Workflows Available: ${crmData.workflows?.length || 0}`);
      console.log(`🏢 Company: ${crmData.company_name || 'Unknown'}`);
      
      if (crmData.workflows && crmData.workflows.length > 0) {
        console.log(`📈 Sample Deal Stages: ${crmData.workflows.slice(0, 3).map(w => w.deal_stage).join(', ')}`);
      }
    } else {
      console.log('\n⚠️  No CRM data available');
    }
  } catch (error) {
    console.log('\n❌ CRM service not available');
  }

  // Step 3: Generate simple recommendations
  if (taskResult.isTask && taskResult.confidence > 0.5) {
    console.log('\n💡 TOOL RECOMMENDATIONS:');
    const recommendations = getSimpleRecommendations(taskResult.taskType);
    recommendations.forEach((rec, i) => {
      console.log(`   ${i + 1}. ${rec.tool} - ${rec.reason}`);
    });
  }

  console.log('\n✅ TEST COMPLETED');
  console.log('='.repeat(50));
}

function analyzeTaskPattern(message) {
  const lowerMessage = message.toLowerCase();
  
  // Task indicators
  const taskKeywords = [
    'can you', 'could you', 'please', 'need you to', 'would you',
    'schedule', 'follow up', 'reach out', 'contact', 'call', 'email',
    'update', 'send', 'create', 'prepare', 'review', 'check'
  ];
  
  // Urgency indicators
  const urgencyKeywords = ['asap', 'urgent', 'immediately', 'today', 'tomorrow', 'by friday'];
  
  // Task type patterns
  const taskTypes = {
    'meeting': ['schedule', 'meeting', 'demo', 'call', 'appointment'],
    'follow_up': ['follow up', 'reach out', 'contact', 'touch base'],
    'document': ['send', 'prepare', 'create', 'document', 'proposal', 'contract'],
    'crm_update': ['update', 'crm', 'record', 'log', 'enter'],
    'research': ['research', 'find', 'look up', 'investigate']
  };
  
  // Check if it's a task
  const isTask = taskKeywords.some(keyword => lowerMessage.includes(keyword));
  
  // Extract assignee (person being asked)
  let assignee = null;
  const assigneePatterns = [
    /(?:hey|hi)\s+(\w+)/i,
    /(\w+),?\s+(?:can you|could you|please|would you)/i,
    /(\w+),?\s+(?:need you to|I need you)/i
  ];
  
  for (const pattern of assigneePatterns) {
    const match = message.match(pattern);
    if (match) {
      assignee = match[1];
      break;
    }
  }
  
  // Determine task type
  let taskType = 'general';
  for (const [type, keywords] of Object.entries(taskTypes)) {
    if (keywords.some(keyword => lowerMessage.includes(keyword))) {
      taskType = type;
      break;
    }
  }
  
  // Determine urgency
  const urgency = urgencyKeywords.some(keyword => lowerMessage.includes(keyword)) ? 'high' : 'medium';
  
  // Calculate confidence
  let confidence = 0.3;
  if (isTask) confidence += 0.4;
  if (assignee) confidence += 0.2;
  if (taskType !== 'general') confidence += 0.1;
  
  return {
    isTask,
    assignee,
    taskType,
    urgency,
    confidence: Math.min(confidence, 1.0),
    originalMessage: message
  };
}

function getSimpleRecommendations(taskType) {
  // No hardcoded tool recommendations - only task analysis
  return [
    { 
      analysis: `Task type: ${taskType}`,
      note: 'Tool recommendations require real company data analysis'
    }
  ];
}

// Test examples
const examples = [
  "Sarah, can you schedule a demo with the new client?",
  "Hey John, please follow up with Acme Corp by Friday",
  "Mike, can you update the CRM with the latest deal info?",
  "Could someone send the contract to DXFactor today?",
  "We need to prepare the proposal for the meeting",
  "The weather is nice today", // Should NOT be detected as task
  "Thanks for the update", // Should NOT be detected as task
];

async function runTests() {
  console.log('🚀 RUNNING SIMPLE TASK DETECTION TESTS');
  console.log('=====================================');
  
  for (let i = 0; i < examples.length; i++) {
    await testTaskDetection(examples[i]);
    if (i < examples.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  
  console.log('\n📊 All tests completed!');
}

// Main execution
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.length > 0) {
    // Test single message
    testTaskDetection(args.join(' '));
  } else {
    // Run all examples
    runTests();
  }
}

module.exports = { testTaskDetection, analyzeTaskPattern };
