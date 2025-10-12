/**
 * Deployment Analyzer
 * 
 * Analyzes deployment patterns and calculates DORA metrics:
 * - Deployment frequency
 * - Lead time for changes
 * - Mean time to recover (MTTR)
 * - Change failure rate
 * 
 * Features:
 * 1. Link PRs → commits → deployments
 * 2. Calculate DORA metrics
 * 3. Detect risky deployments
 * 4. Generate deployment health scores
 * 5. Track deployment trends over time
 */

const winston = require('winston');
const EventEmitter = require('events');

class DeploymentAnalyzer extends EventEmitter {
  constructor(githubActionsService, options = {}) {
    super();
    
    this.githubActionsService = githubActionsService;
    
    this.options = {
      logLevel: options.logLevel || 'info',
      timeWindow: options.timeWindow || 30, // days
      ...options
    };

    // Initialize logger
    this.logger = winston.createLogger({
      level: this.options.logLevel,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.Console(),
        new winston.transports.File({ 
          filename: 'logs/deployment-analyzer.log',
          maxsize: 5242880, // 5MB
          maxFiles: 5
        })
      ],
      defaultMeta: { service: 'deployment-analyzer' }
    });

    this.logger.info('Deployment Analyzer initialized', {
      timeWindow: this.options.timeWindow
    });
  }

  /**
   * Calculate DORA metrics
   */
  async calculateDORAMetrics(options = {}) {
    try {
      const {
        environment = 'production',
        days = this.options.timeWindow
      } = options;

      this.logger.info('Calculating DORA metrics', {
        environment,
        days
      });

      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      // Fetch deployments and workflow runs
      const [deployments, workflowRuns] = await Promise.all([
        this.githubActionsService.getRecentDeploymentsWithStatus({
          environment,
          limit: 100
        }),
        this.githubActionsService.getWorkflowRuns({
          status: 'completed',
          per_page: 100
        })
      ]);

      // Filter to time window
      const recentDeployments = deployments.filter(d => 
        new Date(d.created_at) >= startDate
      );

      const recentWorkflows = workflowRuns.workflow_runs.filter(w => 
        new Date(w.created_at) >= startDate
      );

      // Calculate metrics
      const deploymentFrequency = this._calculateDeploymentFrequency(recentDeployments, days);
      const leadTime = await this._calculateLeadTime(recentDeployments, recentWorkflows);
      const mttr = await this._calculateMTTR(recentDeployments);
      const changeFailureRate = this._calculateChangeFailureRate(recentDeployments);

      const metrics = {
        period_days: days,
        environment,
        calculated_at: new Date().toISOString(),
        
        deployment_frequency: deploymentFrequency,
        lead_time_for_changes: leadTime,
        mean_time_to_recover: mttr,
        change_failure_rate: changeFailureRate,
        
        // Performance rating based on DORA research
        overall_rating: this._calculateOverallRating({
          deploymentFrequency,
          leadTime,
          mttr,
          changeFailureRate
        }),
        
        total_deployments: recentDeployments.length,
        successful_deployments: recentDeployments.filter(d => 
          d.current_status === 'success'
        ).length,
        failed_deployments: recentDeployments.filter(d => 
          d.current_status === 'failure' || d.current_status === 'error'
        ).length
      };

      this.logger.info('DORA metrics calculated', {
        environment,
        overall_rating: metrics.overall_rating,
        deploymentFrequency: metrics.deployment_frequency
      });

      this.emit('metrics_calculated', metrics);

      return metrics;

    } catch (error) {
      this.logger.error('Failed to calculate DORA metrics', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Calculate deployment frequency
   */
  _calculateDeploymentFrequency(deployments, days) {
    const frequency = deployments.length / days;
    
    let rating;
    if (frequency >= 1) {
      rating = 'elite'; // Multiple deployments per day
    } else if (frequency >= 0.14) {
      rating = 'high'; // Once per week
    } else if (frequency >= 0.03) {
      rating = 'medium'; // Once per month
    } else {
      rating = 'low'; // Less than once per month
    }

    return {
      deploys_per_day: frequency,
      deploys_per_week: frequency * 7,
      deploys_per_month: frequency * 30,
      rating
    };
  }

  /**
   * Calculate lead time for changes (commit to production)
   */
  async _calculateLeadTime(deployments, workflowRuns) {
    try {
      const leadTimes = [];

      for (const deployment of deployments.slice(0, 20)) { // Sample recent deployments
        try {
          // Find workflow run for this deployment
          const workflowRun = workflowRuns.find(w => w.head_commit?.sha === deployment.sha);
          
          if (workflowRun && workflowRun.head_commit) {
            // Calculate time from commit to deployment
            const commitTime = new Date(workflowRun.created_at);
            const deployTime = new Date(deployment.created_at);
            const leadTimeMs = deployTime - commitTime;
            
            if (leadTimeMs >= 0) {
              leadTimes.push(leadTimeMs);
            }
          }
        } catch (error) {
          this.logger.debug('Failed to calculate lead time for deployment', {
            deploymentId: deployment.id,
            error: error.message
          });
        }
      }

      if (leadTimes.length === 0) {
        return {
          average_hours: null,
          median_hours: null,
          rating: 'unknown'
        };
      }

      const avgMs = leadTimes.reduce((sum, t) => sum + t, 0) / leadTimes.length;
      const avgHours = avgMs / (1000 * 60 * 60);
      
      // Calculate median
      const sortedTimes = leadTimes.sort((a, b) => a - b);
      const medianMs = sortedTimes[Math.floor(sortedTimes.length / 2)];
      const medianHours = medianMs / (1000 * 60 * 60);

      let rating;
      if (avgHours < 1) {
        rating = 'elite'; // Less than one hour
      } else if (avgHours < 24) {
        rating = 'high'; // Less than one day
      } else if (avgHours < 168) {
        rating = 'medium'; // Less than one week
      } else {
        rating = 'low'; // More than one week
      }

      return {
        average_hours: avgHours,
        median_hours: medianHours,
        sample_size: leadTimes.length,
        rating
      };

    } catch (error) {
      this.logger.error('Failed to calculate lead time', {
        error: error.message
      });
      
      return {
        average_hours: null,
        median_hours: null,
        rating: 'unknown'
      };
    }
  }

  /**
   * Calculate mean time to recover (MTTR)
   */
  async _calculateMTTR(deployments) {
    try {
      const recoveryTimes = [];

      // Find failed deployments and subsequent successful ones
      for (let i = 0; i < deployments.length - 1; i++) {
        const deployment = deployments[i];
        
        if (deployment.current_status === 'failure' || deployment.current_status === 'error') {
          // Find next successful deployment
          for (let j = i + 1; j < deployments.length; j++) {
            const nextDeployment = deployments[j];
            
            if (nextDeployment.current_status === 'success') {
              const failTime = new Date(deployment.created_at);
              const recoveryTime = new Date(nextDeployment.created_at);
              const mttrMs = recoveryTime - failTime;
              
              if (mttrMs >= 0) {
                recoveryTimes.push(mttrMs);
              }
              break;
            }
          }
        }
      }

      if (recoveryTimes.length === 0) {
        return {
          average_hours: null,
          incidents_recovered: 0,
          rating: 'unknown'
        };
      }

      const avgMs = recoveryTimes.reduce((sum, t) => sum + t, 0) / recoveryTimes.length;
      const avgHours = avgMs / (1000 * 60 * 60);

      let rating;
      if (avgHours < 1) {
        rating = 'elite'; // Less than one hour
      } else if (avgHours < 24) {
        rating = 'high'; // Less than one day
      } else if (avgHours < 168) {
        rating = 'medium'; // Less than one week
      } else {
        rating = 'low'; // More than one week
      }

      return {
        average_hours: avgHours,
        incidents_recovered: recoveryTimes.length,
        rating
      };

    } catch (error) {
      this.logger.error('Failed to calculate MTTR', {
        error: error.message
      });
      
      return {
        average_hours: null,
        incidents_recovered: 0,
        rating: 'unknown'
      };
    }
  }

  /**
   * Calculate change failure rate
   */
  _calculateChangeFailureRate(deployments) {
    const totalDeployments = deployments.length;
    
    if (totalDeployments === 0) {
      return {
        percentage: null,
        failed_count: 0,
        total_count: 0,
        rating: 'unknown'
      };
    }

    const failedDeployments = deployments.filter(d => 
      d.current_status === 'failure' || d.current_status === 'error'
    ).length;

    const percentage = (failedDeployments / totalDeployments) * 100;

    let rating;
    if (percentage <= 15) {
      rating = 'elite'; // 0-15% failure rate
    } else if (percentage <= 30) {
      rating = 'high'; // 16-30% failure rate
    } else if (percentage <= 45) {
      rating = 'medium'; // 31-45% failure rate
    } else {
      rating = 'low'; // > 45% failure rate
    }

    return {
      percentage,
      failed_count: failedDeployments,
      total_count: totalDeployments,
      rating
    };
  }

  /**
   * Calculate overall DORA rating
   */
  _calculateOverallRating(metrics) {
    const ratings = {
      elite: 4,
      high: 3,
      medium: 2,
      low: 1,
      unknown: 0
    };

    const scores = [
      ratings[metrics.deploymentFrequency.rating] || 0,
      ratings[metrics.leadTime.rating] || 0,
      ratings[metrics.mttr.rating] || 0,
      ratings[metrics.changeFailureRate.rating] || 0
    ];

    const avgScore = scores.reduce((sum, s) => sum + s, 0) / scores.length;

    if (avgScore >= 3.5) return 'elite';
    if (avgScore >= 2.5) return 'high';
    if (avgScore >= 1.5) return 'medium';
    if (avgScore >= 0.5) return 'low';
    return 'unknown';
  }

  /**
   * Detect risky deployments
   */
  async detectRiskyDeployments(options = {}) {
    try {
      const { limit = 10 } = options;

      this.logger.info('Detecting risky deployments');

      const workflowRuns = await this.githubActionsService.getWorkflowRuns({
        per_page: limit
      });

      const riskyDeployments = [];

      for (const run of workflowRuns.workflow_runs) {
        const riskFactors = [];
        let riskScore = 0;

        // Check for failed tests
        if (run.conclusion === 'failure') {
          riskFactors.push('Workflow failed');
          riskScore += 50;
        }

        // Check for long duration (> 30 minutes)
        if (run.duration_ms && run.duration_ms > 30 * 60 * 1000) {
          riskFactors.push('Long build time');
          riskScore += 10;
        }

        // Check for multiple attempts
        if (run.run_attempt > 1) {
          riskFactors.push(`${run.run_attempt} attempts`);
          riskScore += 20;
        }

        // Get PRs linked to this run
        try {
          const prs = await this.githubActionsService.getPRsForWorkflowRun(run.id);
          
          // Check for large number of PRs
          if (prs.length > 5) {
            riskFactors.push(`${prs.length} PRs included`);
            riskScore += 15;
          }

          // Check for PRs without reviews (would need PR details API call)
          // This is a placeholder for future enhancement
        } catch (error) {
          this.logger.debug('Failed to get PRs for workflow run', {
            runId: run.id
          });
        }

        if (riskScore > 20) {
          riskyDeployments.push({
            workflow_run: run,
            risk_score: riskScore,
            risk_level: riskScore > 50 ? 'high' : 'medium',
            risk_factors: riskFactors
          });
        }
      }

      this.logger.info('Risky deployments detected', {
        count: riskyDeployments.length
      });

      return riskyDeployments;

    } catch (error) {
      this.logger.error('Failed to detect risky deployments', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Generate deployment health score
   */
  async generateDeploymentHealth(options = {}) {
    try {
      this.logger.info('Generating deployment health score');

      const doraMetrics = await this.calculateDORAMetrics(options);
      const riskyDeployments = await this.detectRiskyDeployments({ limit: 20 });

      const healthScore = this._calculateHealthScore(doraMetrics, riskyDeployments);

      const health = {
        overall_score: healthScore,
        grade: this._getHealthGrade(healthScore),
        dora_metrics: doraMetrics,
        risky_deployments_count: riskyDeployments.length,
        recommendations: this._generateRecommendations(doraMetrics, riskyDeployments)
      };

      this.logger.info('Deployment health generated', {
        score: healthScore,
        grade: health.grade
      });

      return health;

    } catch (error) {
      this.logger.error('Failed to generate deployment health', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Calculate health score (0-100)
   */
  _calculateHealthScore(doraMetrics, riskyDeployments) {
    const ratingScores = {
      elite: 100,
      high: 75,
      medium: 50,
      low: 25,
      unknown: 50
    };

    // DORA metrics contribute 80% of score
    const doraScore = (
      ratingScores[doraMetrics.deployment_frequency.rating] * 0.25 +
      ratingScores[doraMetrics.lead_time_for_changes.rating] * 0.25 +
      ratingScores[doraMetrics.mean_time_to_recover.rating] * 0.15 +
      ratingScores[doraMetrics.change_failure_rate.rating] * 0.35
    );

    // Risky deployments reduce score by up to 20%
    const riskPenalty = Math.min(riskyDeployments.length * 5, 20);

    return Math.round(Math.max(0, doraScore - riskPenalty));
  }

  /**
   * Get health grade (A-F)
   */
  _getHealthGrade(score) {
    if (score >= 90) return 'A';
    if (score >= 80) return 'B';
    if (score >= 70) return 'C';
    if (score >= 60) return 'D';
    return 'F';
  }

  /**
   * Generate recommendations
   */
  _generateRecommendations(doraMetrics, riskyDeployments) {
    const recommendations = [];

    // Deployment frequency recommendations
    if (doraMetrics.deployment_frequency.rating === 'low' || 
        doraMetrics.deployment_frequency.rating === 'medium') {
      recommendations.push({
        category: 'deployment_frequency',
        priority: 'high',
        title: 'Increase deployment frequency',
        description: 'Consider implementing continuous deployment practices to ship smaller, more frequent changes.'
      });
    }

    // Lead time recommendations
    if (doraMetrics.lead_time_for_changes.rating === 'low' || 
        doraMetrics.lead_time_for_changes.rating === 'medium') {
      recommendations.push({
        category: 'lead_time',
        priority: 'high',
        title: 'Reduce lead time for changes',
        description: 'Optimize your CI/CD pipeline and reduce wait times between commit and deployment.'
      });
    }

    // MTTR recommendations
    if (doraMetrics.mean_time_to_recover.rating === 'low' || 
        doraMetrics.mean_time_to_recover.rating === 'medium') {
      recommendations.push({
        category: 'mttr',
        priority: 'critical',
        title: 'Improve incident recovery time',
        description: 'Implement better monitoring, alerting, and automated rollback capabilities.'
      });
    }

    // Change failure rate recommendations
    if (doraMetrics.change_failure_rate.percentage > 15) {
      recommendations.push({
        category: 'change_failure_rate',
        priority: 'critical',
        title: 'Reduce deployment failures',
        description: 'Improve testing coverage, code review practices, and deployment procedures.'
      });
    }

    // Risky deployments recommendations
    if (riskyDeployments.length > 3) {
      recommendations.push({
        category: 'risk',
        priority: 'high',
        title: 'Address risky deployment patterns',
        description: 'Review and address the factors contributing to high-risk deployments.'
      });
    }

    return recommendations;
  }
}

module.exports = DeploymentAnalyzer;

