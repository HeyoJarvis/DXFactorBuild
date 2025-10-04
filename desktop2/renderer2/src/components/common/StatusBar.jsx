import './StatusBar.css';

export default function StatusBar({ systemStatus }) {
  const getStatusDotClass = (connected) => {
    return connected ? 'status-dot online' : 'status-dot offline';
  };

  const getActivitySummary = () => {
    if (!systemStatus) return 'Connecting...';
    
    const connectedServices = [];
    if (systemStatus.slack?.connected) connectedServices.push('Slack');
    if (systemStatus.crm?.connected) connectedServices.push('CRM');
    if (systemStatus.ai?.connected) connectedServices.push('AI');

    if (connectedServices.length === 0) return 'No services connected';
    if (connectedServices.length === 3) return 'All systems ready';
    return `${connectedServices.join(', ')} ready`;
  };

  return (
    <div className="status-bar">
      <div className="status-indicators">
        <div className="status-item">
          <div className={getStatusDotClass(systemStatus?.slack?.connected)} />
          <span>Slack</span>
        </div>
        <div className="status-item">
          <div className={getStatusDotClass(systemStatus?.crm?.connected)} />
          <span>CRM</span>
        </div>
        <div className="status-item">
          <div className={getStatusDotClass(systemStatus?.ai?.connected)} />
          <span>AI</span>
        </div>
      </div>
      <div className="activity-summary">{getActivitySummary()}</div>
    </div>
  );
}

