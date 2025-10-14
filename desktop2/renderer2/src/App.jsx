import { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import Copilot from './pages/Copilot';
import Tasks from './pages/Tasks';
import Navigation from './components/common/Navigation';
import ArcReactor from './components/ArcReactor/ArcReactor';

function App() {
  const navigate = useNavigate();
  const [isCollapsed, setIsCollapsed] = useState(true); // Start collapsed (Arc Reactor only)
  const [systemStatus, setSystemStatus] = useState(null);
  const [initialChatMessage, setInitialChatMessage] = useState(null);

  useEffect(() => {
    initializeApp();
  }, []);

  // Force mouse forwarding state based on collapsed state
  useEffect(() => {
    if (window.electronAPI?.window?.setMouseForward) {
      const shouldForward = isCollapsed; // Only forward in collapsed mode
      window.electronAPI.window.setMouseForward(shouldForward);
      console.log(`🖱️ Mouse forwarding ${shouldForward ? 'ENABLED' : 'DISABLED'} (${isCollapsed ? 'collapsed' : 'expanded'} mode)`);
    }
  }, [isCollapsed]);

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
    
    // Navigate based on item ID
    const routeMap = {
      'chat': '/copilot',
      'tasks': '/tasks',
      'code': '/copilot', // Could be a new route
      'github': '/copilot', // Could be a new route
      'crm': '/copilot', // Could be a new route
      'deals': '/tasks' // Could be a new route
    };
    
    const targetRoute = routeMap[itemId] || '/copilot';
    navigate(targetRoute);
  };

  // If collapsed, show only Arc Reactor
  if (isCollapsed) {
    return (
      <div className="app app-collapsed">
        <ArcReactor
          isCollapsed={true}
          onNavigate={handleArcReactorNavigate}
        />
      </div>
    );
  }

  return (
    <div className="app">
      <Navigation onMinimize={handleMinimizeToHeader} />
      <div className="app-content">
        <Routes>
          <Route path="/" element={<Navigate to="/copilot" replace />} />
          <Route path="/copilot" element={<Copilot systemStatus={systemStatus} initialMessage={initialChatMessage} />} />
          <Route path="/tasks" element={<Tasks />} />
        </Routes>
      </div>
      
      {/* Arc Reactor is always present, even when expanded */}
      <ArcReactor
        isCollapsed={false}
        onNavigate={handleArcReactorNavigate}
      />
    </div>
  );
}

export default App;


