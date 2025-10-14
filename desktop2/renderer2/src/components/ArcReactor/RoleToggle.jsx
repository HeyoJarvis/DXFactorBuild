import './RoleToggle.css';

/**
 * Role Toggle - Switch between developer and sales modes
 * Appears when the menu is open
 */
function RoleToggle({ currentRole, onRoleChange, isVisible }) {
  if (!isVisible) return null;

  // Position at bottom of window (orb is centered at 100, 100)
  const togglePosition = {
    left: '10px', // Small margin from left
    bottom: '10px' // Bottom of window
  };

  return (
    <div className="role-toggle" style={togglePosition}>
      <div className="role-toggle-label">Mode:</div>
      <div className="role-toggle-buttons">
        <button
          className={`role-toggle-button ${currentRole === 'developer' ? 'active' : ''}`}
          onClick={() => onRoleChange('developer')}
          data-role="developer"
        >
          <span className="role-icon">👨‍💻</span>
          <span className="role-label">Developer</span>
        </button>
        <button
          className={`role-toggle-button ${currentRole === 'sales' ? 'active' : ''}`}
          onClick={() => onRoleChange('sales')}
          data-role="sales"
        >
          <span className="role-icon">💼</span>
          <span className="role-label">Sales</span>
        </button>
      </div>
    </div>
  );
}

export default RoleToggle;

