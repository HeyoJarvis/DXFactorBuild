import { useEffect } from 'react';
import './RadialMenu.css';

/**
 * Radial Menu - Clean box-style menu that appears above the Arc Reactor orb
 * Features:
 * - Role-based menu items (developer vs sales)
 * - Smooth animations
 * - Click handling for navigation
 */
function RadialMenu({ isOpen, orbPosition, onItemClick, currentRole = 'developer', onRoleToggle }) {
  
  // Menu items based on role (no emojis - clean design)
  const menuItemsByRole = {
    developer: [
      { id: 'tasks', label: 'Tasks' },
      { id: 'chat', label: 'Chat' },
      { id: 'code', label: 'Indexer' }
    ],
    sales: [
      { id: 'tasks', label: 'Tasks' },
      { id: 'chat', label: 'Chat' },
      { id: 'code', label: 'Indexer' },
      { id: 'settings', label: 'Settings' }
    ]
  };

  const menuItems = menuItemsByRole[currentRole] || menuItemsByRole.developer;
  
  // Position menu so middle items align with orb center
  // Orb is now centered at (100, 100) in the window
  const orbCenterX = 100;
  const orbCenterY = 100;
  const orbRadius = 40; // Approximate orb size
  const menuGap = 15; // Gap between orb and menu
  
  // For developer (3 items + toggle = 4 total):
  // We want item 2 (Chat) to align with orb center
  // For sales (4 items + toggle = 5 total):
  // We want item 2.5 (between Chat and Indexer) to align with orb center
  const itemHeight = 38; // Height per item
  const itemGap = 6; // Gap between items
  const totalItems = menuItems.length + 1; // +1 for toggle
  
  // Position so that the middle of the list aligns with orb center
  const totalMenuHeight = (totalItems * itemHeight) + ((totalItems - 1) * itemGap);
  const middleOffset = totalMenuHeight / 2;
  
  // Move down by 15px for better visual centering
  const visualOffset = 15;
  
  const menuStyle = {
    left: `${orbCenterX + orbRadius + menuGap}px`, // To the right of orb
    top: `${orbCenterY - middleOffset + visualOffset}px`, // Middle of menu aligns with orb center, adjusted down
    display: 'flex',
    flexDirection: 'column',
    gap: '6px'
  };

  // Close menu on escape
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onItemClick(null);
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen, onItemClick]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="radial-menu" style={menuStyle}>
      {menuItems.map((item, index) => (
        <div
          key={item.id}
          className="radial-menu-item"
          style={{
            animationDelay: `${index * 0.05}s`
          }}
          onClick={() => onItemClick(item.id)}
        >
          {item.label}
        </div>
      ))}
      
      {/* Toggle button as last item */}
      <div 
        className="radial-menu-item role-toggle-item"
        onClick={() => {
          const newRole = currentRole === 'developer' ? 'sales' : 'developer';
          onRoleToggle && onRoleToggle(newRole);
        }}
      >
        Mode: {currentRole === 'developer' ? 'Dev' : 'Sales'}
      </div>
    </div>
  );
}

export default RadialMenu;





