import { useState, useEffect } from 'react';
import './IntegrationSetup.css';
import DraggableHeader from '../common/DraggableHeader';

export default function IntegrationSetup({ onComplete }) {
  const [integrations, setIntegrations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedIntegrations, setSelectedIntegrations] = useState(new Set());

  useEffect(() => {
    loadIntegrations();
  }, []);

  async function loadIntegrations() {
    try {
      console.log('📦 Loading recommended integrations...');
      const result = await window.electronAPI.onboarding.getRecommendedIntegrations();
      
      if (result.success) {
        console.log('✅ Loaded integrations:', result.integrations);
        setIntegrations(result.integrations);
        // Pre-select required integrations
        const required = result.integrations
          .filter(int => int.required || int.connected)
          .map(int => int.key);
        setSelectedIntegrations(new Set(required));
      } else {
        throw new Error(result.error || 'Failed to load integrations');
      }
    } catch (error) {
      console.error('❌ Failed to load integrations:', error);
      alert(`Failed to load integrations: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }

  function toggleIntegration(integrationKey) {
    setSelectedIntegrations(prev => {
      const newSet = new Set(prev);
      if (newSet.has(integrationKey)) {
        newSet.delete(integrationKey);
      } else {
        newSet.add(integrationKey);
      }
      return newSet;
    });
  }

  async function handleSkip() {
    try {
      console.log('⏭️ Skipping integration setup...');
      const result = await window.electronAPI.onboarding.skipIntegrations();
      
      if (result.success) {
        console.log('✅ Onboarding skipped, completing...');
        if (onComplete) {
          onComplete();
        }
      } else {
        throw new Error(result.error || 'Failed to skip');
      }
    } catch (error) {
      console.error('❌ Failed to skip:', error);
      alert(`Failed to skip: ${error.message}`);
    }
  }

  async function handleComplete() {
    try {
      console.log('✅ Completing onboarding...');
      const result = await window.electronAPI.onboarding.complete();
      
      if (result.success) {
        console.log('🎉 Onboarding completed!');
        if (onComplete) {
          onComplete();
        }
      } else {
        throw new Error(result.error || 'Failed to complete');
      }
    } catch (error) {
      console.error('❌ Failed to complete onboarding:', error);
      alert(`Failed to complete: ${error.message}`);
    }
  }

  if (loading) {
    return (
      <div className="integration-setup-page">
        <div className="integration-loading">
          <div className="spinner"></div>
          <p>Loading integrations...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="integration-setup-page">
      <DraggableHeader title="Choose Your Integrations" />
      <div className="integration-setup-container">
        <div className="integration-header">
          <p className="integration-subtitle">
            Select the tools you'd like to use with HeyJarvis.
            <br />
            You'll connect them later in Settings.
          </p>
        </div>

        <div className="integrations-grid">
          {integrations.map(integration => {
            const isSelected = selectedIntegrations.has(integration.key);
            const isRequired = integration.required || integration.connected;
            
            return (
              <div
                key={integration.key}
                className={`integration-card ${isSelected ? 'selected' : ''} ${isRequired ? 'required' : ''}`}
                onClick={() => !isRequired && toggleIntegration(integration.key)}
                style={{ cursor: isRequired ? 'not-allowed' : 'pointer' }}
              >
                <div className="integration-icon-large">
                  {integration.icon === 'slack' && '💬'}
                  {integration.icon === 'microsoft' && '🔷'}
                  {integration.icon === 'google' && '🌐'}
                  {integration.icon === 'jira' && '📋'}
                  {integration.icon === 'github' && '🐙'}
                  {integration.icon === 'hubspot' && '🎯'}
                </div>
                
                <h3 className="integration-name">{integration.name}</h3>
                <p className="integration-description">{integration.description}</p>
                
                {isRequired && (
                  <div className="integration-badge required-badge">Required</div>
                )}
                
                {isSelected && (
                  <div className="selected-check">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                      <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="integration-actions">
          <button 
            className="continue-button" 
            onClick={handleComplete}
            disabled={selectedIntegrations.size === 0}
          >
            Continue with {selectedIntegrations.size} {selectedIntegrations.size === 1 ? 'tool' : 'tools'}
          </button>
          <button className="skip-button" onClick={handleSkip}>
            Skip for now
          </button>
        </div>

        <div className="integration-note">
          💡 Connect and manage integrations anytime in Settings
        </div>
      </div>
    </div>
  );
}

