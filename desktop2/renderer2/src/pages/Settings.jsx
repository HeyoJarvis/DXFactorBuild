import React, { useState } from 'react';
import './Settings.css';

function Settings({ user }) {
  const [integrations, setIntegrations] = useState({
    slack: { enabled: true, connected: true, name: 'Slack', description: 'Team communication and task management' },
    teams: { enabled: false, connected: false, name: 'Microsoft Teams', description: 'Meetings and collaboration' },
    google: { enabled: true, connected: true, name: 'Google Workspace', description: 'Gmail, Calendar, and Drive' },
    github: { enabled: true, connected: true, name: 'GitHub', description: 'Code repositories and pull requests' },
    jira: { enabled: false, connected: false, name: 'Jira', description: 'Project tracking and issue management' }
  });

  const handleToggle = (integrationKey) => {
    setIntegrations(prev => ({
      ...prev,
      [integrationKey]: {
        ...prev[integrationKey],
        enabled: !prev[integrationKey].enabled
      }
    }));
  };

  const getIntegrationIcon = (key) => {
    switch(key) {
      case 'slack':
        return (
          <svg viewBox="0 0 24 24" fill="none">
            <path d="M6 15a2 2 0 0 1-2 2a2 2 0 0 1-2-2a2 2 0 0 1 2-2h2v2zm1 0a2 2 0 0 1 2-2a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2a2 2 0 0 1-2-2v-5z" fill="#E01E5A"/>
            <path d="M9 6a2 2 0 0 1-2-2a2 2 0 0 1 2-2a2 2 0 0 1 2 2v2H9zm0 1a2 2 0 0 1 2 2a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2a2 2 0 0 1 2-2h5z" fill="#36C5F0"/>
            <path d="M18 9a2 2 0 0 1 2-2a2 2 0 0 1 2 2a2 2 0 0 1-2 2h-2V9zm-1 0a2 2 0 0 1-2 2a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2a2 2 0 0 1 2 2v5z" fill="#2EB67D"/>
            <path d="M15 18a2 2 0 0 1 2 2a2 2 0 0 1-2 2a2 2 0 0 1-2-2v-2h2zm0-1a2 2 0 0 1-2-2a2 2 0 0 1 2-2h5a2 2 0 0 1 2 2a2 2 0 0 1-2 2h-5z" fill="#ECB22E"/>
          </svg>
        );
      case 'teams':
        return (
          <svg viewBox="0 0 24 24" fill="none">
            <rect x="2" y="2" width="20" height="20" rx="2" fill="#5059C9"/>
            <path d="M16 8h-2a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2z" fill="white"/>
            <circle cx="9" cy="9" r="3" fill="white"/>
            <path d="M9 13a4 4 0 0 0-4 4v2h8v-2a4 4 0 0 0-4-4z" fill="white"/>
          </svg>
        );
      case 'google':
        return (
          <svg viewBox="0 0 24 24" fill="none">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
        );
      case 'github':
        return (
          <svg viewBox="0 0 24 24" fill="none">
            <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.17 6.839 9.49.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.603-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.463-1.11-1.463-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.167 22 16.418 22 12c0-5.523-4.477-10-10-10z" fill="#1D1D1F"/>
          </svg>
        );
      case 'jira':
        return (
          <svg viewBox="0 0 24 24" fill="none">
            <path d="M12 0L4.9 7.1l3.05 3.05L12 14.2l4.05-4.05L19.1 7.1 12 0z" fill="#2684FF"/>
            <path d="M12 14.2L7.95 10.15 4.9 13.2l3.05 3.05L12 20.3l4.05-4.05L19.1 13.2 16.05 10.15 12 14.2z" fill="url(#jira-gradient)"/>
            <defs>
              <linearGradient id="jira-gradient" x1="50%" y1="0%" x2="50%" y2="100%">
                <stop offset="0%" stopColor="#2684FF"/>
                <stop offset="100%" stopColor="#0052CC"/>
              </linearGradient>
            </defs>
          </svg>
        );
      default:
        return null;
    }
  };

  return (
    <div className="settings-page">
      {/* Header */}
      <div className="settings-header">
        <div className="settings-header-content">
          <div className="settings-title-section">
            <h1 className="settings-title">Settings</h1>
            <p className="settings-subtitle">Manage your integrations and preferences</p>
          </div>
          <button className="minimize-btn" onClick={() => window.electronAPI?.window?.minimize?.()}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="settings-content">
        {/* Integrations Section */}
        <div className="settings-section">
          <div className="section-header">
            <div className="section-header-left">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3"></circle>
                <path d="M12 1v6m0 6v6M5.64 5.64l4.24 4.24m4.24 4.24l4.24 4.24M1 12h6m6 0h6M5.64 18.36l4.24-4.24m4.24-4.24l4.24-4.24"></path>
              </svg>
              <h2 className="section-title">Integrations</h2>
            </div>
            <span className="section-count">{Object.values(integrations).filter(i => i.enabled).length} active</span>
          </div>

          <div className="integrations-grid">
            {Object.entries(integrations).map(([key, integration]) => (
              <div key={key} className={`integration-card ${integration.enabled ? 'active' : ''}`}>
                <div className="integration-icon">
                  {getIntegrationIcon(key)}
                  {integration.connected && (
                    <div className={`connection-indicator ${integration.enabled ? 'connected' : 'paused'}`}></div>
                  )}
                </div>

                <div className="integration-info">
                  <h3 className="integration-name">{integration.name}</h3>
                  <p className="integration-description">{integration.description}</p>
                  {integration.connected && (
                    <span className="connection-status">
                      {integration.enabled ? 'Connected & Active' : 'Connected (Paused)'}
                    </span>
                  )}
                </div>

                <div className="integration-actions">
                  <label className="toggle-switch">
                    <input
                      type="checkbox"
                      checked={integration.enabled}
                      onChange={() => handleToggle(key)}
                      disabled={!integration.connected}
                    />
                    <span className="toggle-slider"></span>
                  </label>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Profile Section */}
        <div className="settings-section">
          <div className="section-header">
            <div className="section-header-left">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                <circle cx="12" cy="7" r="4"></circle>
              </svg>
              <h2 className="section-title">Profile</h2>
            </div>
          </div>

          <div className="profile-card">
            <div className="profile-avatar">
              {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
            </div>
            <div className="profile-info">
              <h3 className="profile-name">{user?.name || 'User'}</h3>
              <p className="profile-email">{user?.email || 'user@company.com'}</p>
              <span className="profile-role">Sales</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Settings;

