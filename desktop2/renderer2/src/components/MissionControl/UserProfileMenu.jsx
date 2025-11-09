import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import './UserProfileMenu.css';

/**
 * UserProfileMenu - Circular Jarvis logo with dropdown menu
 * 
 * Features:
 * - Jarvis logo in circle (matching login flow style)
 * - Dropdown menu: Settings, Logout
 */
export default function UserProfileMenu({ user }) {
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef(null);
  const navigate = useNavigate();

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setShowMenu(false);
      }
    };

    if (showMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showMenu]);

  const handleSettings = () => {
    setShowMenu(false);
    navigate('/settings');
  };

  const handleLogout = async () => {
    setShowMenu(false);
    try {
      await window.electronAPI?.auth?.logout?.();
      navigate('/login');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  return (
    <div className="user-profile-menu" ref={menuRef}>
      {/* Glow effect behind logo - HIDDEN */}
      {/* <div className="logo-glow"></div> */}
      
      <button
        className="profile-avatar-btn"
        onClick={() => setShowMenu(!showMenu)}
        title={user?.name || user?.email || 'User'}
        style={{ display: 'none' }}
      >
        <img src="/Jarvis.png" alt="Jarvis" className="jarvis-logo-img" />
      </button>

      {showMenu && (
        <div className="profile-dropdown-menu">
          <div className="dropdown-user-header">
            <div className="user-details">
              <div className="user-display-name">{user?.name || 'User'}</div>
              <div className="user-display-email">{user?.email || ''}</div>
              <div className="user-display-role">
                {user?.user_role || user?.role || 'User'}
              </div>
            </div>
          </div>

          <div className="menu-divider"></div>

          <div className="dropdown-actions">
            <button className="action-item" onClick={handleSettings}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="3"></circle>
                <path d="M12 1v6m0 6v6"></path>
              </svg>
              <span>Settings</span>
            </button>

            <button className="action-item logout-action" onClick={handleLogout}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                <polyline points="16 17 21 12 16 7"></polyline>
                <line x1="21" y1="12" x2="9" y2="12"></line>
              </svg>
              <span>Logout</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
