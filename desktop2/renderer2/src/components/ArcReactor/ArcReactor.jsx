import { useState, useEffect } from 'react';
import ArcReactorOrb from './ArcReactorOrb';
import RadialMenu from './RadialMenu';
import RoleToggle from './RoleToggle';
import './ArcReactor.css';

/**
 * Arc Reactor - Main component that manages the orb, menu, and role toggle
 * Features:
 * - Persistent orb with drag support
 * - Radial menu for navigation
 * - Role toggle (developer/sales)
 * - Window expand/collapse integration
 */
function ArcReactor({ isCollapsed = true, onNavigate }) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [currentRole, setCurrentRole] = useState('sales'); // Default to sales
  const [orbPosition, setOrbPosition] = useState({ x: 20, y: window.innerHeight - 100 });

  // Load saved role from localStorage
  useEffect(() => {
    const savedRole = localStorage.getItem('heyjarvis-role');
    if (savedRole && (savedRole === 'developer' || savedRole === 'sales')) {
      setCurrentRole(savedRole);
    } else {
      // Set default to sales if no saved role
      setCurrentRole('sales');
      localStorage.setItem('heyjarvis-role', 'sales');
    }
  }, []);

  // Save role to localStorage when it changes
  const handleRoleChange = (newRole) => {
    setCurrentRole(newRole);
    localStorage.setItem('heyjarvis-role', newRole);
    setIsMenuOpen(false); // Close menu when switching roles
    
    console.log(`🎭 Role switched to: ${newRole}`);
    
    // Notify backend of role change
    if (window.electronAPI?.system?.setRole) {
      window.electronAPI.system.setRole(newRole);
    }
  };

  const handleMenuToggle = async () => {
    const newState = !isMenuOpen;
    console.log('🔄 Menu toggle:', newState ? 'OPEN' : 'CLOSE');
    
    // Resize window to accommodate menu
    if (window.electronAPI?.window?.resizeForMenu) {
      await window.electronAPI.window.resizeForMenu(newState);
    }
    
    setIsMenuOpen(newState);
  };

  const handleMenuItemClick = async (itemId) => {
    if (!itemId) {
      setIsMenuOpen(false);
      return;
    }

    console.log(`🎯 Menu item clicked: ${itemId}`);
    setIsMenuOpen(false);
    
    // If collapsed, expand window first
    if (isCollapsed) {
      if (window.electronAPI?.window?.expandCopilot) {
        await window.electronAPI.window.expandCopilot();
      }
      
      // Wait for expansion
      await new Promise(resolve => setTimeout(resolve, 300));
    }
    
    // Navigate to the selected item
    if (onNavigate) {
      onNavigate(itemId);
    }
  };

  // Track orb position for menu placement
  const handleOrbMove = (position) => {
    setOrbPosition(position);
  };

  // Ensure mouse forwarding is disabled when expanded
  useEffect(() => {
    if (!isCollapsed && window.electronAPI?.window?.setMouseForward) {
      // In expanded mode, never forward mouse events
      window.electronAPI.window.setMouseForward(false);
      console.log('🖱️ Mouse forwarding DISABLED (expanded mode)');
    }
  }, [isCollapsed]);

  return (
    <div className="arc-reactor-container">
      <ArcReactorOrb
        onMenuToggle={handleMenuToggle}
        isMenuOpen={isMenuOpen}
        currentRole={currentRole}
        onPositionChange={handleOrbMove}
        isCollapsed={isCollapsed}
      />
      
      <RadialMenu
        isOpen={isMenuOpen}
        orbPosition={orbPosition}
        onItemClick={handleMenuItemClick}
        currentRole={currentRole}
        onRoleToggle={handleRoleChange}
      />
      
      {/* RoleToggle removed - mode switching now in menu */}
    </div>
  );
}

export default ArcReactor;

