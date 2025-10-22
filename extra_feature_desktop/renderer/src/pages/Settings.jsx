import React, { useState, useEffect } from 'react';
import './Settings.css';

function Settings({ user }) {
  const [integrations, setIntegrations] = useState({
    microsoft: { connected: false, name: 'Microsoft Outlook', icon: '📧', lastSync: null },
    jira: { connected: false, name: 'JIRA', icon: '🎯', lastSync: null },
    github: { connected: false, name: 'GitHub', icon: '💻', lastSync: null }
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null); // { type: 'success' | 'error', text: string }

  useEffect(() => {
    checkIntegrationStatus();
  }, []);

  const checkIntegrationStatus = async () => {
    try {
      setLoading(true);
      const result = await window.electronAPI.auth.checkStatus();
      if (result && result.success && result.connections) {
        setIntegrations(prev => ({
          ...prev,
          microsoft: { ...prev.microsoft, connected: result.connections.microsoft || false },
          jira: { ...prev.jira, connected: result.connections.jira || false },
          github: { ...prev.github, connected: result.connections.github || false }
        }));
      }
    } catch (error) {
      console.error('Failed to check integration status:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async (service) => {
    try {
      setLoading(true);
      setMessage(null);
      let result;
      
      switch (service) {
        case 'microsoft':
          result = await window.electronAPI.auth.connectMicrosoft();
          break;
        case 'jira':
          result = await window.electronAPI.auth.connectJIRA();
          break;
        case 'github':
          result = await window.electronAPI.auth.connectGitHub();
          break;
        default:
          return;
      }

      if (result.success) {
        setMessage({
          type: 'success',
          text: `Successfully connected to ${integrations[service].name}!`
        });
        await checkIntegrationStatus();
      } else {
        setMessage({
          type: 'error',
          text: result.error || `Failed to connect to ${integrations[service].name}`
        });
      }
    } catch (error) {
      console.error(`Failed to connect ${service}:`, error);
      setMessage({
        type: 'error',
        text: `Error connecting to ${integrations[service].name}: ${error.message}`
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async (service) => {
    try {
      setLoading(true);
      setMessage(null);
      const result = await window.electronAPI.auth.disconnect(service);
      if (result.success) {
        setMessage({
          type: 'success',
          text: `Disconnected from ${integrations[service].name}`
        });
        await checkIntegrationStatus();
      } else {
        setMessage({
          type: 'error',
          text: result.error || `Failed to disconnect from ${integrations[service].name}`
        });
      }
    } catch (error) {
      console.error(`Failed to disconnect ${service}:`, error);
      setMessage({
        type: 'error',
        text: `Error disconnecting from ${integrations[service].name}: ${error.message}`
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Settings</h1>
          <p className="page-subtitle">Manage your integrations and preferences</p>
        </div>
      </div>

      {/* Message Display */}
      {message && (
        <div className={`message-banner message-${message.type}`}>
          <span className="message-text">{message.text}</span>
          <button className="message-close" onClick={() => setMessage(null)}>×</button>
        </div>
      )}

      {/* User Profile */}
      <div className="card settings-section">
        <h2 className="card-title">Profile</h2>
        <div className="profile-info">
          <div className="profile-avatar">
            {user.name[0].toUpperCase()}
          </div>
          <div className="profile-details">
            <h3 className="profile-name">{user.name}</h3>
            <p className="profile-email">{user.email}</p>
          </div>
        </div>
      </div>

      {/* Integrations */}
      <div className="card settings-section">
        <h2 className="card-title">Integrations</h2>
        <p className="settings-description">
          Connect your tools to enable Team Sync Intelligence features
        </p>

        <div className="integrations-list">
          {Object.entries(integrations).map(([key, integration]) => (
            <div key={key} className="integration-card">
              <div className="integration-info">
                <div className="integration-icon">{integration.icon}</div>
                <div className="integration-details">
                  <h3 className="integration-name">{integration.name}</h3>
                  <p className="integration-status">
                    {integration.connected ? (
                      <span className="status-connected">✓ Connected</span>
                    ) : (
                      <span className="status-disconnected">✗ Not connected</span>
                    )}
                  </p>
                </div>
              </div>
              
              <div className="integration-actions">
                {integration.connected ? (
                  <button
                    className="btn btn-ghost"
                    onClick={() => handleDisconnect(key)}
                    disabled={loading}
                  >
                    Disconnect
                  </button>
                ) : (
                  <button
                    className="btn btn-primary"
                    onClick={() => handleConnect(key)}
                    disabled={loading}
                  >
                    Connect
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Meeting Detection Settings */}
      <div className="card settings-section">
        <h2 className="card-title">Meeting Detection</h2>
        <p className="settings-description">
          Configure how meetings are automatically identified as important
        </p>

        <div className="settings-group">
          <div className="setting-item">
            <div className="setting-info">
              <h4 className="setting-name">Smart Detection</h4>
              <p className="setting-description">
                Automatically suggest important meetings based on keywords and attendees
              </p>
            </div>
            <label className="toggle-switch">
              <input type="checkbox" defaultChecked />
              <span className="toggle-slider"></span>
            </label>
          </div>

          <div className="setting-item">
            <div className="setting-info">
              <h4 className="setting-name">Minimum Importance Score</h4>
              <p className="setting-description">
                Only show meetings with this importance score or higher
              </p>
            </div>
            <input
              type="number"
              className="setting-input"
              defaultValue={70}
              min={0}
              max={100}
            />
          </div>
        </div>
      </div>

      {/* Sync Settings */}
      <div className="card settings-section">
        <h2 className="card-title">Sync Settings</h2>
        <p className="settings-description">
          Control how often data is synced from your integrations
        </p>

        <div className="settings-group">
          <div className="setting-item">
            <div className="setting-info">
              <h4 className="setting-name">Auto Sync</h4>
              <p className="setting-description">
                Automatically sync data every 30 minutes
              </p>
            </div>
            <label className="toggle-switch">
              <input type="checkbox" defaultChecked />
              <span className="toggle-slider"></span>
            </label>
          </div>

          <div className="setting-item">
            <div className="setting-info">
              <h4 className="setting-name">Sync History (days)</h4>
              <p className="setting-description">
                How many days of history to sync from integrations
              </p>
            </div>
            <select className="setting-select">
              <option value={7}>7 days</option>
              <option value={14}>14 days</option>
              <option value={30} selected>30 days</option>
              <option value={60}>60 days</option>
            </select>
          </div>
        </div>
      </div>

      {/* About */}
      <div className="card settings-section">
        <h2 className="card-title">About</h2>
        <div className="about-info">
          <p className="about-version">Team Sync Intelligence v1.0.0</p>
          <p className="about-description">
            AI-powered team synchronization with meeting summaries and intelligent Q&A
          </p>
        </div>
      </div>
    </div>
  );
}

export default Settings;

