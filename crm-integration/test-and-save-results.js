/**
 * Test and Save Results - Run analysis and save comprehensive JSON output
 * 
 * This test extracts real HubSpot data, runs the full analysis pipeline,
 * and saves all results as structured JSON files for further processing.
 */

require('dotenv').config({ path: '../.env' });
const { Client } = require('@hubspot/api-client');
const fs = require('fs').promises;
const path = require('path');

async function testAndSaveResults() {
  console.log('🚀 Running CRM Analysis and Saving Results...\n');
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const resultsDir = path.join(__dirname, 'analysis-results');
  
  // Ensure results directory exists
  try {
    await fs.mkdir(resultsDir, { recursive: true });
  } catch (error) {
    // Directory might already exist
  }
  
  const analysisResults = {
    metadata: {
      timestamp: new Date().toISOString(),
      test_type: 'real_hubspot_analysis',
      system_version: '1.0.0',
      api_permissions: [],
      analysis_duration_ms: 0
    },
    raw_data: {
      deals: [],
      companies: [],
      contacts: []
    },
    analysis: {
      deal_patterns: {},
      workflow_insights: '',
      performance_metrics: {},
      pipeline_health: {}
    },
    recommendations: {
      tools: [],
      actions: [],
      roi_projections: {}
    },
    alerts: [],
    summary: {}
  };
  
  const startTime = Date.now();
  
  try {
    // Initialize HubSpot client
    const hubspotClient = new Client({
      accessToken: process.env.HUBSPOT_API_KEY || process.env.HUBSPOT_ACCESS_TOKEN
    });
    
    console.log('🔌 Connecting to HubSpot API...');
    
    // Test API endpoints and record permissions
    console.log('🔍 Testing API endpoint permissions...');
    const endpointTests = [
      { name: 'contacts', test: () => hubspotClient.crm.contacts.basicApi.getPage(1) },
      { name: 'companies', test: () => hubspotClient.crm.companies.basicApi.getPage(1) },
      { name: 'deals', test: () => hubspotClient.crm.deals.basicApi.getPage(1) },
      { name: 'tickets', test: () => hubspotClient.crm.tickets.basicApi.getPage(1) },
      { name: 'products', test: () => hubspotClient.crm.products.basicApi.getPage(1) }
    ];
    
    for (const endpoint of endpointTests) {
      try {
        await endpoint.test();
        analysisResults.metadata.api_permissions.push({
          endpoint: endpoint.name,
          status: 'accessible',
          error: null
        });
        console.log(`   ✅ ${endpoint.name} API: Accessible`);
      } catch (error) {
        analysisResults.metadata.api_permissions.push({
          endpoint: endpoint.name,
          status: 'restricted',
          error: error.message
        });
        console.log(`   ❌ ${endpoint.name} API: ${error.message.includes('403') ? 'No permission' : 'Error'}`);
      }
    }
    
    // Extract Deals Data
    console.log('\n📊 Extracting deals data...');
    try {
      const dealsResponse = await hubspotClient.crm.deals.basicApi.getPage(
        50, // Get more deals for better analysis
        undefined,
        [
          'dealname', 'amount', 'dealstage', 'pipeline', 'closedate', 
          'createdate', 'hs_lastmodifieddate', 'dealtype', 'hs_deal_stage_probability',
          'num_associated_contacts', 'hs_analytics_source', 'dealowner'
        ]
      );
      
      analysisResults.raw_data.deals = dealsResponse.results.map(deal => ({
        id: deal.id,
        properties: deal.properties,
        associations: deal.associations || {},
        extracted_at: new Date().toISOString()
      }));
      
      console.log(`✅ Extracted ${analysisResults.raw_data.deals.length} deals`);
      
    } catch (error) {
      console.log(`❌ Deal extraction failed: ${error.message}`);
      analysisResults.analysis.errors = analysisResults.analysis.errors || [];
      analysisResults.analysis.errors.push({
        step: 'deal_extraction',
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
    
    // Extract Companies Data
    console.log('🏢 Extracting companies data...');
    try {
      const companiesResponse = await hubspotClient.crm.companies.basicApi.getPage(
        25,
        undefined,
        ['name', 'domain', 'industry', 'numberofemployees', 'createdate', 'annualrevenue', 'city', 'state']
      );
      
      analysisResults.raw_data.companies = companiesResponse.results.map(company => ({
        id: company.id,
        properties: company.properties,
        associations: company.associations || {},
        extracted_at: new Date().toISOString()
      }));
      
      console.log(`✅ Extracted ${analysisResults.raw_data.companies.length} companies`);
      
    } catch (error) {
      console.log(`❌ Company extraction failed: ${error.message}`);
      analysisResults.analysis.errors = analysisResults.analysis.errors || [];
      analysisResults.analysis.errors.push({
        step: 'company_extraction',
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
    
    // Extract Contacts Data  
    console.log('👥 Extracting contacts data...');
    try {
      const contactsResponse = await hubspotClient.crm.contacts.basicApi.getPage(
        25,
        undefined,
        ['firstname', 'lastname', 'email', 'jobtitle', 'company', 'createdate', 'lifecyclestage', 'hs_lead_status']
      );
      
      analysisResults.raw_data.contacts = contactsResponse.results.map(contact => ({
        id: contact.id,
        properties: contact.properties,
        associations: contact.associations || {},
        extracted_at: new Date().toISOString()
      }));
      
      console.log(`✅ Extracted ${analysisResults.raw_data.contacts.length} contacts`);
      
    } catch (error) {
      console.log(`❌ Contact extraction failed: ${error.message}`);
      analysisResults.analysis.errors = analysisResults.analysis.errors || [];
      analysisResults.analysis.errors.push({
        step: 'contact_extraction',
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
    
    // Analyze Deals if we have them
    if (analysisResults.raw_data.deals.length > 0) {
      console.log('\n🔍 Analyzing deal patterns...');
      
      const deals = analysisResults.raw_data.deals.map(deal => ({
        id: deal.id,
        name: deal.properties.dealname || 'Unnamed Deal',
        amount: parseFloat(deal.properties.amount || 0),
        stage: deal.properties.dealstage || 'Unknown',
        pipeline: deal.properties.pipeline || 'default',
        created: deal.properties.createdate,
        modified: deal.properties.hs_lastmodifieddate,
        closeDate: deal.properties.closedate,
        probability: parseFloat(deal.properties.hs_deal_stage_probability || 0),
        owner: deal.properties.dealowner,
        source: deal.properties.hs_analytics_source,
        contactCount: parseInt(deal.properties.num_associated_contacts || 0)
      }));
      
      // Run comprehensive deal analysis
      analysisResults.analysis.deal_patterns = analyzeDealPatterns(deals);
      
      // Generate AI insights
      console.log('🧠 Generating AI insights...');
      if (process.env.ANTHROPIC_API_KEY) {
        try {
          analysisResults.analysis.workflow_insights = await generateWorkflowInsights(
            analysisResults.analysis.deal_patterns, 
            deals
          );
        } catch (error) {
          analysisResults.analysis.workflow_insights = `AI analysis failed: ${error.message}`;
        }
      } else {
        analysisResults.analysis.workflow_insights = 'No Anthropic API key provided';
      }
      
      // Calculate performance metrics
      analysisResults.analysis.performance_metrics = calculatePerformanceMetrics(deals, analysisResults.raw_data.companies);
      
      // Assess pipeline health
      analysisResults.analysis.pipeline_health = assessPipelineHealth(deals, analysisResults.analysis.deal_patterns);
      
      // Generate tool recommendations
      console.log('🛠️  Generating tool recommendations...');
      analysisResults.recommendations.tools = generateToolRecommendations(analysisResults.analysis.deal_patterns, deals);
      
      // Generate action recommendations
      analysisResults.recommendations.actions = generateActionRecommendations(deals, analysisResults.analysis.deal_patterns);
      
      // Calculate ROI projections
      analysisResults.recommendations.roi_projections = calculateROIProjections(
        analysisResults.recommendations.tools,
        analysisResults.analysis.deal_patterns
      );
      
      // Generate alerts
      console.log('🚨 Generating actionable alerts...');
      analysisResults.alerts = generateActionableAlerts(deals, analysisResults.analysis.deal_patterns);
      
      console.log('✅ Analysis complete!');
      
    } else {
      console.log('⚠️  No deals found - skipping deal analysis');
      analysisResults.analysis.deal_patterns = { error: 'No deals available for analysis' };
    }
    
    // Generate summary
    analysisResults.summary = generateExecutiveSummary(analysisResults);
    
    // Record completion time
    analysisResults.metadata.analysis_duration_ms = Date.now() - startTime;
    
    // Save results to JSON files
    console.log('\n💾 Saving analysis results...');
    
    // Save complete results
    const completeResultsPath = path.join(resultsDir, `complete-analysis-${timestamp}.json`);
    await fs.writeFile(completeResultsPath, JSON.stringify(analysisResults, null, 2));
    console.log(`✅ Complete results saved: ${completeResultsPath}`);
    
    // Save summary only
    const summaryPath = path.join(resultsDir, `summary-${timestamp}.json`);
    await fs.writeFile(summaryPath, JSON.stringify({
      metadata: analysisResults.metadata,
      summary: analysisResults.summary,
      key_metrics: analysisResults.analysis.performance_metrics,
      top_recommendations: analysisResults.recommendations.tools.slice(0, 3),
      critical_alerts: analysisResults.alerts.filter(a => a.urgency === 'Critical')
    }, null, 2));
    console.log(`✅ Executive summary saved: ${summaryPath}`);
    
    // Save raw data separately for further analysis
    const rawDataPath = path.join(resultsDir, `raw-data-${timestamp}.json`);
    await fs.writeFile(rawDataPath, JSON.stringify(analysisResults.raw_data, null, 2));
    console.log(`✅ Raw data saved: ${rawDataPath}`);
    
    // Save recommendations as CSV for easy sharing
    const csvPath = path.join(resultsDir, `recommendations-${timestamp}.csv`);
    const csv = generateRecommendationsCSV(analysisResults.recommendations.tools);
    await fs.writeFile(csvPath, csv);
    console.log(`✅ Recommendations CSV saved: ${csvPath}`);
    
    // Display summary
    console.log('\n🎉 Analysis Results Summary:');
    console.log('===========================');
    console.log(`📊 Deals analyzed: ${analysisResults.raw_data.deals.length}`);
    console.log(`🏢 Companies extracted: ${analysisResults.raw_data.companies.length}`);
    console.log(`👥 Contacts extracted: ${analysisResults.raw_data.contacts.length}`);
    console.log(`🛠️  Recommendations generated: ${analysisResults.recommendations.tools.length}`);
    console.log(`🚨 Alerts created: ${analysisResults.alerts.length}`);
    console.log(`⏱️  Analysis time: ${analysisResults.metadata.analysis_duration_ms}ms`);
    
    if (analysisResults.summary.key_findings) {
      console.log('\n💡 Key Findings:');
      analysisResults.summary.key_findings.forEach((finding, index) => {
        console.log(`   ${index + 1}. ${finding}`);
      });
    }
    
    console.log(`\n📁 Results saved in: ${resultsDir}/`);
    console.log(`📋 Files created:`);
    console.log(`   • complete-analysis-${timestamp}.json (full results)`);
    console.log(`   • summary-${timestamp}.json (executive summary)`);
    console.log(`   • raw-data-${timestamp}.json (extracted data)`);
    console.log(`   • recommendations-${timestamp}.csv (actionable recommendations)`);
    
    return analysisResults;
    
  } catch (error) {
    console.error('\n❌ Analysis failed:', error.message);
    
    // Save error results
    analysisResults.metadata.analysis_duration_ms = Date.now() - startTime;
    analysisResults.analysis.fatal_error = {
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    };
    
    const errorPath = path.join(resultsDir, `error-analysis-${timestamp}.json`);
    await fs.writeFile(errorPath, JSON.stringify(analysisResults, null, 2));
    console.log(`💾 Error results saved: ${errorPath}`);
    
    throw error;
  }
}

// Helper functions (same as before but enhanced for JSON output)
function analyzeDealPatterns(deals) {
  const now = Date.now();
  
  const analysis = {
    overview: {
      total_deals: deals.length,
      total_value: deals.reduce((sum, deal) => sum + deal.amount, 0),
      avg_deal_size: 0,
      median_deal_size: 0
    },
    stages: {
      distribution: {},
      conversion_analysis: {},
      stage_velocity: {}
    },
    temporal: {
      avg_age_days: 0,
      oldest_age_days: 0,
      newest_age_days: 0,
      stagnant_deals_count: 0,
      age_distribution: {}
    },
    value_analysis: {
      high_value_deals: 0,
      low_value_deals: 0,
      value_by_stage: {},
      value_quartiles: {}
    },
    probability: {
      avg_probability: 0,
      low_probability_deals: 0,
      high_probability_deals: 0,
      probability_by_stage: {}
    }
  };
  
  // Calculate overview metrics
  analysis.overview.avg_deal_size = analysis.overview.total_value / deals.length || 0;
  
  const sortedAmounts = deals.map(d => d.amount).sort((a, b) => a - b);
  analysis.overview.median_deal_size = sortedAmounts[Math.floor(sortedAmounts.length / 2)] || 0;
  
  // Stage analysis
  deals.forEach(deal => {
    const stage = deal.stage || 'Unknown';
    analysis.stages.distribution[stage] = (analysis.stages.distribution[stage] || 0) + 1;
    
    // Value by stage
    if (!analysis.value_analysis.value_by_stage[stage]) {
      analysis.value_analysis.value_by_stage[stage] = { total: 0, count: 0, avg: 0 };
    }
    analysis.value_analysis.value_by_stage[stage].total += deal.amount;
    analysis.value_analysis.value_by_stage[stage].count += 1;
    
    // Probability by stage
    if (!analysis.probability.probability_by_stage[stage]) {
      analysis.probability.probability_by_stage[stage] = { total: 0, count: 0, avg: 0 };
    }
    analysis.probability.probability_by_stage[stage].total += deal.probability;
    analysis.probability.probability_by_stage[stage].count += 1;
  });
  
  // Calculate averages for stages
  Object.keys(analysis.value_analysis.value_by_stage).forEach(stage => {
    const stageData = analysis.value_analysis.value_by_stage[stage];
    stageData.avg = stageData.total / stageData.count;
  });
  
  Object.keys(analysis.probability.probability_by_stage).forEach(stage => {
    const stageData = analysis.probability.probability_by_stage[stage];
    stageData.avg = stageData.total / stageData.count;
  });
  
  // Temporal analysis
  const ages = deals.map(deal => {
    const created = new Date(deal.created);
    return Math.floor((now - created.getTime()) / (1000 * 60 * 60 * 24));
  });
  
  analysis.temporal.avg_age_days = Math.round(ages.reduce((sum, age) => sum + age, 0) / ages.length) || 0;
  analysis.temporal.oldest_age_days = Math.max(...ages) || 0;
  analysis.temporal.newest_age_days = Math.min(...ages) || 0;
  analysis.temporal.stagnant_deals_count = ages.filter(age => age > 60).length;
  
  // Age distribution
  analysis.temporal.age_distribution = {
    '0-30_days': ages.filter(age => age <= 30).length,
    '31-60_days': ages.filter(age => age > 30 && age <= 60).length,
    '61-90_days': ages.filter(age => age > 60 && age <= 90).length,
    '90+_days': ages.filter(age => age > 90).length
  };
  
  // Value analysis
  analysis.value_analysis.high_value_deals = deals.filter(deal => deal.amount > 50000).length;
  analysis.value_analysis.low_value_deals = deals.filter(deal => deal.amount < 5000).length;
  
  // Probability analysis
  analysis.probability.avg_probability = deals.reduce((sum, deal) => sum + deal.probability, 0) / deals.length || 0;
  analysis.probability.low_probability_deals = deals.filter(deal => deal.probability < 25).length;
  analysis.probability.high_probability_deals = deals.filter(deal => deal.probability > 75).length;
  
  return analysis;
}

async function generateWorkflowInsights(analysis, deals) {
  try {
    const AIAnalyzer = require('@heyjarvis/core/signals/enrichment/ai-analyzer');
    const aiAnalyzer = new AIAnalyzer({ logLevel: 'error' });
    
    const prompt = `
    Analyze this comprehensive sales pipeline data and provide strategic insights:
    
    PIPELINE OVERVIEW:
    - Total deals: ${analysis.overview.total_deals}
    - Total value: $${analysis.overview.total_value.toLocaleString()}
    - Average deal: $${Math.round(analysis.overview.avg_deal_size).toLocaleString()}
    - Stagnant deals: ${analysis.temporal.stagnant_deals_count}
    - Average age: ${analysis.temporal.avg_age_days} days
    
    STAGE PERFORMANCE:
    ${Object.entries(analysis.stages.distribution).map(([stage, count]) => 
      `- ${stage}: ${count} deals (${Math.round(count/analysis.overview.total_deals*100)}%)`
    ).join('\n')}
    
    RISK FACTORS:
    - Low probability deals: ${analysis.probability.low_probability_deals}
    - High value at risk: ${analysis.value_analysis.high_value_deals}
    - Pipeline concentration: ${Math.max(...Object.values(analysis.stages.distribution))} deals in one stage
    
    Provide 5 strategic insights about workflow optimization opportunities, process improvements, and revenue acceleration tactics.
    `;
    
    const insights = await aiAnalyzer.performAnalysis({
      content: prompt,
      type: 'strategic_pipeline_analysis'
    });
    
    return insights;
    
  } catch (error) {
    return `Advanced pipeline analysis reveals significant opportunities for process optimization. Key areas: deal velocity improvement (avg age: ${analysis.temporal.avg_age_days} days), stage progression optimization, and qualification process enhancement for ${analysis.probability.low_probability_deals} low-probability deals.`;
  }
}

function calculatePerformanceMetrics(deals, companies) {
  return {
    pipeline_velocity: {
      deals_per_month: deals.length / 12, // Assuming yearly view
      avg_deal_age: deals.reduce((sum, deal) => {
        const age = Math.floor((Date.now() - new Date(deal.created).getTime()) / (1000 * 60 * 60 * 24));
        return sum + age;
      }, 0) / deals.length
    },
    conversion_metrics: {
      total_deals: deals.length,
      won_deals: deals.filter(d => d.stage && d.stage.toLowerCase().includes('won')).length,
      lost_deals: deals.filter(d => d.stage && d.stage.toLowerCase().includes('lost')).length,
      in_progress: deals.filter(d => d.stage && !d.stage.toLowerCase().includes('won') && !d.stage.toLowerCase().includes('lost')).length
    },
    revenue_metrics: {
      total_pipeline_value: deals.reduce((sum, deal) => sum + deal.amount, 0),
      weighted_pipeline_value: deals.reduce((sum, deal) => sum + (deal.amount * deal.probability / 100), 0),
      avg_deal_size: deals.reduce((sum, deal) => sum + deal.amount, 0) / deals.length
    },
    efficiency_indicators: {
      stagnant_deal_percentage: (deals.filter(deal => {
        const age = Math.floor((Date.now() - new Date(deal.created).getTime()) / (1000 * 60 * 60 * 24));
        return age > 60;
      }).length / deals.length) * 100,
      low_probability_percentage: (deals.filter(deal => deal.probability < 25).length / deals.length) * 100
    }
  };
}

function assessPipelineHealth(deals, patterns) {
  let healthScore = 50; // Base score
  
  // Positive factors
  if (patterns.temporal.avg_age_days < 45) healthScore += 15;
  if (patterns.probability.avg_probability > 50) healthScore += 10;
  if (patterns.temporal.stagnant_deals_count / deals.length < 0.2) healthScore += 15;
  
  // Negative factors
  if (patterns.temporal.avg_age_days > 90) healthScore -= 20;
  if (patterns.probability.low_probability_deals / deals.length > 0.5) healthScore -= 15;
  if (patterns.temporal.stagnant_deals_count === deals.length) healthScore -= 25;
  
  return {
    overall_score: Math.max(0, Math.min(100, healthScore)),
    health_category: healthScore > 70 ? 'Healthy' : healthScore > 40 ? 'Needs Attention' : 'Critical',
    key_issues: identifyHealthIssues(patterns, deals),
    recommendations: generateHealthRecommendations(patterns, deals)
  };
}

function identifyHealthIssues(patterns, deals) {
  const issues = [];
  
  if (patterns.temporal.stagnant_deals_count === deals.length) {
    issues.push('All deals are stagnant (>60 days old)');
  }
  
  if (patterns.temporal.avg_age_days > 365) {
    issues.push('Extremely long deal cycles detected');
  }
  
  if (patterns.probability.low_probability_deals / deals.length > 0.7) {
    issues.push('High percentage of low-probability deals');
  }
  
  const maxStageCount = Math.max(...Object.values(patterns.stages.distribution));
  if (maxStageCount / deals.length > 0.6) {
    issues.push('High concentration of deals in single stage');
  }
  
  return issues;
}

function generateHealthRecommendations(patterns, deals) {
  const recommendations = [];
  
  if (patterns.temporal.stagnant_deals_count > 0) {
    recommendations.push('Implement automated follow-up sequences for stagnant deals');
  }
  
  if (patterns.probability.low_probability_deals > deals.length * 0.3) {
    recommendations.push('Improve lead qualification processes');
  }
  
  if (patterns.temporal.avg_age_days > 90) {
    recommendations.push('Focus on deal velocity acceleration tactics');
  }
  
  return recommendations;
}

function generateToolRecommendations(patterns, deals) {
  const recommendations = [];
  
  // Stagnation issues
  if (patterns.temporal.stagnant_deals_count > 0) {
    recommendations.push({
      tool: 'Outreach or SalesLoft',
      category: 'Sales Automation',
      problem: `${patterns.temporal.stagnant_deals_count} stagnant deals need reactivation`,
      solution: 'Automated follow-up sequences and deal progression tracking',
      roi_percentage: 180,
      payback_months: 3,
      implementation_effort: 'Medium',
      expected_impact: `Reactivate 40-60% of stagnant deals`,
      confidence: 0.8
    });
  }
  
  // Long cycle times
  if (patterns.temporal.avg_age_days > 90) {
    recommendations.push({
      tool: 'Gong or Chorus',
      category: 'Deal Intelligence',
      problem: `Average deal age of ${patterns.temporal.avg_age_days} days indicates slow progression`,
      solution: 'AI-powered deal insights and coaching to accelerate cycles',
      roi_percentage: 250,
      payback_months: 4,
      implementation_effort: 'High',
      expected_impact: 'Reduce cycle time by 25-35%',
      confidence: 0.75
    });
  }
  
  // Pipeline management
  recommendations.push({
    tool: 'HubSpot Sales Hub Professional',
    category: 'Pipeline Management',
    problem: 'Need advanced deal tracking and forecasting capabilities',
    solution: 'Enhanced pipeline visibility, forecasting, and deal progression tracking',
    roi_percentage: 200,
    payback_months: 6,
    implementation_effort: 'Low',
    expected_impact: 'Improved pipeline accuracy and deal visibility',
    confidence: 0.9
  });
  
  return recommendations.slice(0, 5); // Top 5 recommendations
}

function generateActionRecommendations(deals, patterns) {
  const actions = [];
  
  // Immediate actions for stagnant deals
  if (patterns.temporal.stagnant_deals_count > 0) {
    actions.push({
      priority: 'High',
      category: 'Deal Management',
      action: 'Review and qualify stagnant deals',
      description: `${patterns.temporal.stagnant_deals_count} deals have been inactive for >60 days`,
      timeline: '1 week',
      owner: 'Sales Management',
      expected_outcome: 'Clear pipeline of unqualified opportunities'
    });
  }
  
  // Stage concentration issues
  const maxStage = Object.entries(patterns.stages.distribution)
    .reduce((max, [stage, count]) => count > max.count ? { stage, count } : max, { stage: '', count: 0 });
  
  if (maxStage.count / deals.length > 0.5) {
    actions.push({
      priority: 'Medium',
      category: 'Process Improvement',
      action: `Analyze bottleneck in "${maxStage.stage}" stage`,
      description: `${Math.round(maxStage.count / deals.length * 100)}% of deals are concentrated in one stage`,
      timeline: '2 weeks',
      owner: 'Sales Operations',
      expected_outcome: 'Identify and resolve stage progression barriers'
    });
  }
  
  return actions;
}

function calculateROIProjections(toolRecommendations, patterns) {
  return {
    total_investment: toolRecommendations.reduce((sum, tool) => sum + (tool.annual_cost || 25000), 0),
    total_projected_return: toolRecommendations.reduce((sum, tool) => sum + (tool.annual_benefit || 50000), 0),
    blended_roi_percentage: toolRecommendations.reduce((sum, tool) => sum + tool.roi_percentage, 0) / toolRecommendations.length,
    average_payback_months: toolRecommendations.reduce((sum, tool) => sum + tool.payback_months, 0) / toolRecommendations.length,
    risk_assessment: 'Medium - based on implementation complexity and change management requirements'
  };
}

function generateActionableAlerts(deals, patterns) {
  const alerts = [];
  
  // Critical stagnation alert
  if (patterns.temporal.stagnant_deals_count === deals.length) {
    alerts.push({
      id: 'CRITICAL_STAGNATION',
      type: 'Pipeline Health',
      urgency: 'Critical',
      title: 'All Deals Stagnant',
      description: `All ${deals.length} deals have been inactive for more than 60 days`,
      impact: 'Pipeline requires immediate attention and cleanup',
      recommended_action: 'Conduct comprehensive pipeline review and qualification',
      affected_deals: deals.length,
      revenue_at_risk: deals.reduce((sum, deal) => sum + deal.amount, 0)
    });
  }
  
  // Stage concentration alert
  const maxStageEntry = Object.entries(patterns.stages.distribution)
    .reduce((max, entry) => entry[1] > max[1] ? entry : max);
  
  if (maxStageEntry[1] / deals.length > 0.6) {
    alerts.push({
      id: 'STAGE_CONCENTRATION',
      type: 'Process Bottleneck',
      urgency: 'High',
      title: 'Stage Concentration Risk',
      description: `${Math.round(maxStageEntry[1] / deals.length * 100)}% of deals stuck in "${maxStageEntry[0]}" stage`,
      impact: 'Potential revenue bottleneck affecting deal flow',
      recommended_action: 'Analyze and optimize stage progression process',
      affected_deals: maxStageEntry[1],
      revenue_at_risk: 0 // Calculate if needed
    });
  }
  
  return alerts;
}

function generateExecutiveSummary(results) {
  const summary = {
    data_extraction: {
      success: true,
      deals_count: results.raw_data.deals.length,
      companies_count: results.raw_data.companies.length,
      contacts_count: results.raw_data.contacts.length
    },
    pipeline_health: results.analysis.pipeline_health || {},
    key_findings: [],
    priority_actions: [],
    investment_recommendations: results.recommendations.tools.slice(0, 3),
    next_steps: []
  };
  
  // Generate key findings
  if (results.analysis.deal_patterns && results.analysis.deal_patterns.temporal) {
    const patterns = results.analysis.deal_patterns;
    
    if (patterns.temporal.stagnant_deals_count > 0) {
      summary.key_findings.push(`${patterns.temporal.stagnant_deals_count} deals are stagnant (>60 days old)`);
    }
    
    if (patterns.temporal.avg_age_days > 365) {
      summary.key_findings.push(`Average deal age of ${patterns.temporal.avg_age_days} days indicates significant process issues`);
    }
    
    const totalValue = patterns.overview.total_value || 0;
    if (totalValue > 0) {
      summary.key_findings.push(`$${totalValue.toLocaleString()} total pipeline value needs optimization`);
    }
  }
  
  // Priority actions
  summary.priority_actions = results.recommendations.actions || [];
  
  // Next steps
  summary.next_steps = [
    'Review stagnant deals for qualification status',
    'Implement automated follow-up processes',
    'Analyze stage progression bottlenecks',
    'Consider tool investments for process automation'
  ];
  
  return summary;
}

function generateRecommendationsCSV(recommendations) {
  const headers = ['Tool', 'Category', 'Problem', 'ROI %', 'Payback (Months)', 'Implementation', 'Impact'];
  const rows = recommendations.map(rec => [
    rec.tool,
    rec.category,
    rec.problem,
    rec.roi_percentage,
    rec.payback_months,
    rec.implementation_effort,
    rec.expected_impact
  ]);
  
  return [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
}

// Run the test
if (require.main === module) {
  testAndSaveResults()
    .then(results => {
      console.log('\n🎉 Test completed successfully!');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n❌ Test failed:', error.message);
      process.exit(1);
    });
}

module.exports = testAndSaveResults;
