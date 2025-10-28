import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './ModeToggle.css';

/**
 * ModeToggle - Switch between Personal and Team modes
 * Personal: Individual work (Tasks page)
 * Team: Team collaboration (Team Chat) with hierarchical navigation
 */
export default function ModeToggle({ user, mode, onModeChange, selectedTeam, selectedUnit, onTeamChange, onBackToTeamSelection, onBackToUnitSelection, teams, loading, panelVisibility, onTogglePanel }) {
  const navigate = useNavigate();

  const handleToggleMode = () => {
    const newMode = mode === 'personal' ? 'team' : 'personal';
    onModeChange(newMode);
  };

  const handleBackToTeamSelection = () => {
    if (onBackToTeamSelection) {
      onBackToTeamSelection();
    }
  };

  const handleBackToUnitSelection = () => {
    if (onBackToUnitSelection) {
      onBackToUnitSelection();
    }
  };

  const handleSettingsClick = () => {
    navigate('/settings');
  };

  const handleToggleLeftPanel = () => {
    onTogglePanel('left');
  };

  const handleToggleMiddlePanel = () => {
    onTogglePanel('middle');
  };

  const handleToggleRightPanel = () => {
    onTogglePanel('right');
  };

  // Keyboard shortcut: Cmd+T / Ctrl+T
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 't') {
        e.preventDefault();
        handleToggleMode();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mode]);

  return (
    <div className="mode-toggle-container">
      <div className="mode-toggle-left">
        <div className="mode-user-info">
          <div className="mode-user-avatar">
            {user?.name?.[0]?.toUpperCase() || 'U'}
          </div>
          <span className="mode-user-name">{user?.name || 'User'}</span>
        </div>

        {mode === 'personal' ? (
          <>
            <div className={`mode-badge mode-badge-personal`}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                <polyline points="9 22 9 12 15 12 15 22"></polyline>
              </svg>
              Personal
            </div>
            <button className="mode-switch-button" onClick={handleToggleMode}>
              Switch to Team
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" y1="12" x2="19" y2="12"></line>
                <polyline points="12 5 19 12 12 19"></polyline>
              </svg>
            </button>
          </>
        ) : (
          <>
            <button className="mode-back-button" onClick={handleToggleMode}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="19" y1="12" x2="5" y2="12"></line>
                <polyline points="12 19 5 12 12 5"></polyline>
              </svg>
              Back to Personal
            </button>
            
            {/* Hierarchical breadcrumb navigation */}
            {selectedUnit ? (
              // Show full breadcrumb: Team > Unit
              <div className="team-breadcrumb">
                <button className="breadcrumb-item clickable" onClick={handleBackToTeamSelection}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                    <circle cx="9" cy="7" r="4"></circle>
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                    <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                  </svg>
                  {selectedTeam?.name || 'Team'}
                </button>
                
                <svg className="breadcrumb-separator" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="9 18 15 12 9 6"></polyline>
                </svg>
                
                <button className="breadcrumb-item clickable" onClick={handleBackToUnitSelection}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                    <line x1="9" y1="3" x2="9" y2="21"></line>
                  </svg>
                  {selectedUnit.name}
                </button>
              </div>
            ) : selectedTeam ? (
              // Show just team with change button
              <>
                <div className="team-badge">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                    <circle cx="9" cy="7" r="4"></circle>
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                    <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                  </svg>
                  {selectedTeam.name}
                </div>
                <button className="team-change-button" onClick={handleBackToTeamSelection}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                    <polyline points="9 22 9 12 15 12 15 22"></polyline>
                  </svg>
                  Change Team
                </button>
              </>
            ) : (
              // Show selection hint when nothing selected
              <div className="team-selection-hint">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                  <circle cx="9" cy="7" r="4"></circle>
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                  <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                </svg>
                Select a team to continue
              </div>
            )}
          </>
        )}
      </div>

      <div className="mode-toggle-right">
        {/* Management button - show for admin, team_lead, and unit_lead */}
        {user && ['admin', 'team_lead', 'unit_lead'].includes(user.user_role) && (
          <button className="mode-admin-button" title={
            user.user_role === 'admin' ? 'Admin Panel' :
            user.user_role === 'team_lead' ? 'Team Management' :
            'Unit Management'
          } onClick={() => navigate('/admin')}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L2 7l10 5 10-5-10-5z"></path>
              <path d="M2 17l10 5 10-5"></path>
              <path d="M2 12l10 5 10-5"></path>
            </svg>
          </button>
        )}
        
        <button className="mode-settings-button" title="Settings" onClick={handleSettingsClick}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"></path>
            <circle cx="12" cy="12" r="3"></circle>
          </svg>
        </button>

        {/* Panel Toggle Buttons */}
        <div className="panel-toggle-buttons">
          <button 
            className={`panel-toggle-btn ${panelVisibility?.left ? 'active' : ''}`}
            title={panelVisibility?.left ? 'Hide left panel (Tasks)' : 'Show left panel (Tasks)'}
            onClick={handleToggleLeftPanel}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <rect x="3" y="3" width="8" height="18" rx="1" ry="1" opacity="0.6"/>
              <rect x="13" y="3" width="8" height="18" rx="1" ry="1" opacity="0.3"/>
            </svg>
          </button>

          <button 
            className={`panel-toggle-btn ${panelVisibility?.middle ? 'active' : ''}`}
            title={panelVisibility?.middle ? 'Hide middle panel (Chat)' : 'Show middle panel (Chat)'}
            onClick={handleToggleMiddlePanel}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <rect x="3" y="3" width="6" height="18" rx="1" ry="1" opacity="0.3"/>
              <rect x="11" y="3" width="6" height="18" rx="1" ry="1" opacity="0.6"/>
              <rect x="19" y="3" width="2" height="18" rx="1" ry="1" opacity="0.3"/>
            </svg>
          </button>

          <button 
            className={`panel-toggle-btn ${panelVisibility?.right ? 'active' : ''}`}
            title={panelVisibility?.right ? 'Hide right panel (Calendar)' : 'Show right panel (Calendar)'}
            onClick={handleToggleRightPanel}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <rect x="3" y="3" width="8" height="18" rx="1" ry="1" opacity="0.3"/>
              <rect x="13" y="3" width="8" height="18" rx="1" ry="1" opacity="0.6"/>
            </svg>
          </button>
        </div>
        {/* Removed custom window controls - using native macOS traffic lights */}
      </div>
    </div>
  );
}
