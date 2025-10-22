import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import './TabBar.css';

export default function TabBar({ userRole, user, onLogout }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    // Update active tab based on current route
    const path = location.pathname;
    if (path.includes('/tasks')) setActiveTab('tasks');
    else if (path.includes('/mission-control')) setActiveTab('mission-control');
    else if (path.includes('/architecture')) setActiveTab('architecture');
    else if (path.includes('/indexer')) setActiveTab('indexer');
    else if (path.includes('/settings')) setActiveTab('settings');
  }, [location]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    }
    
    if (showDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showDropdown]);

  // Define tabs in the correct order: Mission Control, Code, Architecture, Tasks
  const tabs = [
    {
      id: 'mission-control',
      path: '/mission-control',
      label: 'Mission Control',
    },
    {
      id: 'indexer',
      path: '/indexer',
      label: 'Code',
    },
    {
      id: 'architecture',
      path: '/architecture',
      label: 'Architecture',
      roles: ['developer'] // Only show for developers
    },
    {
      id: 'tasks',
      path: '/tasks',
      label: userRole === 'developer' ? 'Developer' : 'Sales Tasks',
    }
  ];

  // Filter tabs based on user role
  const visibleTabs = tabs.filter(tab => {
    if (!tab.roles) return true;
    return tab.roles.includes(userRole);
  });

  const handleSettingsClick = () => {
    setShowDropdown(false);
    navigate('/settings');
  };

  const handleLogoutClick = () => {
    setShowDropdown(false);
    if (onLogout) onLogout();
  };

  // Get user initials for avatar fallback
  const getUserInitials = () => {
    if (!user?.name) return 'U';
    const names = user.name.split(' ');
    if (names.length >= 2) {
      return `${names[0][0]}${names[1][0]}`.toUpperCase();
    }
    return user.name[0].toUpperCase();
  };

  return (
    <div className="tab-bar">
      <div className="tab-bar-inner">
        {/* Left: Navigation Tabs */}
        <div className="tab-bar-left">
          {visibleTabs.map(tab => (
            <NavLink
              key={tab.id}
              to={tab.path}
              className={({ isActive }) => 
                `tab-bar-item ${isActive || activeTab === tab.id ? 'active' : ''}`
              }
            >
              <span>{tab.label}</span>
            </NavLink>
          ))}
        </div>

        {/* Center: Search Bar */}
        <div className="tab-bar-center">
          <div className="tab-bar-search">
            <svg className="tab-bar-search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"></circle>
              <path d="m21 21-4.35-4.35"></path>
            </svg>
            <input 
              type="text" 
              placeholder="Search missions, contacts, code..." 
              className="tab-bar-search-input"
            />
            <kbd className="tab-bar-search-kbd">⌘K</kbd>
          </div>
        </div>

        {/* Right: Voice, Status, Profile */}
        <div className="tab-bar-right">
          {/* Voice/Mic Button */}
          <button className="tab-bar-icon-button" aria-label="Voice input">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path>
              <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
              <line x1="12" y1="19" x2="12" y2="22"></line>
            </svg>
          </button>

          {/* Online Status Indicator */}
          <div className="tab-bar-status-indicator" title="Online">
            <div className="tab-bar-status-dot"></div>
          </div>

          {/* Profile Picture with Dropdown */}
          <div className="tab-bar-profile" ref={dropdownRef}>
            <button 
              className="tab-bar-profile-button"
              onClick={() => setShowDropdown(!showDropdown)}
              aria-label="User menu"
            >
              {user?.avatar_url ? (
                <img src={user.avatar_url} alt={user.name} className="tab-bar-avatar" />
              ) : (
                <div className="tab-bar-avatar-fallback">
                  {getUserInitials()}
                </div>
              )}
            </button>

            {/* Dropdown Menu */}
            {showDropdown && (
              <div className="tab-bar-dropdown">
                <div className="tab-bar-dropdown-header">
                  <div className="tab-bar-dropdown-name">{user?.name || 'User'}</div>
                  <div className="tab-bar-dropdown-email">{user?.email || ''}</div>
                </div>
                <div className="tab-bar-dropdown-divider"></div>
                <button className="tab-bar-dropdown-item" onClick={handleSettingsClick}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"></path>
                    <circle cx="12" cy="12" r="3"></circle>
                  </svg>
                  Settings
                </button>
                <button className="tab-bar-dropdown-item" onClick={handleLogoutClick}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                    <polyline points="16 17 21 12 16 7"></polyline>
                    <line x1="21" y1="12" x2="9" y2="12"></line>
                  </svg>
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

