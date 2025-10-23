import { useState, useEffect } from 'react';
import './ModeToggle.css';

/**
 * ModeToggle - Switch between Personal and Team modes
 * Personal: Individual work (Tasks page)
 * Team: Team collaboration (Team Chat)
 */
export default function ModeToggle({ user, mode, onModeChange, selectedTeam, onTeamChange, teams, loading }) {
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
        <div className="mode-user-info">
          <div className="mode-user-avatar">
            {user?.name?.[0]?.toUpperCase() || 'U'}
          </div>
          <span className="mode-user-name">{user?.name || 'User'}</span>
        </div>
        <div className="mode-shortcut-hint" title="Toggle mode">
          <kbd>⌘</kbd>+<kbd>T</kbd>
        </div>
      </div>
    </div>
  );
}
