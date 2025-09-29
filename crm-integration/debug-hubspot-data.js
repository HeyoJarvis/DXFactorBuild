/**
 * Debug HubSpot Data Retrieval - Find out what data is actually available
 */

require('dotenv').config({ path: '../.env' });
const { Client } = require('@hubspot/api-client');

async function debugHubSpotData() {
  console.log('🔍 DEBUGGING HUBSPOT DATA RETRIEVAL');
  console.log('='.repeat(50));
  
  const hubspotClient = new Client({
    accessToken: process.env.HUBSPOT_API_KEY || 'pat-na1-e5c61dcf-ac4b-4e68-8160-f515662e8234'
  });
  
  try {
    // Test 1: Basic connection and available data
    console.log('\n📊 TEST 1: Basic Deal Count and Properties');
    console.log('-'.repeat(40));
    
    // Get total deal count first
    const dealsResponse = await hubspotClient.crm.deals.searchApi.doSearch({
      limit: 100,
      properties: [
        'dealname', 'amount', 'dealstage', 'pipeline', 'closedate', 
        'createdate', 'hs_lastmodifieddate', 'dealtype', 'amount_in_home_currency',
        'hs_deal_stage_probability', 'num_associated_contacts', 'hs_analytics_source'
      ]
    });
    
    console.log(`✅ Total deals found: ${dealsResponse.results.length}`);
    console.log(`✅ API call successful`);
    
    if (dealsResponse.results.length > 0) {
      console.log('\n📋 SAMPLE DEAL DATA:');
      const sampleDeal = dealsResponse.results[0];
      console.log(`Deal ID: ${sampleDeal.id}`);
      console.log(`Deal Name: ${sampleDeal.properties.dealname || 'No name'}`);
      console.log(`Amount: $${sampleDeal.properties.amount || 0}`);
      console.log(`Stage: ${sampleDeal.properties.dealstage || 'No stage'}`);
      console.log(`Pipeline: ${sampleDeal.properties.pipeline || 'No pipeline'}`);
      console.log(`Created: ${sampleDeal.properties.createdate || 'No date'}`);
      console.log(`Last Modified: ${sampleDeal.properties.hs_lastmodifieddate || 'No date'}`);
      console.log(`Close Date: ${sampleDeal.properties.closedate || 'No close date'}`);
      
      console.log('\n📋 ALL AVAILABLE PROPERTIES FOR SAMPLE DEAL:');
      Object.entries(sampleDeal.properties).forEach(([key, value]) => {
        if (value) {
          console.log(`  ${key}: ${value}`);
        }
      });
    }
    
    // Test 2: Check different deal filters
    console.log('\n📊 TEST 2: Different Deal Queries');
    console.log('-'.repeat(40));
    
    // Get recent deals
    const recentDealsResponse = await hubspotClient.crm.deals.searchApi.doSearch({
      limit: 50,
      properties: ['dealname', 'amount', 'dealstage', 'createdate'],
      sorts: [{ propertyName: 'createdate', direction: 'DESCENDING' }]
    });
    console.log(`✅ Recent deals: ${recentDealsResponse.results.length}`);
    
    // Get deals with amount > 0
    const valuableDealsResponse = await hubspotClient.crm.deals.searchApi.doSearch({
      limit: 50,
      properties: ['dealname', 'amount', 'dealstage'],
      filterGroups: [{
        filters: [{
          propertyName: 'amount',
          operator: 'GT',
          value: '0'
        }]
      }]
    });
    console.log(`✅ Deals with value > $0: ${valuableDealsResponse.results.length}`);
    
    // Get open deals
    const openDealsResponse = await hubspotClient.crm.deals.searchApi.doSearch({
      limit: 50,
      properties: ['dealname', 'amount', 'dealstage'],
      filterGroups: [{
        filters: [{
          propertyName: 'hs_is_closed',
          operator: 'EQ',
          value: 'false'
        }]
      }]
    });
    console.log(`✅ Open deals: ${openDealsResponse.results.length}`);
    
    // Test 3: Check pipelines
    console.log('\n📊 TEST 3: Pipeline Data');
    console.log('-'.repeat(40));
    
    const pipelinesResponse = await hubspotClient.crm.pipelines.pipelinesApi.getAll('deals');
    console.log(`✅ Pipelines found: ${pipelinesResponse.results.length}`);
    
    pipelinesResponse.results.forEach((pipeline, index) => {
      console.log(`\n  Pipeline ${index + 1}: ${pipeline.label} (ID: ${pipeline.id})`);
      console.log(`    Stages: ${pipeline.stages.length}`);
      pipeline.stages.forEach((stage, stageIndex) => {
        console.log(`      ${stageIndex + 1}. ${stage.label} (ID: ${stage.id}, ${stage.metadata?.probability || 0}% probability)`);
      });
      
      // We'll count deals in this pipeline later
    });
    
    // Test 4: Test associations with a sample deal
    console.log('\n📊 TEST 4: Association Data for Sample Deal');
    console.log('-'.repeat(40));
    
    if (dealsResponse.results.length > 0) {
      const dealId = dealsResponse.results[0].id;
      console.log(`Testing associations for deal: ${dealId}`);
      
      // Test contacts association
      try {
        const contactsResponse = await hubspotClient.crm.associations.v4.basicApi
          .getPage('deals', dealId, 'contacts');
        console.log(`✅ Contacts associated: ${contactsResponse.results?.length || 0}`);
        
        if (contactsResponse.results && contactsResponse.results.length > 0) {
          console.log(`   Sample contact ID: ${contactsResponse.results[0].toObjectId}`);
          
          // Get contact details
          const contactDetail = await hubspotClient.crm.contacts.basicApi
            .getById(contactsResponse.results[0].toObjectId, ['firstname', 'lastname', 'email', 'jobtitle']);
          console.log(`   Contact: ${contactDetail.properties.firstname} ${contactDetail.properties.lastname}`);
          console.log(`   Email: ${contactDetail.properties.email}`);
          console.log(`   Title: ${contactDetail.properties.jobtitle}`);
        }
      } catch (error) {
        console.log(`❌ Contacts association failed: ${error.message}`);
      }
      
      // Test companies association
      try {
        const companiesResponse = await hubspotClient.crm.associations.v4.basicApi
          .getPage('deals', dealId, 'companies');
        console.log(`✅ Companies associated: ${companiesResponse.results?.length || 0}`);
        
        if (companiesResponse.results && companiesResponse.results.length > 0) {
          const companyDetail = await hubspotClient.crm.companies.basicApi
            .getById(companiesResponse.results[0].toObjectId, ['name', 'domain', 'industry']);
          console.log(`   Company: ${companyDetail.properties.name}`);
          console.log(`   Domain: ${companyDetail.properties.domain}`);
          console.log(`   Industry: ${companyDetail.properties.industry}`);
        }
      } catch (error) {
        console.log(`❌ Companies association failed: ${error.message}`);
      }
      
      // Test activities association
      try {
        const callsResponse = await hubspotClient.crm.associations.v4.basicApi
          .getPage('deals', dealId, 'calls');
        console.log(`✅ Calls associated: ${callsResponse.results?.length || 0}`);
        
        const emailsResponse = await hubspotClient.crm.associations.v4.basicApi
          .getPage('deals', dealId, 'emails');
        console.log(`✅ Emails associated: ${emailsResponse.results?.length || 0}`);
        
        const meetingsResponse = await hubspotClient.crm.associations.v4.basicApi
          .getPage('deals', dealId, 'meetings');
        console.log(`✅ Meetings associated: ${meetingsResponse.results?.length || 0}`);
        
        const notesResponse = await hubspotClient.crm.associations.v4.basicApi
          .getPage('deals', dealId, 'notes');
        console.log(`✅ Notes associated: ${notesResponse.results?.length || 0}`);
        
        const tasksResponse = await hubspotClient.crm.associations.v4.basicApi
          .getPage('deals', dealId, 'tasks');
        console.log(`✅ Tasks associated: ${tasksResponse.results?.length || 0}`);
        
      } catch (error) {
        console.log(`❌ Activities association failed: ${error.message}`);
      }
    }
    
    // Test 5: Check what deals actually have rich data
    console.log('\n📊 TEST 5: Find Deals with Rich Data');
    console.log('-'.repeat(40));
    
    let richDataDeals = [];
    
    for (let i = 0; i < Math.min(20, dealsResponse.results.length); i++) {
      const deal = dealsResponse.results[i];
      let richness = 0;
      let details = {
        id: deal.id,
        name: deal.properties.dealname || 'No name',
        amount: deal.properties.amount || 0,
        contacts: 0,
        companies: 0,
        activities: 0
      };
      
      try {
        // Count contacts
        const contactsResponse = await hubspotClient.crm.associations.v4.basicApi
          .getPage('deals', deal.id, 'contacts');
        details.contacts = contactsResponse.results?.length || 0;
        richness += details.contacts;
        
        // Count companies
        const companiesResponse = await hubspotClient.crm.associations.v4.basicApi
          .getPage('deals', deal.id, 'companies');
        details.companies = companiesResponse.results?.length || 0;
        richness += details.companies;
        
        // Count activities
        const callsResponse = await hubspotClient.crm.associations.v4.basicApi
          .getPage('deals', deal.id, 'calls');
        const emailsResponse = await hubspotClient.crm.associations.v4.basicApi
          .getPage('deals', deal.id, 'emails');
        const meetingsResponse = await hubspotClient.crm.associations.v4.basicApi
          .getPage('deals', deal.id, 'meetings');
        
        details.activities = (callsResponse.results?.length || 0) + 
                           (emailsResponse.results?.length || 0) + 
                           (meetingsResponse.results?.length || 0);
        richness += details.activities;
        
        details.richness = richness;
        richDataDeals.push(details);
        
      } catch (error) {
        console.log(`   Deal ${deal.id}: Error checking associations`);
      }
    }
    
    // Sort by richness
    richDataDeals.sort((a, b) => b.richness - a.richness);
    
    console.log('\n🏆 TOP 10 DEALS BY DATA RICHNESS:');
    richDataDeals.slice(0, 10).forEach((deal, index) => {
      console.log(`${index + 1}. ${deal.name} (${deal.id})`);
      console.log(`   Amount: $${deal.amount}, Contacts: ${deal.contacts}, Companies: ${deal.companies}, Activities: ${deal.activities}`);
      console.log(`   Richness Score: ${deal.richness}`);
    });
    
    console.log('\n✅ HUBSPOT DATA RETRIEVAL ANALYSIS COMPLETE!');
    console.log(`📊 Total deals: ${dealsResponse.results.length}`);
    console.log(`📊 Deals with rich data: ${richDataDeals.filter(d => d.richness > 0).length}`);
    console.log(`📊 Best deal richness score: ${richDataDeals[0]?.richness || 0}`);
    
  } catch (error) {
    console.error('❌ Debug failed:', error.message);
    console.error('Stack trace:', error.stack);
  }
}

// Run the debug
if (require.main === module) {
  debugHubSpotData().catch(console.error);
}

module.exports = debugHubSpotData;
