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

  // Load user role from database (synced with backend)
  useEffect(() => {
    const loadUserRole = async () => {
      console.log('🔄 Loading user role...');
      try {
        // Check if electronAPI exists
        if (!window.electronAPI?.auth?.getCurrentUser) {
          console.warn('⚠️ electronAPI.auth.getCurrentUser not available, using localStorage');
          const savedRole = localStorage.getItem('heyjarvis-role') || 'sales';
          setCurrentRole(savedRole);
          return;
        }

        // Get user role from auth service (which loads from database)
        console.log('📡 Calling getCurrentUser...');
        const result = await window.electronAPI.auth.getCurrentUser();
        console.log('📥 getCurrentUser result:', result);
        
        if (result.success && result.user?.user_role) {
          const dbRole = result.user.user_role;
          console.log('✅ Loaded role from database:', dbRole);
          setCurrentRole(dbRole);
          // Sync localStorage with database
          localStorage.setItem('heyjarvis-role', dbRole);
        } else {
          console.log('⚠️ No user role in database, using fallback');
          // Fallback to localStorage if database fails
          const savedRole = localStorage.getItem('heyjarvis-role');
          if (savedRole && (savedRole === 'developer' || savedRole === 'sales')) {
            console.log('📦 Using localStorage role:', savedRole);
            setCurrentRole(savedRole);
          } else {
            // Default to sales
            console.log('🔧 Defaulting to sales role');
            setCurrentRole('sales');
            localStorage.setItem('heyjarvis-role', 'sales');
          }
        }
      } catch (error) {
        console.error('❌ Failed to load user role:', error);
        // Fallback to localStorage
        const savedRole = localStorage.getItem('heyjarvis-role');
        if (savedRole) {
          console.log('📦 Fallback to localStorage:', savedRole);
          setCurrentRole(savedRole);
        } else {
          console.log('🔧 Fallback to default: sales');
          setCurrentRole('sales');
        }
      }
    };

    loadUserRole();
  }, []);

  // Save role to database and localStorage when it changes
  const handleRoleChange = async (newRole) => {
    setCurrentRole(newRole);
    localStorage.setItem('heyjarvis-role', newRole);
    setIsMenuOpen(false); // Close menu when switching roles
    
    console.log(`🎭 Role switched to: ${newRole}`);
    
    // Save to database via onboarding handler (persists role)
    try {
      const result = await window.electronAPI.onboarding.setRole(newRole);
      if (result.success) {
        console.log('✅ Role saved to database:', newRole);
      } else {
        console.error('❌ Failed to save role to database:', result.error);
      }
    } catch (error) {
      console.error('❌ Error saving role:', error);
    }
    
    // Also notify backend state (for immediate use)
    if (window.electronAPI?.system?.setRole) {
      window.electronAPI.system.setRole(newRole);
    }
  };

  const handleMenuToggle = async () => {
    const newState = !isMenuOpen;
    console.log('🔄 Menu toggle:', newState ? 'OPEN' : 'CLOSE');
    
    // CRITICAL: Disable mouse forwarding BEFORE opening menu
    if (newState && window.electronAPI?.window?.setMouseForward) {
      await window.electronAPI.window.setMouseForward(false);
      console.log('🖱️ DISABLED mouse forwarding for menu');
    }
    
    // Resize window to accommodate menu
    if (window.electronAPI?.window?.resizeForMenu) {
      await window.electronAPI.window.resizeForMenu(newState);
    }
    
    setIsMenuOpen(newState);
    
    // CRITICAL: Only re-enable forwarding in collapsed mode after menu closes
    if (!newState && isCollapsed && window.electronAPI?.window?.setMouseForward) {
      // Small delay to ensure menu click completes first
      setTimeout(async () => {
        await window.electronAPI.window.setMouseForward(true);
        console.log('🖱️ Re-enabled mouse forwarding after menu close');
      }, 100);
    }
  };

  const handleMenuItemClick = async (itemId) => {
    if (!itemId) {
      setIsMenuOpen(false);
      
      // Re-enable mouse forwarding only in collapsed mode
      if (isCollapsed && window.electronAPI?.window?.setMouseForward) {
        setTimeout(() => {
          window.electronAPI.window.setMouseForward(true);
          console.log('🖱️ Menu closed without selection - re-enabled forwarding');
        }, 100);
      }
      return;
    }

    console.log(`🎯 Menu item clicked: ${itemId}`);
    
    setIsMenuOpen(false);
    
    // Map itemId to route
    const routeMap = {
      'chat': '/copilot',
      'mission-control': '/mission-control',
      'tasks': '/tasks',
      'architecture': '/architecture',
      'code': '/indexer',
      'indexer': '/indexer',
      'github': '/copilot',
      'crm': '/copilot',
      'deals': '/tasks',
      'settings': '/settings'
    };
    
    const route = routeMap[itemId] || '/tasks';
    
    // Open secondary window with the route
    if (window.electronAPI?.window?.openSecondary) {
      console.log(`🪟 Opening secondary window: ${route}`);
      await window.electronAPI.window.openSecondary(route);
    }
    
    // Keep mouse forwarding enabled so orb stays clickable
    if (window.electronAPI?.window?.setMouseForward) {
      setTimeout(() => {
        window.electronAPI.window.setMouseForward(true);
        console.log('🖱️ Re-enabled mouse forwarding (orb window stays active)');
      }, 100);
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

