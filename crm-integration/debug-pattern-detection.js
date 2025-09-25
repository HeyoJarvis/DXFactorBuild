/**
 * Debug Pattern Detection - Find out why only 1 pattern is detected
 */

require('dotenv').config({ path: '../.env' });
const HubSpotAdapter = require('./adapters/hubspot-adapter');
const WorkflowPatternDetector = require('./intelligence/workflow-pattern-detector');

async function debugPatternDetection() {
  console.log('🔍 DEBUGGING PATTERN DETECTION');
  console.log('='.repeat(50));
  
  try {
    // Get workflows from HubSpot
    const hubspotAdapter = new HubSpotAdapter({
      access_token: process.env.HUBSPOT_API_KEY || 'pat-na1-e5c61dcf-ac4b-4e68-8160-f515662e8234',
      organization_id: 'debug_patterns'
    });
    
    await hubspotAdapter.connect();
    console.log('✅ Connected to HubSpot');
    
    const workflows = await hubspotAdapter.extractWorkflows({ limit: 10 });
    console.log(`📊 Extracted ${workflows.length} workflows`);
    
    if (workflows.length === 0) {
      console.log('❌ No workflows to analyze');
      return;
    }
    
    // Debug each workflow's features
    console.log('\n📋 WORKFLOW FEATURES ANALYSIS');
    console.log('-'.repeat(50));
    
    workflows.forEach((workflow, index) => {
      console.log(`\n🔍 Workflow ${index + 1}:`);
      console.log(`   ID: ${workflow.id}`);
      console.log(`   Type: ${workflow.workflow_type}`);
      console.log(`   Duration: ${workflow.duration_days} days`);
      console.log(`   Value: $${workflow.deal_value}`);
      console.log(`   Status: ${workflow.status}`);
      console.log(`   Activities: ${workflow.activities?.length || 0}`);
      console.log(`   Participants: ${workflow.participants?.length || 0}`);
      console.log(`   Stages: ${workflow.stages?.length || 0}`);
      console.log(`   Duration Days: ${workflow.duration_days}`);
      console.log(`   Created: ${workflow.created_at}`);
      
      if (workflow.features) {
        console.log(`   Features:`);
        console.log(`     - Activity Pattern: ${JSON.stringify(workflow.features.activity_pattern)}`);
        console.log(`     - Duration Profile: ${JSON.stringify(workflow.features.duration_profile)}`);
        console.log(`     - Value Profile: ${JSON.stringify(workflow.features.value_profile)}`);
        console.log(`     - Participant Profile: ${JSON.stringify(workflow.features.participant_profile)}`);
        console.log(`     - Stage Sequence: ${JSON.stringify(workflow.features.stage_sequence)}`);
      }
    });
    
    // Create pattern detector with debug settings
    const patternDetector = new WorkflowPatternDetector({
      minPatternSize: 2,
      similarityThreshold: 0.7, // Using new stricter threshold
      confidenceThreshold: 0.6, // Higher confidence
      logLevel: 'debug'
    });
    
    console.log('\n🧠 TESTING SIMILARITY CALCULATIONS');
    console.log('-'.repeat(50));
    
    // Preprocess workflows to add features first
    const processedWorkflows = patternDetector.preprocessWorkflows(workflows);
    console.log(`✅ Preprocessed ${processedWorkflows.length} workflows with features`);
    
    // Test similarity between each pair of workflows
    for (let i = 0; i < processedWorkflows.length; i++) {
      for (let j = i + 1; j < processedWorkflows.length; j++) {
        const similarity = patternDetector.calculateSimilarity(processedWorkflows[i], processedWorkflows[j]);
        console.log(`Similarity between Workflow ${i+1} and ${j+1}: ${similarity.toFixed(3)}`);
        console.log(`  Types: "${processedWorkflows[i].workflow_type}" vs "${processedWorkflows[j].workflow_type}"`);
        console.log(`  Durations: ${processedWorkflows[i].duration_days} vs ${processedWorkflows[j].duration_days} days`);
        console.log(`  Values: $${processedWorkflows[i].deal_value} vs $${processedWorkflows[j].deal_value}`);
        console.log(`  Activities: ${processedWorkflows[i].activities?.length || 0} vs ${processedWorkflows[j].activities?.length || 0}`);
        console.log('');
      }
    }
    
    console.log('\n🔍 CLUSTERING ANALYSIS');
    console.log('-'.repeat(50));
    
    // Manual clustering debug
    const clusters = [];
    const used = new Set();
    
    for (let i = 0; i < processedWorkflows.length; i++) {
      if (used.has(i)) continue;
      
      const cluster = [processedWorkflows[i]];
      used.add(i);
      
      for (let j = i + 1; j < processedWorkflows.length; j++) {
        if (used.has(j)) continue;
        
        const similarity = patternDetector.calculateSimilarity(processedWorkflows[i], processedWorkflows[j]);
        console.log(`Checking similarity ${i+1} vs ${j+1}: ${similarity.toFixed(3)} (threshold: 0.7)`);
        
        if (similarity >= 0.7) {
          cluster.push(processedWorkflows[j]);
          used.add(j);
          console.log(`  ✅ Added to cluster (similarity: ${similarity.toFixed(3)})`);
        } else {
          console.log(`  ❌ Below threshold (similarity: ${similarity.toFixed(3)})`);
        }
      }
      
      clusters.push(cluster);
      console.log(`📦 Cluster ${clusters.length}: ${cluster.length} workflows`);
    }
    
    console.log('\n📊 CLUSTER SUMMARY');
    console.log('-'.repeat(50));
    clusters.forEach((cluster, index) => {
      console.log(`Cluster ${index + 1}: ${cluster.length} workflows`);
      cluster.forEach((workflow, wIndex) => {
        console.log(`  ${wIndex + 1}. ${workflow.workflow_type} - ${workflow.duration_days} days - $${workflow.deal_value}`);
      });
      console.log('');
    });
    
    // Now run the actual pattern detection
    console.log('\n🎯 ACTUAL PATTERN DETECTION RESULTS');
    console.log('-'.repeat(50));
    
    const patterns = await patternDetector.detectPatterns(workflows, { industry: 'technology' });
    
    console.log(`🔍 Total patterns detected: ${patterns.length}`);
    
    patterns.forEach((pattern, index) => {
      console.log(`\n📋 Pattern ${index + 1}:`);
      console.log(`   Type: ${pattern.pattern_type}`);
      console.log(`   Confidence: ${pattern.confidence}`);
      console.log(`   Workflows: ${pattern.workflow_count}`);
      console.log(`   Description: ${pattern.description}`);
      
      if (pattern.characteristics) {
        console.log(`   Characteristics:`);
        Object.entries(pattern.characteristics).forEach(([key, value]) => {
          console.log(`     - ${key}: ${value}`);
        });
      }
    });
    
    // Test with even more aggressive settings
    console.log('\n🔧 TESTING WITH ULTRA-AGGRESSIVE SETTINGS');
    console.log('-'.repeat(50));
    
    const aggressiveDetector = new WorkflowPatternDetector({
      minPatternSize: 2,
      similarityThreshold: 0.1, // Very low
      confidenceThreshold: 0.1, // Very low
      logLevel: 'debug'
    });
    
    const aggressivePatterns = await aggressiveDetector.detectPatterns(workflows, { industry: 'technology' });
    console.log(`🔍 Ultra-aggressive patterns detected: ${aggressivePatterns.length}`);
    
    aggressivePatterns.forEach((pattern, index) => {
      console.log(`\n📋 Aggressive Pattern ${index + 1}:`);
      console.log(`   Type: ${pattern.pattern_type}`);
      console.log(`   Confidence: ${pattern.confidence}`);
      console.log(`   Workflows: ${pattern.workflow_count}`);
    });
    
  } catch (error) {
    console.error('❌ Debug failed:', error.message);
    console.error('Stack trace:', error.stack);
  }
}

// Run the debug
if (require.main === module) {
  debugPatternDetection().catch(console.error);
}

module.exports = debugPatternDetection;
