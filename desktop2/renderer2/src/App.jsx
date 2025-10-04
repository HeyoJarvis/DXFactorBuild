import { useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Copilot from './pages/Copilot';
import Tasks from './pages/Tasks';
import LoadingScreen from './components/LoadingScreen/LoadingScreen';
import Navigation from './components/common/Navigation';
import JarvisHeader from './components/JarvisHeader/JarvisHeader';

function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [showHeaderMode, setShowHeaderMode] = useState(false);
  const [systemStatus, setSystemStatus] = useState(null);
  const [initialChatMessage, setInitialChatMessage] = useState(null);

  useEffect(() => {
    initializeApp();
  }, []);

  async function initializeApp() {
    try {
      console.log('🚀 App initialization started');
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

      console.log('✅ App initialization complete - waiting for user interaction');
    } catch (error) {
      console.error('❌ App initialization error:', error);
      setIsLoading(false);
    }
  }

  const handleLoadingComplete = async (chatMessage = null) => {
    if (chatMessage) {
      // User submitted a chat message, set initial message
      setInitialChatMessage(chatMessage);
      console.log('💬 Setting initial chat message:', chatMessage);
    }
    
    setIsLoading(false);
  };

  const handleMinimizeToHeader = async () => {
    console.log('🔽 Minimizing to JarvisHeader...');
    
    // Collapse window first
    if (window.electronAPI) {
      try {
        await window.electronAPI.window.collapseCopilot();
        console.log('✅ Window collapsed');
      } catch (error) {
        console.error('❌ Failed to collapse window:', error);
      }
    }
    
    // Then switch to header mode
    setShowHeaderMode(true);
    setInitialChatMessage(null); // Clear any previous message
  };

  const handleHeaderToFullSystem = async (chatMessage = null) => {
    console.log('🔼 Expanding from header to full system...');
    
    // Expand window first
    if (window.electronAPI) {
      try {
        await window.electronAPI.window.expandCopilot();
        console.log('✅ Window expanded');
      } catch (error) {
        console.error('❌ Failed to expand window:', error);
      }
    }
    
    // Set initial message if provided (this will be handled by Copilot component)
    if (chatMessage) {
      setInitialChatMessage(chatMessage);
    } else {
      // Clear any previous message to prevent duplicates
      setInitialChatMessage(null);
    }
    
    // Switch to full system mode
    setShowHeaderMode(false);
  };

  if (isLoading) {
    return <LoadingScreen onComplete={handleLoadingComplete} />;
  }

  if (showHeaderMode) {
    return <JarvisHeader onEnterMainSystem={handleHeaderToFullSystem} minimized={true} />;
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
    </div>
  );
}

export default App;

