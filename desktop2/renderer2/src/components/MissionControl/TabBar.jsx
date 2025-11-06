import './TabBar.css';

/**
 * TabBar - Navigation tabs for switching carousel content
 * 
 * Tabs:
 * - Jira Progress
 * - Calendar
 * - Unibox
 * - Reports
 * - Widgets
 */
export default function TabBar({ activeTab, onTabChange }) {
  const tabs = [
    { id: 'jira-progress', label: 'Jira Progress' },
    { id: 'calendar', label: 'Calendar' },
    { id: 'unibox', label: 'Unibox' },
    { id: 'reports', label: 'Reports' },
    { id: 'widgets', label: 'Widgets' }
  ];

  return (
    <div className="tab-bar">
      <div className="tab-bar-container">
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`tab-button ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => onTabChange(tab.id)}
          >
            <span className="tab-label">{tab.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

