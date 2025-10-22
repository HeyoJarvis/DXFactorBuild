import { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import Copilot from './pages/Copilot';
import Tasks from './pages/Tasks';
import TasksDeveloper from './pages/TasksDeveloper';
import ArchitectureDiagram from './pages/ArchitectureDiagram';
import Indexer from './pages/Indexer';
import MissionControl from './pages/MissionControl';
import Settings from './pages/Settings';
import Login from './pages/Login';
import Navigation from './components/common/Navigation';
import ArcReactor from './components/ArcReactor/ArcReactor';

function App() {
  const navigate = useNavigate();
  const [isCollapsed, setIsCollapsed] = useState(true); // Start collapsed (Arc Reactor only)
  const [systemStatus, setSystemStatus] = useState(null);
  const [initialChatMessage, setInitialChatMessage] = useState(null);
  
  // Auth state
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [userRole, setUserRole] = useState('sales'); // Default to sales

  useEffect(() => {
    initializeApp();
    checkAuthStatus();
    loadUserRole();
  }, []);

  // Load user role from localStorage
  function loadUserRole() {
    const savedRole = localStorage.getItem('heyjarvis-role');
    if (savedRole && (savedRole === 'developer' || savedRole === 'sales')) {
      setUserRole(savedRole);
    } else {
      setUserRole('sales');
      localStorage.setItem('heyjarvis-role', 'sales');
    }
  }

  // Listen for role changes
  useEffect(() => {
    const handleStorageChange = () => {
      loadUserRole();
    };
    window.addEventListener('storage', handleStorageChange);
    
    // Poll for role changes (since storage event doesn't fire in same window)
    const interval = setInterval(loadUserRole, 500);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(interval);
    };
  }, []);

  // Force mouse forwarding state based on auth and collapsed state
  useEffect(() => {
    if (window.electronAPI?.window?.setMouseForward) {
      // CRITICAL: While loading auth, keep forwarding DISABLED so orb is clickable
      if (authLoading) {
        window.electronAPI.window.setMouseForward(false);
        console.log(`🖱️ Mouse forwarding DISABLED (auth loading)`);
        return;
      }
      
      // NEVER forward on login page - must be fully interactive
      if (!isAuthenticated) {
        window.electronAPI.window.setMouseForward(false);
        console.log(`🖱️ Mouse forwarding DISABLED (login page)`);
        return;
      }
      
      // When authenticated:
      // - In EXPANDED mode: Always disable forwarding (full UI needs clicks)
      // - In COLLAPSED mode: Start with forwarding DISABLED
      //   Let ArcReactorOrb control forwarding via its mouse enter/leave handlers
      if (!isCollapsed) {
        // Expanded mode - disable forwarding for full UI interaction
        window.electronAPI.window.setMouseForward(false);
        console.log(`🖱️ Mouse forwarding DISABLED (expanded mode - full UI)`);
      } else {
        // Collapsed mode - START with forwarding disabled
        // ArcReactorOrb will enable it on mouse leave
        window.electronAPI.window.setMouseForward(false);
        console.log(`🖱️ Mouse forwarding DISABLED (collapsed mode - orb controls it)`);
      }
    }
  }, [isCollapsed, isAuthenticated, authLoading]);

  async function checkAuthStatus() {
    try {
      console.log('🔐 Checking auth status...');
      if (window.electronAPI?.auth) {
        const result = await window.electronAPI.auth.getSession();
        
        if (result.success && result.session) {
          console.log('✅ User is authenticated:', result.session.user);
          setIsAuthenticated(true);
          setCurrentUser(result.session.user);
        } else {
          console.log('⚠️ No active session found');
          setIsAuthenticated(false);
        }
      }
    } catch (error) {
      console.error('❌ Auth check failed:', error);
      setIsAuthenticated(false);
    } finally {
      setAuthLoading(false);
    }
  }

  function handleLoginSuccess(user, session) {
    console.log('✅ Login successful!', user);
    setCurrentUser(user);
    setIsAuthenticated(true);
  }

  async function handleLogout() {
    try {
      if (window.electronAPI?.auth) {
        await window.electronAPI.auth.signOut();
      }
      setIsAuthenticated(false);
      setCurrentUser(null);
    } catch (error) {
      console.error('❌ Logout failed:', error);
    }
  }

  async function initializeApp() {
    try {
      console.log('🚀 App initialization started - Arc Reactor mode');
      console.log('📡 electronAPI available:', !!window.electronAPI);
      
      // Check if we're in Electron
      if (window.electronAPI) {
        console.log('🔌 Calling system.getStatus...');
        const statusResponse = await window.electronAPI.system.getStatus();
        console.log('📊 Status response:', statusResponse);
        if (statusResponse.success) {
          setSystemStatus(statusResponse.data);
        }
      } else {
        console.warn('⚠️ electronAPI not available - running in browser mode');
      }

      console.log('✅ App ready - showing Arc Reactor orb');
    } catch (error) {
      console.error('❌ App initialization error:', error);
    }
  }

  const handleMinimizeToHeader = async () => {
    console.log('🔽 Minimizing to Arc Reactor orb...');
    
    // Collapse window first
    if (window.electronAPI) {
      try {
        await window.electronAPI.window.collapseCopilot();
        console.log('✅ Window collapsed');
        
        // Enable mouse forwarding in collapsed mode (so desktop is clickable)
        if (window.electronAPI.window.setMouseForward) {
          await window.electronAPI.window.setMouseForward(true);
          console.log('🖱️ ENABLED mouse forwarding (collapsed mode)');
        }
      } catch (error) {
        console.error('❌ Failed to collapse window:', error);
      }
    }
    
    // Switch to collapsed mode (shows Arc Reactor only)
    setIsCollapsed(true);
    setInitialChatMessage(null); // Clear any previous message
  };

  const handleArcReactorNavigate = async (itemId) => {
    console.log(`🧭 Navigating from Arc Reactor to: ${itemId}`);
    
    // Navigate based on item ID
    const routeMap = {
      'chat': '/copilot',
      'mission-control': '/mission-control',
      'tasks': '/tasks',
      'architecture': '/architecture',
      'indexer': '/indexer',
      'code': '/indexer', // Map code to indexer
      'settings': '/settings',
      'github': '/copilot',
      'crm': '/copilot',
      'deals': '/tasks'
    };
    
    const targetRoute = routeMap[itemId] || '/copilot';
    
    // Open in secondary window
    if (window.electronAPI?.window?.openSecondary) {
      try {
        await window.electronAPI.window.openSecondary(targetRoute);
        console.log(`✅ Opened secondary window: ${targetRoute}`);
      } catch (error) {
        console.error('❌ Failed to open secondary window:', error);
      }
    } else {
      console.warn('⚠️ Secondary window API not available, using legacy navigation');
      
      // Legacy fallback
      // CRITICAL: Disable mouse forwarding IMMEDIATELY
      if (window.electronAPI?.window?.setMouseForward) {
        await window.electronAPI.window.setMouseForward(false);
        console.log('🖱️ FORCE DISABLED mouse forwarding before expand');
      }
      
      // Expand window first
      if (window.electronAPI && isCollapsed) {
        try {
          await window.electronAPI.window.expandCopilot();
          console.log('✅ Window expanded');
        } catch (error) {
          console.error('❌ Failed to expand window:', error);
        }
      }
      
      // Ensure we're expanded in UI
      setIsCollapsed(false);
      navigate(targetRoute);
    }
  };

  // Show loading while checking auth
  if (authLoading) {
    return (
      <div className="app" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🤖</div>
          <div style={{ fontSize: '16px', color: '#6b7280' }}>Loading...</div>
        </div>
      </div>
    );
  }

  // Show login if not authenticated (wrapped in app container with pointer-events enabled)
  if (!isAuthenticated) {
    return (
      <div className="app app-login">
        <Login onLoginSuccess={handleLoginSuccess} />
      </div>
    );
  }

  // Check if we're in the orb window or secondary window based on hash
  const isOrbWindow = !window.location.hash || window.location.hash === '#/';
  
  // If this is the orb window, show only Arc Reactor
  if (isOrbWindow) {
    return (
      <div className="app app-collapsed">
        <ArcReactor
          isCollapsed={true}
          onNavigate={handleArcReactorNavigate}
        />
      </div>
    );
  }

  // Check if we're on pages without navigation
  const isTasksPage = window.location.hash === '#/tasks';
  const isArchitecturePage = window.location.hash === '#/architecture';
  const isIndexerPage = window.location.hash === '#/indexer';
  const isMissionControlPage = window.location.hash === '#/mission-control';
  const isSettingsPage = window.location.hash === '#/settings';
  const hideNavigation = isTasksPage || isArchitecturePage || isIndexerPage || isMissionControlPage || isSettingsPage;
  
  // If this is the secondary window, show the main UI (no orb)
  return (
    <div className="app app-secondary">
      {!hideNavigation && (
        <Navigation 
          user={currentUser}
          onLogout={handleLogout}
          onMinimize={() => {
            // Close this window instead of minimizing
            if (window.electronAPI?.window) {
              window.close();
            }
          }} 
        />
      )}
      <div className="app-content">
        <Routes>
          <Route path="/" element={<Navigate to="/tasks" replace />} />
          <Route path="/copilot" element={<Copilot systemStatus={systemStatus} initialMessage={initialChatMessage} user={currentUser} />} />
          <Route path="/tasks" element={
            userRole === 'developer' 
              ? <TasksDeveloper user={currentUser} />
              : <Tasks user={currentUser} />
          } />
          <Route path="/architecture" element={<ArchitectureDiagram user={currentUser} />} />
          <Route path="/indexer" element={<Indexer user={currentUser} />} />
          <Route path="/mission-control" element={<MissionControl user={currentUser} />} />
          <Route path="/settings" element={<Settings user={currentUser} />} />
        </Routes>
      </div>
    </div>
  );
}

export default App;


