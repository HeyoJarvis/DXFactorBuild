import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './ModeToggle.css';

/**
 * ModeToggle - Switch between Personal and Team modes
 * Personal: Individual work (Tasks page)
 * Team: Team collaboration (Team Chat)
 */
export default function ModeToggle({ user, mode, onModeChange, selectedTeam, onTeamChange, teams, loading, panelVisibility, onTogglePanel }) {
  const navigate = useNavigate();

  const handleToggleMode = () => {
    const newMode = mode === 'personal' ? 'team' : 'personal';
    onModeChange(newMode);
  };

  const handleTeamSelect = (e) => {
    const teamId = e.target.value;
    const team = teams.find(t => t.id === teamId);
    if (team) {
      onTeamChange(team);
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
            <div className="team-selector">
              <label htmlFor="team-select" className="team-selector-label">
                Team:
              </label>
              {loading ? (
                <div className="team-selector-loading">Loading teams...</div>
              ) : teams.length === 0 ? (
                <div className="team-selector-empty">No teams available</div>
              ) : (
                <select
                  id="team-select"
                  className="team-selector-dropdown"
                  value={selectedTeam?.id || ''}
                  onChange={handleTeamSelect}
                >
                  {teams.map(team => (
                    <option key={team.id} value={team.id}>
                      {team.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </>
        )}
      </div>

      <div className="mode-toggle-right">
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
