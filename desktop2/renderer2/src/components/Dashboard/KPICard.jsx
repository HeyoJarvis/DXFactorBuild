import './KPICard.css';

/**
 * KPICard - Displays a single KPI metric with value, label, and trend
 * 
 * @param {string|number} value - Main metric value
 * @param {string} label - Description of the metric
 * @param {Object} trend - Trend object with direction ('up'|'down'|'stable') and value
 * @param {string} source - Source identifier ('jira'|'slack'|'email'|'github'|'tasks')
 */
export default function KPICard({ value, label, trend, source }) {
  const getTrendClass = () => {
    if (!trend) return '';
    if (trend.direction === 'up') return 'positive';
    if (trend.direction === 'down') return 'negative';
    return 'neutral';
  };

  const getTrendIcon = () => {
    if (!trend) return '';
    if (trend.direction === 'up') return '↑';
    if (trend.direction === 'down') return '↓';
    return '→';
  };

  const getSourceInfo = () => {
    const sourceMap = {
      jira: { logo: '/JIRALOGO.png', label: 'JIRA', color: '#0052CC' },
      slack: { logo: '/Slack_icon_2019.svg.png', label: 'Slack', color: '#4A154B' },
      email: { logo: '/outlook-icon.png', label: 'Email', color: '#0078D4' },
      github: { logo: '/github-icon.png', label: 'GitHub', color: '#24292e' },
      tasks: { logo: '/tasks-icon.png', label: 'Tasks', color: '#10b981' }
    };
    return sourceMap[source] || { logo: null, label: 'System', color: '#6b7280' };
  };

  const handleCardClick = () => {
    console.log('View details for:', label, 'from', source);
    // TODO: Navigate to detailed view or open modal
  };

  const sourceInfo = getSourceInfo();

  return (
    <div 
      className="kpi-card"
      onClick={handleCardClick}
    >
      {/* Source Logo Badge */}
      {sourceInfo.logo && (
        <div 
          className="kpi-source-logo" 
          title={`Data from ${sourceInfo.label}`}
        >
          <img 
            src={sourceInfo.logo} 
            alt={sourceInfo.label}
            onError={(e) => {
              // Fallback to colored circle with initial if image fails
              e.target.style.display = 'none';
              e.target.parentElement.innerHTML = `<span style="color: ${sourceInfo.color}">${sourceInfo.label[0]}</span>`;
            }}
          />
        </div>
      )}

      {/* Value */}
      <div className="kpi-value">
        {value}
      </div>

      {/* Label with Trend */}
      <div className="kpi-label">
        {label}
        {trend && (
          <div className={`kpi-trend ${getTrendClass()}`}>
            {getTrendIcon()} {trend.value}
          </div>
        )}
      </div>
    </div>
  );
}

