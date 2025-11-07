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
    { 
      id: 'jira-progress', 
      label: 'Jira Progress',
      icon: (
        <img src="/JIRALOGO.png" alt="Jira" style={{ width: '20px', height: '20px', objectFit: 'contain' }} />
      )
    },
    { 
      id: 'calendar', 
      label: 'Calendar',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
          <line x1="16" y1="2" x2="16" y2="6"></line>
          <line x1="8" y1="2" x2="8" y2="6"></line>
          <line x1="3" y1="10" x2="21" y2="10"></line>
        </svg>
      )
    },
    { 
      id: 'unibox', 
      label: 'Inbox',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
          <polyline points="22,6 12,13 2,6"></polyline>
        </svg>
      )
    },
    { 
      id: 'reports', 
      label: 'Reports',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="23 6 13.5 15.5 8.5 10.5 1 17"></polyline>
          <polyline points="17 6 23 6 23 12"></polyline>
        </svg>
      )
    },
    { 
      id: 'widgets', 
      label: 'Widgets',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="3" width="7" height="7"></rect>
          <rect x="14" y="3" width="7" height="7"></rect>
          <rect x="14" y="14" width="7" height="7"></rect>
          <rect x="3" y="14" width="7" height="7"></rect>
        </svg>
      )
    }
  ];

  return (
    <div className="tab-bar">
      <div className="tab-bar-container">
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`tab-button ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => onTabChange(tab.id)}
            title={tab.label}
          >
            <span className="tab-icon">{tab.icon}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

