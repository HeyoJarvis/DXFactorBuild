/**
 * Sprint Analyzer
 * 
 * Analyzes sprint data and calculates velocity metrics:
 * - Compare planned vs actual story points
 * - Identify bottlenecks (issues stuck in specific states)
 * - Predict sprint completion
 * - Generate natural language sprint reports
 * 
 * Features:
 * 1. Historical velocity tracking
 * 2. Bottleneck identification
 * 3. Predictive analytics
 * 4. AI-generated sprint summaries
 * 5. Team performance insights
 */

const winston = require('winston');
const EventEmitter = require('events');

class SprintAnalyzer extends EventEmitter {
  constructor(jiraService, jiraAdapter, modelRouter, options = {}) {
    super();
    
    this.jiraService = jiraService;
    this.jiraAdapter = jiraAdapter;
    this.modelRouter = modelRouter;
    
    this.options = {
      logLevel: options.logLevel || 'info',
      historicalSprintsToAnalyze: options.historicalSprintsToAnalyze || 5,
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
          filename: 'logs/sprint-analyzer.log',
          maxsize: 5242880, // 5MB
          maxFiles: 5
        })
      ],
      defaultMeta: { service: 'sprint-analyzer' }
    });

    this.logger.info('Sprint Analyzer initialized');
  }

  /**
   * Calculate velocity for a sprint
   */
  async calculateVelocity(sprintId) {
    try {
      this.logger.info('Calculating sprint velocity', { sprintId });

      // Get sprint issues
      const issues = await this.jiraService.getSprintIssues(sprintId);
      
      // Get sprint details (from first issue's sprint data)
      const sprint = issues[0]?.sprint;
      
      if (!sprint) {
        throw new Error('Sprint not found in issues');
      }

      // Calculate velocity metrics using adapter
      const velocity = this.jiraAdapter.calculateSprintVelocity(issues, sprint);

      this.logger.info('Sprint velocity calculated', {
        sprintId,
        completionRate: velocity.completion_rate,
        velocityRate: velocity.velocity_rate
      });

      this.emit('velocity_calculated', {
        sprint_id: sprintId,
        velocity
      });

      return velocity;

    } catch (error) {
      this.logger.error('Failed to calculate sprint velocity', {
        sprintId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Identify bottlenecks in a sprint
   */
  async identifyBottlenecks(sprintId) {
    try {
      this.logger.info('Identifying sprint bottlenecks', { sprintId });

      // Get sprint issues
      const issues = await this.jiraService.getSprintIssues(sprintId);
      
      const sprint = issues[0]?.sprint;
      
      if (!sprint) {
        throw new Error('Sprint not found in issues');
      }

      // Identify bottlenecks using adapter
      const bottlenecks = this.jiraAdapter.identifyBottlenecks(issues, sprint);

      this.logger.info('Bottlenecks identified', {
        sprintId,
        count: bottlenecks.length
      });

      this.emit('bottlenecks_identified', {
        sprint_id: sprintId,
        bottlenecks
      });

      return bottlenecks;

    } catch (error) {
      this.logger.error('Failed to identify bottlenecks', {
        sprintId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Predict sprint completion
   */
  async predictSprintCompletion(sprintId) {
    try {
      this.logger.info('Predicting sprint completion', { sprintId });

      // Get current sprint velocity
      const currentVelocity = await this.calculateVelocity(sprintId);
      
      // Get historical velocity (last N sprints)
      const historicalVelocity = await this._getHistoricalVelocity(sprintId);

      // Calculate prediction
      const prediction = this._calculatePrediction(
        currentVelocity,
        historicalVelocity
      );

      this.logger.info('Sprint completion predicted', {
        sprintId,
        likelihood: prediction.completion_likelihood,
        remainingPoints: prediction.remaining_story_points
      });

      return prediction;

    } catch (error) {
      this.logger.error('Failed to predict sprint completion', {
        sprintId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get historical velocity data
   */
  async _getHistoricalVelocity(currentSprintId) {
    try {
      this.logger.debug('Fetching historical velocity');

      // This is a simplified implementation
      // In production, you'd query past sprints from the same board
      
      const historicalData = {
        average_velocity_rate: 0.75, // 75% completion rate
        average_story_points_completed: 25,
        sprints_analyzed: this.options.historicalSprintsToAnalyze,
        trend: 'stable' // stable, improving, declining
      };

      return historicalData;

    } catch (error) {
      this.logger.error('Failed to get historical velocity', {
        error: error.message
      });
      
      // Return defaults if historical data unavailable
      return {
        average_velocity_rate: 0.70,
        average_story_points_completed: 20,
        sprints_analyzed: 0,
        trend: 'unknown'
      };
    }
  }

  /**
   * Calculate sprint completion prediction
   */
  _calculatePrediction(currentVelocity, historicalVelocity) {
    const remainingStoryPoints = currentVelocity.total_story_points - 
                                  currentVelocity.completed_story_points;
    
    const currentCompletionRate = currentVelocity.velocity_rate;
    const historicalCompletionRate = historicalVelocity.average_velocity_rate;

    // Weighted prediction (70% historical, 30% current)
    const predictedCompletionRate = (historicalCompletionRate * 0.7) + 
                                     (currentCompletionRate * 0.3);

    // Calculate likelihood of completing remaining points
    const daysRemaining = this._estimateDaysRemaining();
    const pointsPerDay = historicalVelocity.average_story_points_completed / 14; // Assume 2-week sprints
    const canCompletePoints = pointsPerDay * daysRemaining;

    const completionLikelihood = Math.min(
      (canCompletePoints / remainingStoryPoints) * 100,
      100
    );

    return {
      remaining_story_points: remainingStoryPoints,
      completed_story_points: currentVelocity.completed_story_points,
      total_story_points: currentVelocity.total_story_points,
      current_completion_rate: currentCompletionRate,
      predicted_completion_rate: predictedCompletionRate,
      completion_likelihood: Math.round(completionLikelihood),
      estimated_days_remaining: daysRemaining,
      risk_level: completionLikelihood < 50 ? 'high' : 
                  completionLikelihood < 75 ? 'medium' : 'low',
      recommendations: this._generatePredictionRecommendations(
        completionLikelihood,
        remainingStoryPoints,
        currentVelocity
      )
    };
  }

  /**
   * Estimate days remaining in sprint
   */
  _estimateDaysRemaining() {
    // Simplified implementation
    // In production, calculate based on sprint end date
    return 7; // Assume 7 days remaining
  }

  /**
   * Generate recommendations based on prediction
   */
  _generatePredictionRecommendations(likelihood, remainingPoints, velocity) {
    const recommendations = [];

    if (likelihood < 50) {
      recommendations.push({
        priority: 'high',
        title: 'Sprint at risk',
        description: `Only ${likelihood}% likely to complete. Consider descoping ${remainingPoints - Math.floor(remainingPoints * 0.5)} story points.`
      });
    }

    if (velocity.blocked_issues > 0) {
      recommendations.push({
        priority: 'critical',
        title: 'Unblock issues immediately',
        description: `${velocity.blocked_issues} blocked issue(s) are preventing progress.`
      });
    }

    if (likelihood > 90 && remainingPoints > 0) {
      recommendations.push({
        priority: 'low',
        title: 'Ahead of schedule',
        description: 'Consider pulling in additional work from the backlog.'
      });
    }

    return recommendations;
  }

  /**
   * Generate sprint report (AI-powered)
   */
  async generateSprintReport(sprintId) {
    try {
      this.logger.info('Generating sprint report', { sprintId });

      // Gather sprint data
      const [velocity, bottlenecks, prediction] = await Promise.all([
        this.calculateVelocity(sprintId),
        this.identifyBottlenecks(sprintId),
        this.predictSprintCompletion(sprintId)
      ]);

      // Build context for AI
      const context = {
        velocity,
        bottlenecks,
        prediction
      };

      // Generate AI summary
      const prompt = this._buildReportPrompt(context);
      
      const aiResponse = await this.modelRouter.route(
        'sprint_summary',
        prompt,
        {
          taskContext: 'Generate a concise sprint status summary for a standup meeting.',
          dataContext: context
        }
      );

      const report = {
        sprint_id: sprintId,
        sprint_name: velocity.sprint_name,
        generated_at: new Date().toISOString(),
        summary: aiResponse.content,
        metrics: {
          velocity,
          bottlenecks,
          prediction
        },
        quick_stats: {
          completion_rate: Math.round(velocity.velocity_rate * 100) + '%',
          blocked_issues: velocity.blocked_issues,
          days_remaining: prediction.estimated_days_remaining,
          risk_level: prediction.risk_level
        }
      };

      this.logger.info('Sprint report generated', {
        sprintId,
        riskLevel: report.quick_stats.risk_level
      });

      this.emit('report_generated', {
        sprint_id: sprintId,
        report
      });

      return report;

    } catch (error) {
      this.logger.error('Failed to generate sprint report', {
        sprintId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Build prompt for AI report generation
   */
  _buildReportPrompt(context) {
    return `Generate a concise sprint status summary based on the following data:

**Velocity Metrics:**
- Total Issues: ${context.velocity.total_issues}
- Completed: ${context.velocity.completed_issues}
- In Progress: ${context.velocity.in_progress_issues}
- To Do: ${context.velocity.todo_issues}
- Blocked: ${context.velocity.blocked_issues}
- Story Points: ${context.velocity.completed_story_points}/${context.velocity.total_story_points}
- Completion Rate: ${Math.round(context.velocity.velocity_rate * 100)}%

**Bottlenecks:**
${context.bottlenecks.map(b => `- ${b.description} (${b.severity} severity)`).join('\n')}

**Prediction:**
- Completion Likelihood: ${context.prediction.completion_likelihood}%
- Risk Level: ${context.prediction.risk_level}
- Days Remaining: ${context.prediction.estimated_days_remaining}

Generate a 3-4 sentence summary suitable for a standup meeting. Include:
1. Overall sprint health
2. Key blockers or risks
3. Whether the team is on track
4. One actionable recommendation`;
  }

  /**
   * Compare multiple sprints
   */
  async compareSprintVelocity(sprintIds) {
    try {
      this.logger.info('Comparing sprint velocities', {
        sprintCount: sprintIds.length
      });

      const velocities = await Promise.all(
        sprintIds.map(id => this.calculateVelocity(id))
      );

      const comparison = {
        sprints: velocities,
        trends: {
          velocity_trend: this._calculateTrend(
            velocities.map(v => v.velocity_rate)
          ),
          completion_trend: this._calculateTrend(
            velocities.map(v => v.completion_rate)
          ),
          average_velocity_rate: velocities.reduce((sum, v) => 
            sum + v.velocity_rate, 0
          ) / velocities.length,
          average_story_points: velocities.reduce((sum, v) => 
            sum + v.completed_story_points, 0
          ) / velocities.length
        }
      };

      this.logger.info('Sprint comparison completed', {
        sprintCount: sprintIds.length,
        velocityTrend: comparison.trends.velocity_trend
      });

      return comparison;

    } catch (error) {
      this.logger.error('Failed to compare sprint velocities', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Calculate trend (improving, stable, declining)
   */
  _calculateTrend(values) {
    if (values.length < 2) return 'unknown';

    const firstHalf = values.slice(0, Math.floor(values.length / 2));
    const secondHalf = values.slice(Math.floor(values.length / 2));

    const firstAvg = firstHalf.reduce((sum, v) => sum + v, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((sum, v) => sum + v, 0) / secondHalf.length;

    const change = ((secondAvg - firstAvg) / firstAvg) * 100;

    if (change > 10) return 'improving';
    if (change < -10) return 'declining';
    return 'stable';
  }
}

module.exports = SprintAnalyzer;

