import { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import Copilot from './pages/Copilot';
import Tasks from './pages/Tasks';
import TasksDeveloper from './pages/TasksDeveloper';
import ArchitectureDiagram from './pages/ArchitectureDiagram';
import Indexer from './pages/Indexer';
import MissionControl from './pages/MissionControl';
import TeamChat from './pages/TeamChat';
import Settings from './pages/Settings';
import Login from './pages/Login';
import LoginFlow from './pages/LoginFlow';
import DiagnosticMicrosoft from './pages/DiagnosticMicrosoft';
import ArcReactor from './components/ArcReactor/ArcReactor';

function App() {
  const navigate = useNavigate();
  const [isCollapsed, setIsCollapsed] = useState(true); // Start collapsed (Arc Reactor only)
  const [systemStatus, setSystemStatus] = useState(null);
  const [initialChatMessage, setInitialChatMessage] = useState(null);
  const [showOrb, setShowOrb] = useState(true); // Track if Arc Reactor orb should be visible
  
  // Auth state
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [userRole, setUserRole] = useState(null);
  
  // Orb visibility state - hide when Mission Control is open
  const [showOrb, setShowOrb] = useState(true);
  
  // Onboarding state - REMOVED, now handled in LoginFlow

  useEffect(() => {
    initializeApp();
    checkAuthStatus();
  }, []);

<<<<<<< HEAD
  // Listen for secondary window (Mission Control) state changes
  useEffect(() => {
    if (window.electronAPI?.window?.onSecondaryWindowChange) {
      const cleanup = window.electronAPI.window.onSecondaryWindowChange((isOpen, route) => {
        // Hide orb when Mission Control window is open, show when closed
        const shouldHideOrb = isOpen && route === '/mission-control';
        setShowOrb(!shouldHideOrb);
        console.log(`🪟 Secondary window ${isOpen ? 'opened' : 'closed'}: ${route}, Orb visible: ${!shouldHideOrb}`);
      });
      
      return cleanup;
=======
  // Listen for secondary window (Mission Control or Team Chat) state changes
  useEffect(() => {
    if (window.electronAPI?.window?.onSecondaryWindowChange) {
      const cleanup = window.electronAPI.window.onSecondaryWindowChange(
        (isOpen, route) => {
          // Hide orb when Mission Control or Team Chat window is open, show when closed
          const shouldHideOrb = isOpen && (route === '/mission-control' || route === '/team-chat');
          setShowOrb(!shouldHideOrb);
          
          console.log(
            `🪟 Secondary window ${isOpen ? 'opened' : 'closed'}: ${route}, ` +
            `Orb visible: ${!shouldHideOrb}`
          );
        }
      );
      
      return cleanup;  // Cleanup listener on unmount
>>>>>>> origin/Combinations/all
    }
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

  // Expand window to LoginFlow size when not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated && window.electronAPI?.window?.expandToLoginFlow) {
      window.electronAPI.window.expandToLoginFlow();
      console.log('🔄 Requested window expansion to LoginFlow size');
    }

    // Collapse window immediately when authenticated
    if (!authLoading && isAuthenticated && window.electronAPI?.window?.collapseCopilot) {
      window.electronAPI.window.collapseCopilot()
        .then(() => console.log('✅ Window collapsed on auth state change'))
        .catch(error => console.error('❌ Failed to collapse window:', error));
    }
  }, [isAuthenticated, authLoading]);

  async function checkAuthStatus() {
    try {
      console.log('🔐 Checking auth status...');
      if (window.electronAPI?.auth) {
        const result = await window.electronAPI.auth.getSession();

        if (result.success && result.session) {
          console.log('✅ User is authenticated:', result.session.user);
          setIsAuthenticated(true);
          setCurrentUser(result.session.user);

          // Extract user role from user object
          const role = result.session.user?.user_role;
          console.log('👤 User role:', role || 'none');
          setUserRole(role);
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

  async function handleLoginSuccess(user, session) {
    console.log('✅ Login successful!', user);

    // Extract and set user role
    const role = user?.user_role;
    console.log('👤 User role after login:', role || 'none');
    setUserRole(role);

    // Update state - this will trigger useEffect to collapse window
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

  // Show loading while checking auth - return nothing (silent load)
  if (authLoading) {
    return null;
  }

  // Show login if not authenticated (includes LoginFlow with role selection)
  if (!isAuthenticated) {
    return (
      <div className="app app-login">
        <LoginFlow onLoginSuccess={handleLoginSuccess} />
      </div>
    );
  }

  // Check if we're in the orb window or secondary window based on hash
  const isOrbWindow = !window.location.hash || window.location.hash === '#/';

  // If this is the orb window, show Arc Reactor only (but hide when Mission Control is open)
  if (isOrbWindow) {
    return (
      <div className="app app-collapsed">
        {showOrb && (
          <ArcReactor
            isCollapsed={true}
            onNavigate={handleArcReactorNavigate}
          />
        )}
      </div>
    );
  }

  // If this is the secondary window, show the main UI (no orb, no tab bar, no navigation - using native window frame)
  return (
    <div className="app app-secondary">
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
          <Route path="/team-chat" element={<TeamChat user={currentUser} />} />
          <Route path="/settings" element={<Settings user={currentUser} />} />
          <Route path="/diagnostic-microsoft" element={<DiagnosticMicrosoft />} />
        </Routes>
      </div>
    </div>
  );
}

export default App;


