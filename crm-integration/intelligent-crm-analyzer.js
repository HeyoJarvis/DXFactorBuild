/**
 * Intelligent CRM Analyzer - Unified workflow analysis with company intelligence
 * 
 * Takes a company website as input, extracts company intelligence using Python module,
 * then analyzes CRM workflows with rich contextual recommendations.
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs').promises;
const winston = require('winston');

// CRM Integration components
const HubSpotAdapter = require('./adapters/hubspot-adapter');
const WorkflowPatternDetector = require('./intelligence/workflow-pattern-detector');
const { ToolRecommendationEngine } = require('./recommendations/tool-recommendation-engine');

class IntelligentCRMAnalyzer {
  constructor(options = {}) {
    this.options = {
      logLevel: 'info',
      pythonPath: '../company-intelligence-py',
      outputDir: './analysis-results',
      ...options
    };
    
    // Set the Python script directory
    this.pythonScriptDir = path.resolve(__dirname, this.options.pythonPath);
    
    this.logger = winston.createLogger({
      level: this.options.logLevel,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      defaultMeta: { service: 'intelligent-crm-analyzer' },
      transports: [
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
          )
        })
      ]
    });
  }

  /**
   * Main analysis workflow - from website to recommendations
   */
  async analyzeCompanyWorkflows(websiteUrl, crmConfig, options = {}) {
    const analysisId = `analysis_${Date.now()}`;
    
    try {
      this.logger.info('Starting intelligent CRM analysis', {
        website: websiteUrl,
        analysis_id: analysisId
      });

      // Step 1: Extract company intelligence using Python module
      this.logger.info('🔍 Extracting company intelligence...');
      const companyIntelligence = await this.extractCompanyIntelligence(websiteUrl);
      
      if (!companyIntelligence) {
        throw new Error('Failed to extract company intelligence');
      }

      this.logger.info('✅ Company intelligence extracted', {
        company: companyIntelligence.company_name,
        industry: companyIntelligence.organization_context?.industry,
        tech_sophistication: companyIntelligence.organization_context?.tech_sophistication
      });

      // Step 2: Extract CRM workflows with enhanced context
      this.logger.info('📊 Extracting CRM workflows...');
      const crmAdapter = this.createCRMAdapter(crmConfig, companyIntelligence);
      const workflows = await crmAdapter.extractWorkflows({
        limit: options.workflowLimit || 30,
        includeArchived: options.includeArchived || false
      });

      if (!workflows || workflows.length === 0) {
        throw new Error('No workflows found in CRM system');
      }

      this.logger.info(`✅ Extracted ${workflows.length} workflows from CRM`);

      // Step 3: Detect patterns with company context
      this.logger.info('🧠 Analyzing workflow patterns with company intelligence...');
      const patternDetector = new WorkflowPatternDetector({
        minPatternSize: 2,
        similarityThreshold: 0.68,
        confidenceThreshold: 0.6,
        logLevel: this.options.logLevel
      });

      const organizationContext = this.buildEnhancedContext(companyIntelligence);
      const patternAnalysis = await patternDetector.detectPatterns(workflows, organizationContext);

      // Step 4: Generate contextual recommendations
      this.logger.info('💡 Generating contextual tool recommendations...');
      const recommendationEngine = new ToolRecommendationEngine({
        logLevel: this.options.logLevel
      });

      // Create workflow analysis object for recommendations
      const workflowAnalysis = {
        workflows: workflows,
        patterns: patternAnalysis.patterns,
        bottlenecks: this.extractBottlenecks(patternAnalysis.patterns),
        success_factors: this.extractSuccessFactors(patternAnalysis.patterns),
        metrics: patternAnalysis.summary
      };

      const recommendations = await recommendationEngine.generateRecommendations(
        workflowAnalysis,
        organizationContext
      );

      // Step 5: Create comprehensive analysis report
      const analysisReport = this.buildAnalysisReport({
        analysisId,
        websiteUrl,
        companyIntelligence,
        workflows,
        patterns: patternAnalysis.patterns,
        recommendations,
        organizationContext
      });

      // Step 6: Save results
      await this.saveAnalysisResults(analysisId, analysisReport);

      this.logger.info('🎯 Analysis complete!', {
        analysis_id: analysisId,
        patterns_found: patternAnalysis.patterns?.length || 0,
        recommendations_generated: recommendations?.length || 0,
        company: companyIntelligence.company_name
      });

      return analysisReport;

    } catch (error) {
      this.logger.error('❌ Analysis failed', {
        analysis_id: analysisId,
        website: websiteUrl,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Extract company intelligence using Python module
   */
  async extractCompanyIntelligence(websiteUrl) {
    return new Promise((resolve, reject) => {
      const pythonScript = path.join(__dirname, this.options.pythonPath, 'analyze_company.py');
      
      this.logger.debug('Calling Python company intelligence extractor', {
        script: pythonScript,
        website: websiteUrl
      });

      const pythonProcess = spawn('python3', [pythonScript, websiteUrl], {
        cwd: path.join(__dirname, this.options.pythonPath),
        env: { ...process.env }
      });

      let stdout = '';
      let stderr = '';

      pythonProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      pythonProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      pythonProcess.on('close', async (code) => {
        if (code !== 0) {
          this.logger.error('Python intelligence extraction failed', {
            exit_code: code,
            stderr: stderr
          });
          reject(new Error(`Company intelligence extraction failed: ${stderr}`));
          return;
        }

        try {
          // First, try to find JSON in the output
          const lines = stdout.trim().split('\n');
          const jsonLine = lines.find(line => line.startsWith('{'));
          
          if (jsonLine) {
            const companyIntelligence = JSON.parse(jsonLine);
            resolve(companyIntelligence);
            return;
          }

          // If no JSON in output, look for exported file mentioned in output
          const exportMatch = stdout.match(/Full analysis exported to: ([^\s\n]+\.json)/);
          if (exportMatch) {
            const fs = require('fs');
            const path = require('path');
            const exportedFilePath = path.join(this.pythonScriptDir, exportMatch[1]);
            
            this.logger.info('Reading exported JSON file', { file_path: exportedFilePath });
            
            if (fs.existsSync(exportedFilePath)) {
              const fileContent = fs.readFileSync(exportedFilePath, 'utf8');
              const companyIntelligence = JSON.parse(fileContent);
              resolve(companyIntelligence);
              return;
            }
          }

          // If still no JSON, try to parse the formatted output
          const companyIntelligence = this.parseFormattedOutput(stdout);
          if (companyIntelligence) {
            resolve(companyIntelligence);
            return;
          }

          throw new Error('No JSON output found from Python script and no exported file detected');
          
        } catch (parseError) {
          this.logger.error('Failed to parse company intelligence', {
            error: parseError.message,
            stdout_length: stdout.length,
            stderr: stderr
          });
          reject(parseError);
        }
      });

      pythonProcess.on('error', (error) => {
        this.logger.error('Failed to spawn Python process', {
          error: error.message
        });
        reject(error);
      });
    });
  }

  /**
   * Parse formatted output from Python script into structured data
   * @param {string} formattedOutput - The formatted text output from Python
   * @returns {Object|null} Parsed company intelligence data
   */
  parseFormattedOutput(formattedOutput) {
    try {
      const lines = formattedOutput.split('\n');
      const intelligence = {
        company: {},
        organization_context: {},
        technology_stack: {},
        workflow_intelligence: {},
        process_maturity: {},
        market_intelligence: {},
        data_quality: {}
      };

      // Extract company name
      const companyMatch = formattedOutput.match(/Company: ([^\n]+)/);
      if (companyMatch) {
        intelligence.company.name = companyMatch[1].trim();
      }

      // Extract website
      const websiteMatch = formattedOutput.match(/Website: ([^\n]+)/);
      if (websiteMatch) {
        intelligence.company.website = websiteMatch[1].trim();
      }

      // Extract industry
      const industryMatch = formattedOutput.match(/Industry: ([^\n]+)/);
      if (industryMatch) {
        intelligence.company.industry = industryMatch[1].trim();
      }

      // Extract description
      const descriptionMatch = formattedOutput.match(/Description: ([^\n]+)/);
      if (descriptionMatch) {
        intelligence.company.description = descriptionMatch[1].trim();
      }

      // Extract organization context
      const orgSizeMatch = formattedOutput.match(/Company Size: ([^\n]+)/);
      if (orgSizeMatch) {
        intelligence.organization_context.company_size = orgSizeMatch[1].trim();
      }

      const businessModelMatch = formattedOutput.match(/Business Model: ([^\n]+)/);
      if (businessModelMatch) {
        intelligence.organization_context.business_model = businessModelMatch[1].trim();
      }

      const salesComplexityMatch = formattedOutput.match(/Sales Complexity: ([^\n]+)/);
      if (salesComplexityMatch) {
        intelligence.organization_context.sales_complexity = salesComplexityMatch[1].trim();
      }

      const techSophisticationMatch = formattedOutput.match(/Tech Sophistication: ([^\n]+)/);
      if (techSophisticationMatch) {
        intelligence.organization_context.tech_sophistication = techSophisticationMatch[1].trim();
      }

      // Extract workflow intelligence
      const manualProcessesMatch = formattedOutput.match(/Manual Processes: ([^\n]+)/);
      if (manualProcessesMatch) {
        intelligence.workflow_intelligence.manual_processes = manualProcessesMatch[1].trim().split(', ');
      }

      const automationGapsMatch = formattedOutput.match(/Automation Gaps: ([^\n]+)/);
      if (automationGapsMatch) {
        intelligence.workflow_intelligence.automation_gaps = automationGapsMatch[1].trim().split(', ');
      }

      const integrationNeedsMatch = formattedOutput.match(/Integration Needs: ([^\n]+)/);
      if (integrationNeedsMatch) {
        intelligence.workflow_intelligence.integration_needs = integrationNeedsMatch[1].trim().split(', ');
      }

      // Extract confidence score
      const confidenceMatch = formattedOutput.match(/Overall Confidence: ([0-9.]+)%/);
      if (confidenceMatch) {
        intelligence.data_quality.overall_confidence = parseFloat(confidenceMatch[1]);
      }

      // Generate organization ID
      if (intelligence.company.website) {
        const domain = intelligence.company.website.replace(/^https?:\/\//, '').replace(/\/$/, '');
        intelligence.organization_context.organization_id = domain.replace(/\./g, '_');
      }

      this.logger.info('Successfully parsed formatted output', {
        company: intelligence.company.name,
        confidence: intelligence.data_quality.overall_confidence
      });

      return intelligence;
    } catch (error) {
      this.logger.warn('Failed to parse formatted output', {
        error: error.message
      });
      return null;
    }
  }

  /**
   * Extract bottlenecks from workflow patterns for recommendations
   * @param {Array} patterns - Detected workflow patterns
   * @returns {Array} List of bottlenecks
   */
  extractBottlenecks(patterns) {
    const bottlenecks = [];
    
    for (const pattern of patterns) {
      if (pattern.bottlenecks && pattern.bottlenecks.length > 0) {
        bottlenecks.push(...pattern.bottlenecks.map(bottleneck => ({
          ...bottleneck,
          pattern_id: pattern.id,
          pattern_name: pattern.name,
          affected_workflows: pattern.workflow_count
        })));
      }
      
      // Extract bottlenecks from issues
      if (pattern.issues && pattern.issues.length > 0) {
        bottlenecks.push(...pattern.issues.map(issue => ({
          type: 'process_issue',
          description: issue,
          severity: 'medium',
          pattern_id: pattern.id,
          pattern_name: pattern.name,
          affected_workflows: pattern.workflow_count
        })));
      }
    }
    
    return bottlenecks;
  }

  /**
   * Extract success factors from workflow patterns for amplification
   * @param {Array} patterns - Detected workflow patterns  
   * @returns {Array} List of success factors
   */
  extractSuccessFactors(patterns) {
    const successFactors = [];
    
    for (const pattern of patterns) {
      if (pattern.success_factors && pattern.success_factors.length > 0) {
        successFactors.push(...pattern.success_factors.map(factor => ({
          ...factor,
          pattern_id: pattern.id,
          pattern_name: pattern.name,
          affected_workflows: pattern.workflow_count
        })));
      }
      
      // High confidence patterns are success indicators
      if (pattern.confidence > 0.8) {
        successFactors.push({
          type: 'high_confidence_pattern',
          description: `Strong pattern detection: ${pattern.name}`,
          confidence: pattern.confidence,
          pattern_id: pattern.id,
          pattern_name: pattern.name,
          affected_workflows: pattern.workflow_count
        });
      }
    }
    
    return successFactors;
  }

  /**
   * Legacy compatibility method for background service
   * Analyzes workflows without company intelligence (CRM-only analysis)
   * @param {string} organizationId - Organization identifier
   * @returns {Object} Analysis results in legacy format
   */
  async analyzeWorkflows(organizationId) {
    try {
      this.logger.info('Running legacy workflow analysis', { organization_id: organizationId });
      
      // Use stored CRM config or create a basic one
      const crmConfig = {
        type: 'hubspot',
        organization_id: organizationId,
        access_token: process.env.HUBSPOT_API_KEY || process.env.HUBSPOT_ACCESS_TOKEN
      };

      // Create CRM adapter without company intelligence
      const crmAdapter = this.createCRMAdapter(crmConfig, { organization_context: { organization_id: organizationId } });
      
      // Extract workflows
      const workflows = await crmAdapter.extractWorkflows({ limit: 50 });
      
      // Analyze patterns
      const patternDetector = new WorkflowPatternDetector({
        logLevel: this.options.logLevel
      });
      
      const patternAnalysis = await patternDetector.detectPatterns(workflows, {
        organization_id: organizationId
      });

      // Convert to legacy format
      const legacyResults = this.convertToLegacyFormat(workflows, patternAnalysis);
      
      this.logger.info('Legacy workflow analysis completed', {
        organization_id: organizationId,
        workflows_analyzed: workflows.length,
        patterns_found: patternAnalysis.patterns.length
      });
      
      return legacyResults;
      
    } catch (error) {
      this.logger.error('Legacy workflow analysis failed', {
        organization_id: organizationId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Convert new analysis format to legacy format for background service compatibility
   */
  convertToLegacyFormat(workflows, patternAnalysis) {
    const successfulWorkflows = workflows.filter(w => 
      w.status === 'completed' || 
      w.status === 'won' || 
      (w.stages && w.stages.some(stage => stage.is_closed_won))
    );
    
    const avgCycleTime = workflows.reduce((sum, w) => sum + (w.duration_days || 0), 0) / workflows.length;
    const conversionRate = successfulWorkflows.length / workflows.length;
    
    // Calculate workflow health score (0-100)
    const healthScore = Math.max(0, Math.min(100, 
      (conversionRate * 40) + 
      (Math.max(0, 100 - avgCycleTime) * 0.3) + 
      (patternAnalysis.summary.data_completeness * 0.3)
    ));

    return {
      summary: {
        total_workflows: workflows.length,
        successful_workflows: successfulWorkflows.length,
        avg_cycle_time: avgCycleTime,
        conversion_rate: conversionRate,
        workflow_health_score: healthScore,
        data_completeness: patternAnalysis.summary.data_completeness,
        patterns_detected: patternAnalysis.patterns.length
      },
      workflows: workflows,
      patterns: patternAnalysis.patterns,
      bottlenecks: patternAnalysis.patterns.flatMap(p => p.bottlenecks || []),
      success_factors: patternAnalysis.patterns.flatMap(p => p.success_factors || []),
      recommendations: [] // Background service doesn't use recommendations
    };
  }

  /**
   * Create CRM adapter with company intelligence context
   */
  createCRMAdapter(crmConfig, companyIntelligence) {
    // Enhance CRM config with company context
    const enhancedConfig = {
      ...crmConfig,
      organization_id: companyIntelligence.organization_context?.organization_id || 'unknown',
      company_context: companyIntelligence
    };

    // For now, only HubSpot is supported
    if (crmConfig.type === 'hubspot' || crmConfig.access_token) {
      return new HubSpotAdapter(enhancedConfig);
    }

    throw new Error(`Unsupported CRM type: ${crmConfig.type}`);
  }

  /**
   * Build enhanced organization context combining CRM and intelligence data
   */
  buildEnhancedContext(companyIntelligence) {
    const orgContext = companyIntelligence.organization_context || {};
    const workflowIntel = companyIntelligence.workflow_intelligence || {};
    const techStack = companyIntelligence.technology_stack || {};
    const processMaturity = companyIntelligence.process_maturity || {};

    return {
      // Basic organization info
      organization_id: orgContext.organization_id || 'unknown',
      company_name: companyIntelligence.company_name,
      industry: orgContext.industry,
      sub_industry: orgContext.sub_industry,
      company_size: orgContext.company_size,
      
      // Enhanced context from intelligence
      business_model: orgContext.business_model,
      sales_complexity: orgContext.sales_complexity,
      tech_sophistication: orgContext.tech_sophistication,
      
      // Workflow intelligence insights
      manual_processes: workflowIntel.manual_process_mentions || [],
      automation_gaps: workflowIntel.automation_gaps || [],
      coordination_challenges: workflowIntel.coordination_challenges || [],
      integration_needs: workflowIntel.integration_needs || [],
      
      // Current technology stack
      current_tools: {
        crm_system: techStack.crm_system,
        scheduling: techStack.scheduling_tools || [],
        documents: techStack.document_tools || [],
        automation: techStack.automation_tools || [],
        communication: techStack.communication_tools || [],
        project_management: techStack.project_management || []
      },
      
      // Process maturity indicators
      process_maturity: {
        sophistication: processMaturity.process_sophistication || 'medium',
        automation_level: processMaturity.automation_level || 'medium',
        documentation_quality: processMaturity.documentation_quality || 'medium',
        change_management: processMaturity.change_management_capability || 'medium'
      },
      
      // Financial context
      avg_deal_size: orgContext.avg_deal_size,
      budget_range: orgContext.budget_range,
      revenue_stage: orgContext.revenue_stage,
      
      // Raw intelligence for advanced analysis
      raw_intelligence: companyIntelligence
    };
  }

  /**
   * Build comprehensive analysis report
   */
  buildAnalysisReport(data) {
    const {
      analysisId,
      websiteUrl,
      companyIntelligence,
      workflows,
      patterns,
      recommendations,
      organizationContext
    } = data;

    return {
      analysis_metadata: {
        analysis_id: analysisId,
        timestamp: new Date().toISOString(),
        website_analyzed: websiteUrl,
        company_name: companyIntelligence.company_name,
        analysis_type: 'intelligent_crm_workflow_analysis'
      },
      
      company_intelligence_summary: {
        company_name: companyIntelligence.company_name,
        industry: organizationContext.industry,
        business_model: organizationContext.business_model,
        tech_sophistication: organizationContext.tech_sophistication,
        current_crm: organizationContext.current_tools?.crm_system,
        key_challenges: [
          ...organizationContext.automation_gaps,
          ...organizationContext.coordination_challenges
        ].slice(0, 5),
        integration_opportunities: organizationContext.integration_needs?.slice(0, 5) || []
      },
      
      workflow_analysis: {
        total_workflows_analyzed: workflows.length,
        patterns_discovered: patterns?.length || 0,
        pattern_summary: patterns?.map(p => ({
          name: p.pattern_name,
          type: p.pattern_type,
          workflow_count: p.workflow_count,
          confidence: p.confidence,
          primary_issues: p.issues_identified?.slice(0, 3) || []
        })) || [],
        
        key_insights: this.extractKeyInsights(patterns, organizationContext),
        
        performance_metrics: {
          avg_cycle_time: workflows.reduce((sum, w) => sum + (w.duration_days || 0), 0) / workflows.length,
          success_rate: this.calculateSuccessRate(workflows),
          data_completeness: this.calculateDataCompleteness(workflows),
          engagement_score: this.calculateEngagementScore(workflows)
        }
      },
      
      contextual_recommendations: {
        total_recommendations: recommendations?.length || 0,
        high_priority: recommendations?.filter(r => r.priority === 'high') || [],
        quick_wins: recommendations?.filter(r => r.implementation_effort === 'low') || [],
        strategic_initiatives: recommendations?.filter(r => r.implementation_effort === 'high') || [],
        
        roi_projections: this.calculateROIProjections(recommendations, organizationContext),
        implementation_roadmap: this.buildImplementationRoadmap(recommendations)
      },
      
      raw_data: {
        company_intelligence: companyIntelligence,
        workflows: workflows,
        patterns: patterns,
        recommendations: recommendations,
        organization_context: organizationContext
      }
    };
  }

  /**
   * Extract key insights from patterns and context
   */
  extractKeyInsights(patterns, context) {
    const insights = [];
    
    if (!patterns || patterns.length === 0) {
      insights.push({
        type: 'data_quality',
        insight: 'Limited workflow patterns detected - may indicate data quality issues or need for more CRM adoption',
        severity: 'medium'
      });
    }

    // Industry-specific insights
    if (context.industry) {
      insights.push({
        type: 'industry_context',
        insight: `As a ${context.industry} company, focus on ${this.getIndustryFocusAreas(context.industry)}`,
        severity: 'info'
      });
    }

    // Tech sophistication insights
    if (context.tech_sophistication === 'high' && context.automation_gaps?.length > 0) {
      insights.push({
        type: 'automation_opportunity',
        insight: 'High tech sophistication but automation gaps detected - prime candidate for advanced workflow automation',
        severity: 'high'
      });
    }

    return insights;
  }

  /**
   * Get industry-specific focus areas
   */
  getIndustryFocusAreas(industry) {
    const focusMap = {
      'Technology': 'product-led growth, developer relations, and technical sales processes',
      'Healthcare': 'compliance workflows, patient data security, and regulatory documentation',
      'Financial Services': 'compliance automation, risk management, and client onboarding',
      'Manufacturing': 'supply chain coordination, quality processes, and customer support',
      'Retail': 'customer experience, inventory management, and omnichannel coordination'
    };
    
    return focusMap[industry] || 'customer experience and operational efficiency';
  }

  /**
   * Calculate success rate from workflows
   */
  calculateSuccessRate(workflows) {
    const successful = workflows.filter(w => 
      w.status === 'completed' || 
      w.status === 'won' || 
      (w.stages && w.stages.some(stage => stage.is_closed_won))
    );
    return workflows.length > 0 ? successful.length / workflows.length : 0;
  }

  /**
   * Calculate data completeness score
   */
  calculateDataCompleteness(workflows) {
    if (!workflows || workflows.length === 0) return 0;
    
    const scores = workflows.map(w => {
      let score = 0;
      let maxScore = 5;
      
      if (w.deal_value !== undefined && w.deal_value !== null) score++;
      if (w.activities && w.activities.length > 0) score++;
      if (w.participants && w.participants.length > 0) score++;
      if (w.stages && w.stages.length > 0) score++;
      if (w.status) score++;
      
      return score / maxScore;
    });
    
    return scores.reduce((sum, score) => sum + score, 0) / scores.length;
  }

  /**
   * Calculate engagement score
   */
  calculateEngagementScore(workflows) {
    if (!workflows || workflows.length === 0) return 0;
    
    const scores = workflows.map(w => {
      const duration = w.duration_days || 1;
      const activities = w.activities?.length || 0;
      const participants = w.participants?.length || 0;
      
      const activityDensity = activities / duration;
      const participantEngagement = participants > 0 ? activities / participants : 0;
      
      return Math.min((activityDensity * 10 + participantEngagement) / 2, 1);
    });
    
    return scores.reduce((sum, score) => sum + score, 0) / scores.length;
  }

  /**
   * Calculate ROI projections for recommendations
   */
  calculateROIProjections(recommendations, context) {
    if (!recommendations || recommendations.length === 0) return {};
    
    return {
      total_investment_estimate: recommendations.reduce((sum, r) => sum + (r.estimated_cost || 0), 0),
      projected_annual_savings: recommendations.reduce((sum, r) => sum + (r.projected_savings || 0), 0),
      payback_period_months: 12, // Simplified calculation
      confidence_level: 'medium'
    };
  }

  /**
   * Build implementation roadmap
   */
  buildImplementationRoadmap(recommendations) {
    if (!recommendations || recommendations.length === 0) return [];
    
    const phases = {
      'Phase 1 (0-30 days)': recommendations.filter(r => r.implementation_effort === 'low'),
      'Phase 2 (1-3 months)': recommendations.filter(r => r.implementation_effort === 'medium'),
      'Phase 3 (3-6 months)': recommendations.filter(r => r.implementation_effort === 'high')
    };
    
    return Object.entries(phases).map(([phase, recs]) => ({
      phase,
      recommendations: recs.map(r => r.tool_name || r.recommendation),
      estimated_duration: phase.includes('30 days') ? '1 month' : 
                         phase.includes('1-3') ? '2-3 months' : '3-6 months'
    }));
  }

  /**
   * Save analysis results to files
   */
  async saveAnalysisResults(analysisId, report) {
    try {
      // Ensure output directory exists
      await fs.mkdir(this.options.outputDir, { recursive: true });
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const baseFilename = `intelligent-analysis-${analysisId}-${timestamp}`;
      
      // Save complete report
      const reportPath = path.join(this.options.outputDir, `${baseFilename}.json`);
      await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
      
      // Save executive summary
      const summaryPath = path.join(this.options.outputDir, `${baseFilename}-summary.json`);
      const summary = {
        analysis_metadata: report.analysis_metadata,
        company_intelligence_summary: report.company_intelligence_summary,
        key_metrics: report.workflow_analysis.performance_metrics,
        top_recommendations: report.raw_data?.recommendations?.slice(0, 5) || [],
        implementation_roadmap: report.contextual_recommendations.implementation_roadmap
      };
      await fs.writeFile(summaryPath, JSON.stringify(summary, null, 2));
      
      this.logger.info('Analysis results saved', {
        report_path: reportPath,
        summary_path: summaryPath
      });
      
      return { reportPath, summaryPath };
      
    } catch (error) {
      this.logger.error('Failed to save analysis results', {
        error: error.message
      });
      throw error;
    }
  }
}

module.exports = IntelligentCRMAnalyzer;

