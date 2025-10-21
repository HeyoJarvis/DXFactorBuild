import { useState } from 'react';
import './RoleSelection.css';
import DraggableHeader from '../common/DraggableHeader';

export default function RoleSelection({ onComplete, onSkip }) {
  const [selectedRole, setSelectedRole] = useState(null);
  const [loading, setLoading] = useState(false);

  const roles = [
    {
      id: 'sales',
      name: 'Sales & Business',
      description: 'Perfect for sales teams, business development, and customer success',
      features: [
        'CRM integrations (HubSpot, Salesforce)',
        'Email and calendar management',
        'Task management from Slack',
        'Sales pipeline tracking',
        'Meeting scheduling'
      ],
      icon: '📊'
    },
    {
      id: 'developer',
      name: 'Engineering & Dev',
      description: 'Optimized for developers, engineers, and technical teams',
      features: [
        'JIRA integration',
        'GitHub pull requests',
        'Code indexing and search',
        'Architecture diagrams',
        'Sprint planning'
      ],
      icon: '⚡'
    }
  ];

  const handleSelectRole = async (roleId) => {
    try {
      setLoading(true);
      console.log('🎯 Setting user role:', roleId);

      const result = await window.electronAPI.onboarding.setRole(roleId);

      if (result.success) {
        console.log('✅ Role set successfully');
        if (onComplete) {
          onComplete(roleId);
        }
      } else {
        throw new Error(result.error || 'Failed to set role');
      }
    } catch (error) {
      console.error('❌ Failed to set role:', error);
      alert(`Failed to set role: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="role-selection-page">
      <DraggableHeader title="Welcome to HeyJarvis" />
      <div className="role-selection-container">
        <div className="role-header">
          <h1>Choose Your Role</h1>
          <p className="role-subtitle">
            Select what best describes you to customize your experience
          </p>
        </div>

        <div className="role-cards">
          {roles.map(role => (
            <div
              key={role.id}
              className={`role-card ${selectedRole === role.id ? 'selected' : ''}`}
              onClick={() => setSelectedRole(role.id)}
            >
              {selectedRole === role.id && (
                <div className="selected-badge">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                </div>
              )}
              
              <div className="role-icon">{role.icon}</div>
              <h2 className="role-name">{role.name}</h2>
              <p className="role-description">{role.description}</p>
              
              <ul className="role-features">
                {role.features.map((feature, index) => (
                  <li key={index}>{feature}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="role-actions">
          <button
            className="continue-button"
            onClick={() => handleSelectRole(selectedRole)}
            disabled={!selectedRole || loading}
          >
            {loading ? 'Setting up...' : selectedRole ? `Continue as ${roles.find(r => r.id === selectedRole)?.name}` : 'Select a role to continue'}
          </button>
        </div>
      </div>
    </div>
  );
}

