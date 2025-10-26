import { useState, useMemo } from 'react';
import './TeamSelection.css';

/**
 * TeamSelection - Display departments/big teams as clickable cards
 * First level of selection before showing units
 */
export default function TeamSelection({ teams, loading, onTeamSelect }) {
  const [hoveredTeam, setHoveredTeam] = useState(null);

  // Group teams by department to create the top-level "Teams"
  const departmentGroups = useMemo(() => {
    if (!teams || teams.length === 0) return [];
    
    const groups = {};
    teams.forEach(team => {
      const dept = team.department || 'General';
      if (!groups[dept]) {
        groups[dept] = {
          name: dept,
          description: `${dept} department teams and units`,
          units: [],
          totalMembers: 0
        };
      }
      groups[dept].units.push(team);
    });
    
    return Object.values(groups);
  }, [teams]);

  if (loading) {
    return (
      <div className="team-selection-container">
        <div className="team-selection-loading">
          <div className="loading-spinner"></div>
          <p>Loading teams...</p>
        </div>
      </div>
    );
  }

  if (!teams || teams.length === 0) {
    return (
      <div className="team-selection-container">
        <div className="team-selection-empty">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
            <circle cx="9" cy="7" r="4"></circle>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
            <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
          </svg>
          <h2>No Teams Available</h2>
          <p>You don't have any teams yet. Contact your administrator to create teams.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="team-selection-container">
      <div className="team-selection-header">
        <h1 className="team-selection-title">Select a Team</h1>
        <p className="team-selection-subtitle">
          Choose a department or team to view its units
        </p>
      </div>

      <div className="team-selection-grid">
        {departmentGroups.map((dept, index) => (
          <div
            key={dept.name}
            className={`team-card ${hoveredTeam === dept.name ? 'hovered' : ''}`}
            onClick={() => onTeamSelect(dept)}
            onMouseEnter={() => setHoveredTeam(dept.name)}
            onMouseLeave={() => setHoveredTeam(null)}
          >
            <div className="team-card-glow"></div>
            
            <div className="team-card-header">
              <div className="team-card-icon" style={{
                background: `linear-gradient(135deg, ${getColorForIndex(index)}, ${getColorForIndex(index, true)})`
              }}>
                {dept.name?.[0]?.toUpperCase() || 'T'}
              </div>
              <div className="team-card-badge">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                  <circle cx="9" cy="7" r="4"></circle>
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                  <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                </svg>
                Team
              </div>
            </div>

            <div className="team-card-content">
              <h2 className="team-card-name">{dept.name}</h2>
              {dept.description && (
                <p className="team-card-description">{dept.description}</p>
              )}
              
              <div className="team-card-stats">
                <div className="team-stat">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="3" width="7" height="7"></rect>
                    <rect x="14" y="3" width="7" height="7"></rect>
                    <rect x="14" y="14" width="7" height="7"></rect>
                    <rect x="3" y="14" width="7" height="7"></rect>
                  </svg>
                  <span>{dept.units.length} {dept.units.length === 1 ? 'unit' : 'units'}</span>
                </div>
              </div>
            </div>

            <div className="team-card-arrow">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="5" y1="12" x2="19" y2="12"></line>
                <polyline points="12 5 19 12 12 19"></polyline>
              </svg>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Helper function to get colors for different teams
function getColorForIndex(index, darker = false) {
  const colors = [
    ['#3b82f6', '#2563eb'], // Blue
    ['#8b5cf6', '#7c3aed'], // Purple
    ['#ec4899', '#db2777'], // Pink
    ['#f59e0b', '#d97706'], // Amber
    ['#10b981', '#059669'], // Green
    ['#06b6d4', '#0891b2'], // Cyan
    ['#f43f5e', '#e11d48'], // Rose
    ['#6366f1', '#4f46e5'], // Indigo
  ];
  
  const colorPair = colors[index % colors.length];
  return darker ? colorPair[1] : colorPair[0];
}

