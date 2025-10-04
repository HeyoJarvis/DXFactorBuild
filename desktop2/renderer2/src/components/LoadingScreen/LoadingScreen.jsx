import { useState, useEffect } from 'react';
import TypingAnimation from './TypingAnimation';
import JarvisHeader from '../JarvisHeader/JarvisHeader';
import './LoadingScreen.css';

export default function LoadingScreen({ onComplete, onChatSubmit, startWithHeader = false, minimized = false }) {
  const [currentStage, setCurrentStage] = useState(startWithHeader ? 'header' : 'typing'); // 'typing', 'header', 'complete'

  const handleTypingComplete = () => {
    setCurrentStage('header');
  };

  const handleEnterMainSystem = async (chatMessage = null) => {
    if (chatMessage) {
      // If there's a chat message, expand window first, then transition immediately
      console.log('🔄 Expanding window for chat message:', chatMessage);
      
      // Expand window to full chat interface
      if (window.electronAPI) {
        try {
          await window.electronAPI.window.expandCopilot();
          console.log('✅ Window expanded for chat');
        } catch (error) {
          console.error('❌ Failed to expand window:', error);
        }
      }
      
      // Immediately transition to main app for chat
      setCurrentStage('complete');
      onComplete?.(chatMessage);
    } else {
      // For non-chat transitions, use the normal flow
      setCurrentStage('complete');
      setTimeout(() => {
        onComplete?.(chatMessage);
      }, 300);
    }
  };

  if (currentStage === 'typing') {
    return <TypingAnimation onComplete={handleTypingComplete} />;
  }

  if (currentStage === 'header') {
    return <JarvisHeader onEnterMainSystem={handleEnterMainSystem} minimized={minimized} />;
  }

  // Fade out stage
  return (
    <div className={`loading-screen fade-out ${minimized ? 'minimized' : ''}`}>
      <div className="loading-content">
        <div className="loading-logo">✨</div>
        <div className="loading-text">Launching...</div>
      </div>
    </div>
  );
}

