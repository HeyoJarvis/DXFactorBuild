import './KPICard.css';

/**
 * KPICard - Displays a single KPI metric with value, label, and trend
 * 
 * @param {string|number} value - Main metric value
 * @param {string} label - Description of the metric
 * @param {Object} trend - Trend object with direction ('up'|'down'|'stable') and value
 * @param {string} source - Source URL or description for the metric
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

  const handleValueClick = (e) => {
    e.stopPropagation();
    if (source) {
      console.log('Navigating to source:', source);
      // TODO: Navigate to source or open modal with details
    }
  };

  return (
    <div className="kpi-card">
      <div 
        className="kpi-value" 
        onClick={handleValueClick}
        title={source ? 'See source' : ''}
      >
        {value}
      </div>
      <div className="kpi-label">{label}</div>
      {trend && (
        <div className={`kpi-trend ${getTrendClass()}`}>
          {getTrendIcon()} {trend.value}
        </div>
      )}
    </div>
  );
}

