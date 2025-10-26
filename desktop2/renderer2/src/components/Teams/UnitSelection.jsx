import { useState } from 'react';
import './UnitSelection.css';

/**
 * UnitSelection - Display units within a selected team/department
 * Second level of selection after choosing a department
 */
export default function UnitSelection({ selectedTeam, onUnitSelect, onBack }) {
  const [hoveredUnit, setHoveredUnit] = useState(null);

  const units = selectedTeam?.units || [];

  return (
    <div className="unit-selection-container">
      <div className="unit-selection-header">
        <button className="unit-back-button" onClick={onBack}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="19" y1="12" x2="5" y2="12"></line>
            <polyline points="12 19 5 12 12 5"></polyline>
          </svg>
          Back to Teams
        </button>
        
        <div className="unit-selection-title-section">
          <h1 className="unit-selection-title">{selectedTeam.name}</h1>
          <p className="unit-selection-subtitle">
            Select a unit to view its context, chat, and collaborate
          </p>
        </div>
      </div>

      <div className="unit-selection-grid">
        {units.map((unit, index) => (
          <div
            key={unit.id}
            className={`unit-card ${hoveredUnit === unit.id ? 'hovered' : ''}`}
            onClick={() => onUnitSelect(unit)}
            onMouseEnter={() => setHoveredUnit(unit.id)}
            onMouseLeave={() => setHoveredUnit(null)}
          >
            <div className="unit-card-glow"></div>
            
            <div className="unit-card-header">
              <div className="unit-card-icon" style={{
                background: `linear-gradient(135deg, ${getUnitColor(index)}, ${getUnitColor(index, true)})`
              }}>
                {unit.name?.[0]?.toUpperCase() || 'U'}
              </div>
              <div className="unit-card-badge">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                  <line x1="9" y1="3" x2="9" y2="21"></line>
                </svg>
                Unit
              </div>
            </div>

            <div className="unit-card-content">
              <h2 className="unit-card-name">{unit.name}</h2>
              {unit.description && (
                <p className="unit-card-description">{unit.description}</p>
              )}
              
              {unit.slug && (
                <div className="unit-card-slug">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
                    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
                  </svg>
                  /{unit.slug}
                </div>
              )}
            </div>

            <div className="unit-card-arrow">
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

// Helper function to get colors for different units
function getUnitColor(index, darker = false) {
  const colors = [
    ['#3b82f6', '#2563eb'], // Blue
    ['#10b981', '#059669'], // Green
    ['#f59e0b', '#d97706'], // Amber
    ['#ec4899', '#db2777'], // Pink
    ['#8b5cf6', '#7c3aed'], // Purple
    ['#06b6d4', '#0891b2'], // Cyan
    ['#f43f5e', '#e11d48'], // Rose
    ['#6366f1', '#4f46e5'], // Indigo
  ];
  
  const colorPair = colors[index % colors.length];
  return darker ? colorPair[1] : colorPair[0];
}


