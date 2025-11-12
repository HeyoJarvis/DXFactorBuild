import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import DraggableHeader from '../components/common/DraggableHeader';
import './Settings.css';

function Settings({ user }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [integrations, setIntegrations] = useState({
    jira: { 
      enabled: false, 
      connected: false, 
      name: 'JIRA', 
      description: 'Project tracking and issue management',
      hasAuth: true
    }
  });

  useEffect(() => {
    checkIntegrationStatuses();
  }, []);

  async function checkIntegrationStatuses() {
    setLoading(true);
    try {
      const statuses = {};

      // Check JIRA only
      if (window.electronAPI?.jira?.checkConnection) {
        const jiraStatus = await window.electronAPI.jira.checkConnection();
        console.log('JIRA status:', jiraStatus);
        statuses.jira = {
          connected: jiraStatus.success && jiraStatus.connected || false,
          enabled: jiraStatus.success && jiraStatus.connected || false
        };
      }

      console.log('JIRA integration status:', statuses);

      // Update JIRA status
      setIntegrations(prev => ({
        ...prev,
        jira: {
          ...prev.jira,
          ...statuses.jira
        }
      }));

    } catch (error) {
      console.error('Error checking JIRA status:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleConnect(integrationKey) {
    try {
      console.log(`🔗 Connecting to JIRA...`);
      
      // Set loading for JIRA
      setIntegrations(prev => ({
        ...prev,
        jira: {
          ...prev.jira,
          loading: true
        }
      }));

      // JIRA OAuth
      if (window.electronAPI?.jira?.authenticate) {
        const result = await window.electronAPI.jira.authenticate();
        console.log('JIRA auth result:', result);
        if (result.success) {
          console.log('✅ JIRA authenticated successfully');
          // Immediately update the state
          setIntegrations(prev => ({
            ...prev,
            jira: {
              ...prev.jira,
              connected: true,
              enabled: true,
              loading: false
            }
          }));
          return; // Exit early
        } else {
          // If auth failed, show error
          alert(`Failed to connect to JIRA: ${result.error || 'Unknown error'}`);
        }
      }

      // Clear loading state
      setIntegrations(prev => ({
        ...prev,
        jira: {
          ...prev.jira,
          loading: false
        }
      }));

      // Refresh statuses after a delay
      setTimeout(() => checkIntegrationStatuses(), 3000);

    } catch (error) {
      console.error(`Error connecting to JIRA:`, error);
      setIntegrations(prev => ({
        ...prev,
        jira: {
          ...prev.jira,
          loading: false
        }
      }));
      alert(`Failed to connect to JIRA: ${error.message}`);
    }
  }

  async function handleDisconnect(integrationKey) {
    try {
      console.log(`🔌 Disconnecting from JIRA...`);

      // Set loading state
      setIntegrations(prev => ({
        ...prev,
        jira: {
          ...prev.jira,
          loading: true
        }
      }));

      // Disconnect JIRA
      if (window.electronAPI?.jira?.disconnect) {
        const result = await window.electronAPI.jira.disconnect();
        console.log('✅ JIRA disconnected', result);
        
        // Show success/error message
        if (result && !result.success) {
          alert(`Failed to disconnect from JIRA: ${result.error || 'Unknown error'}`);
        }
      }

      // Clear loading state
      setIntegrations(prev => ({
        ...prev,
        jira: {
          ...prev.jira,
          loading: false
        }
      }));

      // Refresh statuses
      setTimeout(() => checkIntegrationStatuses(), 1000);

    } catch (error) {
      console.error(`Error disconnecting from JIRA:`, error);
      
      // Clear loading state on error
      setIntegrations(prev => ({
        ...prev,
        jira: {
          ...prev.jira,
          loading: false
        }
      }));
      
      alert(`Failed to disconnect from JIRA: ${error.message}`);
    }
  }

  const handleToggle = (integrationKey) => {
    const integration = integrations[integrationKey];
    
    if (!integration.connected) {
      // Can't toggle if not connected
      return;
    }

    setIntegrations(prev => ({
      ...prev,
      [integrationKey]: {
        ...prev[integrationKey],
        enabled: !prev[integrationKey].enabled
      }
    }));
  };

  const getIntegrationIcon = (key) => {
    // Only JIRA icon
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
  };

  return (
    <div className="settings-page">
      {/* Draggable Window Controls */}
      <DraggableHeader title="Settings" />
      
      {/* Header */}
      <div className="settings-header">
        <div className="settings-header-content">
          <button 
            className="settings-back-btn" 
            onClick={() => navigate('/mission-control-v2')} 
            title="Back to Mission Control"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="12" x2="5" y2="12"></line>
              <polyline points="12 19 5 12 12 5"></polyline>
            </svg>
            <span>Back</span>
          </button>
          <div className="settings-title-section">
            <h1 className="settings-title">Settings</h1>
            <p className="settings-subtitle">Manage your integrations and preferences</p>
          </div>
          <button className="settings-refresh-btn" onClick={checkIntegrationStatuses} disabled={loading} title="Refresh">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={loading ? 'spinning' : ''}>
              <polyline points="23 4 23 10 17 10"></polyline>
              <polyline points="1 20 1 14 7 14"></polyline>
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
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

          {loading ? (
            <div className="loading-state">
              <div className="loading-spinner"></div>
              <p>Checking integrations...</p>
            </div>
          ) : (
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
                    {integration.connected ? (
                      <span className="connection-status connected">
                      {integration.enabled ? 'Connected & Active' : 'Connected (Paused)'}
                    </span>
                    ) : (
                      <span className="connection-status disconnected">
                        Not Connected
                      </span>
                  )}
                </div>

                <div className="integration-actions">
                    {integration.connected ? (
                      <>
                  <label className="toggle-switch">
                    <input
                      type="checkbox"
                      checked={integration.enabled}
                      onChange={() => handleToggle(key)}
                    />
                    <span className="toggle-slider"></span>
                  </label>
                        {integration.hasAuth && (
                          <button 
                            className="integration-disconnect-btn" 
                            onClick={() => handleDisconnect(key)}
                            title="Disconnect"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <line x1="18" y1="6" x2="6" y2="18"></line>
                              <line x1="6" y1="6" x2="18" y2="18"></line>
                            </svg>
                          </button>
                        )}
                      </>
                    ) : (
                      <button 
                        className="integration-connect-btn" 
                        onClick={() => handleConnect(key)}
                        disabled={!integration.hasAuth}
                      >
                        Connect
                      </button>
                    )}
                  </div>
              </div>
            ))}
          </div>
          )}
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
              {user?.name ? user.name.charAt(0).toUpperCase() : user?.email?.charAt(0).toUpperCase() || 'U'}
            </div>
            <div className="profile-info">
              <h3 className="profile-name">{user?.name || user?.email?.split('@')[0] || 'User'}</h3>
              <p className="profile-email">{user?.email || 'user@company.com'}</p>
              <span className="profile-role">{user?.user_role || 'Sales'}</span>
            </div>
          </div>
          
          <div className="profile-actions">
            <button 
              className="logout-button"
              onClick={async () => {
                if (window.confirm('Are you sure you want to logout?')) {
                  try {
                    console.log('🚪 Logging out...');
                    await window.electronAPI.auth.signOut();
                    console.log('✅ Logged out successfully');
                    window.location.reload();
                  } catch (error) {
                    console.error('❌ Logout failed:', error);
                    alert('Failed to logout: ' + error.message);
                  }
                }
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                <polyline points="16 17 21 12 16 7"></polyline>
                <line x1="21" y1="12" x2="9" y2="12"></line>
              </svg>
              Logout
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Settings;
