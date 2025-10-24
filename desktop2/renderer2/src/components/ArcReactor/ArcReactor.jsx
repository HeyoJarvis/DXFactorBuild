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
  const [notifications, setNotifications] = useState([]);
  const [currentNotification, setCurrentNotification] = useState(null);

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
    console.log('🎯 [ARCREACTOR] Orb clicked - opening Mission Control directly');
    
    // Open Mission Control directly (no menu)
    if (window.electronAPI?.window?.openSecondary) {
      await window.electronAPI.window.openSecondary('/mission-control');
      console.log('🪟 [ARCREACTOR] Mission Control window opened');
    }
  };
  
  // DEV ONLY: Test notification trigger
  const triggerTestNotification = () => {
    const testNotification = {
      type: 'new_task',
      taskKey: 'TEST-123',
      title: 'Test Task',
      priority: 'high',
      timestamp: Date.now(),
      source: 'test'
    };
    
    console.log('🧪 Triggering test notification:', testNotification);
    const message = formatNotificationMessage(testNotification);
    setCurrentNotification(message);
    setNotifications(prev => [...prev, testNotification]);
    
    // Auto-clear after 5 seconds
    setTimeout(() => {
      setCurrentNotification(null);
      setNotifications([]);
    }, 5000);
  };
  
  // DEV: Expose trigger to window for console access
  if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
    window.testNotification = triggerTestNotification;
  }
  
  // DEV: Add keyboard shortcut (Cmd/Ctrl + K then N) - two key sequence to avoid conflicts
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      let cmdKPressed = false;
      let cmdKTimeout = null;
      
      const handleKeyPress = (e) => {
        // First press Cmd+K (or Ctrl+K)
        if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
          e.preventDefault();
          cmdKPressed = true;
          console.log('🎹 Cmd+K pressed, now press N for test notification');
          
          // Reset after 2 seconds if N not pressed
          if (cmdKTimeout) clearTimeout(cmdKTimeout);
          cmdKTimeout = setTimeout(() => {
            cmdKPressed = false;
          }, 2000);
        }
        // Then press N
        else if (cmdKPressed && e.key === 'n') {
          e.preventDefault();
          cmdKPressed = false;
          if (cmdKTimeout) clearTimeout(cmdKTimeout);
          console.log('🎹 Keyboard shortcut triggered: Cmd+K then N');
          triggerTestNotification();
        }
      };
      
      window.addEventListener('keydown', handleKeyPress);
      return () => {
        window.removeEventListener('keydown', handleKeyPress);
        if (cmdKTimeout) clearTimeout(cmdKTimeout);
      };
    }
  }, []);

  const handleMenuItemClick = async (itemId) => {
    if (!itemId) {
      setIsMenuOpen(false);
      console.log('🖱️ [ARCREACTOR] Menu closed without selection - letting orb control forwarding');
      return;
    }

    console.log(`🎯 [ARCREACTOR] Menu item clicked: ${itemId}`);
    
    setIsMenuOpen(false);
    
    // Map itemId to route for all pages
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
      console.log(`🪟 [ARCREACTOR] Opening secondary window: ${route}`);
      await window.electronAPI.window.openSecondary(route);
    }
    
    // DON'T re-enable forwarding here!
    // Let ArcReactorOrb handle it via mouse leave
    console.log('🖱️ [ARCREACTOR] Secondary window opened - letting orb control forwarding');
  };

  // Track orb position for menu placement
  const handleOrbMove = (position) => {
    setOrbPosition(position);
  };

  // Listen for notifications from main process
  useEffect(() => {
    if (window.electronAPI?.onNotification) {
      const cleanup = window.electronAPI.onNotification((notification) => {
        console.log('🔔 New notification received:', notification);
        
        // Add to notifications array
        setNotifications(prev => [...prev, notification]);
        
        // Format the notification message
        const message = formatNotificationMessage(notification);
        setCurrentNotification(message);
        
        // Clear message after 5 seconds if no new notifications
        setTimeout(() => {
          setNotifications(prev => {
            const updated = prev.filter(n => n.timestamp !== notification.timestamp);
            if (updated.length === 0) {
              setCurrentNotification(null);
            } else {
              // Show next notification
              setCurrentNotification(formatNotificationMessage(updated[updated.length - 1]));
            }
            return updated;
          });
        }, 5000);
      });
      
      return cleanup;
    }
  }, []);
  
  // Format notification message based on type
  const formatNotificationMessage = (notification) => {
    switch (notification.type) {
      case 'new_task':
      case 'jira_task_synced':
        return 'You have a new task';
      case 'task_updated':
      case 'jira_update':
        return `Progress on ${notification.taskKey || 'task'}`;
      case 'status_change':
        return `Task moved to ${notification.changes?.status?.to || 'updated'}`;
      case 'requirements_generated':
        return 'Product requirements ready';
      case 'pr_review':
        return 'PR requires your review';
      default:
        return notification.message || 'New notification';
    }
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
        notificationMessage={currentNotification}
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

