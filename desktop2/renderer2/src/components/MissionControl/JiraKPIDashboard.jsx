import React from 'react';
import { useJiraKPIs } from '../../hooks/useJiraKPIs';
import './JiraKPIDashboard.css';

/**
 * JIRA KPI Dashboard Component
 * 
 * Displays key performance indicators for JIRA tasks:
 * - Completion %
 * - Sprint Completion %
 * - Overdue Count
 * - Blocked Count
 * - High-Priority Open
 * - Health Score (0-100 with color bands)
 */
export default function JiraKPIDashboard({ user }) {
  console.log('🎯 JiraKPIDashboard rendering with user:', user);
  const { kpis, loading, error, refresh } = useJiraKPIs(user?.id);
  console.log('📊 KPI Dashboard - KPIs:', kpis, 'Loading:', loading, 'Error:', error);

  if (loading) {
    return (
      <div className="jira-kpi-dashboard loading">
        <div className="kpi-header">
          <h3>📊 JIRA Performance Metrics</h3>
        </div>
        <div className="loading-spinner-container">
          <div className="loading-spinner"></div>
          <p>Loading metrics...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="jira-kpi-dashboard error">
        <div className="kpi-header">
          <h3>📊 JIRA Performance Metrics</h3>
        </div>
        <div className="error-message">
          <p>⚠️ Failed to load KPIs: {error}</p>
          <button className="retry-btn" onClick={refresh}>Retry</button>
        </div>
      </div>
    );
  }

  // Determine health score color band
  const getHealthColor = (score) => {
    if (score >= 80) return 'excellent';
    if (score >= 60) return 'good';
    if (score >= 40) return 'fair';
    return 'poor';
  };

  const getHealthLabel = (score) => {
    if (score >= 80) return 'Excellent';
    if (score >= 60) return 'Good';
    if (score >= 40) return 'Fair';
    return 'Needs Attention';
  };

  const healthColor = getHealthColor(kpis.healthScore);
  const healthLabel = getHealthLabel(kpis.healthScore);

  // Determine if metrics need attention
  const hasOverdue = kpis.overdueCount > 0;
  const hasBlocked = kpis.blockedCount > 0;
  const hasHighPriority = kpis.highPriorityOpen > 0;

  return (
    <div className="jira-kpi-dashboard">
      <div className="kpi-header">
        <div className="header-left">
          <h3>📊 JIRA Performance Metrics</h3>
          <span className="task-summary">
            {kpis.totalTasks} tasks • {kpis.completedTasks} done • {kpis.inProgressTasks} in progress
          </span>
        </div>
        <button className="refresh-btn" onClick={refresh} title="Refresh metrics">
          🔄
        </button>
      </div>

      <div className="kpi-grid">
        {/* Completion % */}
        <div className="kpi-card completion">
          <div className="kpi-icon">✅</div>
          <div className="kpi-content">
            <span className="kpi-value">{kpis.completionRate}%</span>
            <span className="kpi-label">Completion</span>
            <div className="kpi-progress">
              <div 
                className="kpi-progress-bar" 
                style={{ width: `${kpis.completionRate}%` }}
              ></div>
            </div>
          </div>
        </div>

        {/* Sprint Completion % */}
        <div className="kpi-card sprint">
          <div className="kpi-icon">🎯</div>
          <div className="kpi-content">
            <span className="kpi-value">{kpis.sprintCompletion}%</span>
            <span className="kpi-label">Sprint Points</span>
            <div className="kpi-progress">
              <div 
                className="kpi-progress-bar sprint-bar" 
                style={{ width: `${kpis.sprintCompletion}%` }}
              ></div>
            </div>
          </div>
        </div>

        {/* Overdue */}
        <div className={`kpi-card overdue ${hasOverdue ? 'alert' : ''}`}>
          <div className="kpi-icon">{hasOverdue ? '⚠️' : '📅'}</div>
          <div className="kpi-content">
            <span className="kpi-value">{kpis.overdueCount}</span>
            <span className="kpi-label">Overdue</span>
            {hasOverdue && <span className="kpi-status">Needs attention</span>}
          </div>
        </div>

        {/* Blocked */}
        <div className={`kpi-card blocked ${hasBlocked ? 'alert' : ''}`}>
          <div className="kpi-icon">{hasBlocked ? '🚫' : '🔓'}</div>
          <div className="kpi-content">
            <span className="kpi-value">{kpis.blockedCount}</span>
            <span className="kpi-label">Blocked</span>
            {hasBlocked && <span className="kpi-status">Action required</span>}
          </div>
        </div>

        {/* High-Priority Open */}
        <div className={`kpi-card priority ${hasHighPriority ? 'alert' : ''}`}>
          <div className="kpi-icon">{hasHighPriority ? '🔥' : '⭐'}</div>
          <div className="kpi-content">
            <span className="kpi-value">{kpis.highPriorityOpen}</span>
            <span className="kpi-label">High Priority</span>
            {hasHighPriority && <span className="kpi-status">Focus needed</span>}
          </div>
        </div>

        {/* Health Score */}
        <div className={`kpi-card health-score ${healthColor}`}>
          <div className="kpi-icon">💚</div>
          <div className="kpi-content">
            <span className="kpi-value">{kpis.healthScore}</span>
            <span className="kpi-label">Health Score</span>
            <span className="kpi-status">{healthLabel}</span>
            <div className="health-bar-container">
              <div 
                className={`health-bar ${healthColor}`}
                style={{ width: `${kpis.healthScore}%` }}
              ></div>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}

