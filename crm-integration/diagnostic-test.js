/**
 * Deep Diagnostic Test - Find out why pattern detection and workflow analysis is failing
 */

require('dotenv').config({ path: '../.env' });
const winston = require('winston');
const HubSpotAdapter = require('./adapters/hubspot-adapter');

// Setup logging
const logger = winston.createLogger({
  level: 'debug',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.colorize(),
    winston.format.simple()
  ),
  transports: [new winston.transports.Console()]
});

async function diagnosticTest() {
  console.log('🔍 DEEP DIAGNOSTIC TEST');
  console.log('='.repeat(50));
  
  try {
    const hubspotConfig = {
      type: 'hubspot',
      organization_id: 'diagnostic_test',
      access_token: process.env.HUBSPOT_API_KEY || 'pat-na1-e5c61dcf-ac4b-4e68-8160-f515662e8234',
      base_url: 'https://api.hubapi.com'
    };
    
    const adapter = new HubSpotAdapter(hubspotConfig, { logLevel: 'debug' });
    await adapter.connect();
    
    // Test 1: Get single deal with full details
    console.log('\n🔍 TEST 1: Analyzing Single Deal in Detail');
    console.log('-'.repeat(40));
    
    const deals = await adapter.getDeals({ limit: 1 });
    if (deals.length === 0) {
      console.log('❌ No deals found');
      return;
    }
    
    const deal = deals[0];
    console.log('📋 Deal Summary:');
    console.log(`   ID: ${deal.id}`);
    console.log(`   Name: ${deal.name || 'No name'}`);
    console.log(`   Amount: $${(deal.amount || 0).toLocaleString()}`);
    console.log(`   Stage: ${deal.stage || 'No stage'}`);
    console.log(`   Pipeline: ${deal.pipeline || 'No pipeline'}`);
    console.log(`   Created: ${deal.created_date || 'No date'}`);
    console.log(`   Status: ${deal.status || 'No status'}`);
    
    // Test 2: Check individual API calls
    console.log('\n🔍 TEST 2: Testing Individual HubSpot API Calls');
    console.log('-'.repeat(40));
    
    console.log('Testing getDealActivities...');
    try {
      const activities = await adapter.getDealActivities(deal.id);
      console.log(`✅ Activities: ${activities.length} found`);
      if (activities.length > 0) {
        console.log(`   Sample: ${JSON.stringify(activities[0], null, 2)}`);
      }
    } catch (error) {
      console.log(`❌ Activities failed: ${error.message}`);
    }
    
    console.log('Testing getDealContacts...');
    try {
      const contacts = await adapter.getDealContacts(deal.id);
      console.log(`✅ Contacts: ${contacts.length} found`);
      if (contacts.length > 0) {
        console.log(`   Sample: ${JSON.stringify(contacts[0], null, 2)}`);
      }
    } catch (error) {
      console.log(`❌ Contacts failed: ${error.message}`);
    }
    
    console.log('Testing getDealCompanies...');
    try {
      const companies = await adapter.getDealCompanies(deal.id);
      console.log(`✅ Companies: ${companies.length} found`);
      if (companies.length > 0) {
        console.log(`   Sample: ${JSON.stringify(companies[0], null, 2)}`);
      }
    } catch (error) {
      console.log(`❌ Companies failed: ${error.message}`);
    }
    
    console.log('Testing getDealNotes...');
    try {
      const notes = await adapter.getDealNotes(deal.id);
      console.log(`✅ Notes: ${notes.length} found`);
      if (notes.length > 0) {
        console.log(`   Sample: ${JSON.stringify(notes[0], null, 2)}`);
      }
    } catch (error) {
      console.log(`❌ Notes failed: ${error.message}`);
    }
    
    console.log('Testing getDealTasks...');
    try {
      const tasks = await adapter.getDealTasks(deal.id);
      console.log(`✅ Tasks: ${tasks.length} found`);
      if (tasks.length > 0) {
        console.log(`   Sample: ${JSON.stringify(tasks[0], null, 2)}`);
      }
    } catch (error) {
      console.log(`❌ Tasks failed: ${error.message}`);
    }
    
    // Test 3: Check pipeline data
    console.log('\n🔍 TEST 3: Testing Pipeline Data');
    console.log('-'.repeat(40));
    
    try {
      const pipelines = await adapter.getPipelines();
      console.log(`✅ Pipelines: ${pipelines.length} found`);
      pipelines.forEach((pipeline, index) => {
        console.log(`   ${index + 1}. ${pipeline.label} (${pipeline.stages.length} stages)`);
        pipeline.stages.forEach((stage, stageIndex) => {
          console.log(`      ${stageIndex + 1}. ${stage.label} (${stage.probability}% probability)`);
        });
      });
    } catch (error) {
      console.log(`❌ Pipelines failed: ${error.message}`);
    }
    
    // Test 4: Check what extractWorkflowFromDeal actually produces
    console.log('\n🔍 TEST 4: Deep Workflow Extraction Analysis');
    console.log('-'.repeat(40));
    
    try {
      const workflow = await adapter.extractWorkflowFromDeal(deal);
      console.log('📊 Extracted Workflow Analysis:');
      console.log(`   Workflow Type: ${workflow.workflow_type}`);
      console.log(`   Duration: ${workflow.duration_days} days`);
      console.log(`   Deal Value: $${(workflow.deal_value || 0).toLocaleString()}`);
      console.log(`   Status: ${workflow.status}`);
      console.log(`   Data Completeness: ${Math.round((workflow.data_completeness || 0) * 100)}%`);
      
      console.log('\n   📋 Workflow Structure:');
      console.log(`   Stages: ${workflow.stages?.length || 0}`);
      console.log(`   Activities: ${workflow.activities?.length || 0}`);
      console.log(`   Participants: ${workflow.participants?.length || 0}`);
      console.log(`   Timeline entries: ${Object.keys(workflow.timeline || {}).length}`);
      
      if (workflow.stages?.length > 0) {
        console.log('\n   🎯 Stages Detail:');
        workflow.stages.forEach((stage, index) => {
          console.log(`      ${index + 1}. ${stage.name} (${stage.duration || 0} days, ${stage.activities?.length || 0} activities)`);
        });
      }
      
      if (workflow.activities?.length > 0) {
        console.log('\n   📞 Activities Detail:');
        workflow.activities.slice(0, 3).forEach((activity, index) => {
          console.log(`      ${index + 1}. ${activity.type} - ${activity.subject || 'No subject'} (${activity.date})`);
        });
      }
      
      if (workflow.participants?.length > 0) {
        console.log('\n   👥 Participants Detail:');
        workflow.participants.slice(0, 3).forEach((participant, index) => {
          console.log(`      ${index + 1}. ${participant.name} (${participant.type}) - ${participant.role || 'No role'}`);
        });
      }
      
    } catch (error) {
      console.log(`❌ Workflow extraction failed: ${error.message}`);
      console.log(`   Stack: ${error.stack}`);
    }
    
    // Test 5: Check HubSpot API permissions and scopes
    console.log('\n🔍 TEST 5: HubSpot API Permissions Analysis');
    console.log('-'.repeat(40));
    
    console.log('Current API issues identified:');
    console.log('1. Limited scopes - need: crm.objects.contacts.read, crm.objects.companies.read');
    console.log('2. Activities API may not be accessible');
    console.log('3. Association API might have permission issues');
    console.log('4. Pipeline API access unclear');
    
  } catch (error) {
    console.error('❌ Diagnostic test failed:', error.message);
    console.error('Stack trace:', error.stack);
  }
}

// Run the diagnostic
if (require.main === module) {
  diagnosticTest().catch(console.error);
}

module.exports = diagnosticTest;

