import './QuickActions.css';

export default function QuickActions({ onActionClick }) {
  const actions = [
    {
      icon: '📊',
      label: 'Latest competitor moves',
      message: 'What are the latest competitor moves?'
    },
    {
      icon: '🧠',
      label: 'CRM insights',
      message: 'Analyze my CRM data'
    },
    {
      icon: '💬',
      label: 'Slack activity',
      message: 'Show Slack activity'
    },
    {
      icon: '🔍',
      label: 'Fact Check Screen',
      message: 'Start fact check mode'
    }
  ];

  return (
    <div className="quick-actions">
      {actions.map((action, index) => (
        <button
          key={index}
          className="quick-action"
          onClick={() => onActionClick(action.message)}
        >
          <div className="quick-action-icon">{action.icon}</div>
          <div className="quick-action-label">{action.label}</div>
        </button>
      ))}
    </div>
  );
}

