import { useState } from 'react';
import './JarvisHeader.css';

export default function JarvisHeader({ onEnterMainSystem, minimized = false }) {
  const [chatInput, setChatInput] = useState('');
  const [notifications] = useState(3); // Mock notification count
  const [isFactCheckActive, setIsFactCheckActive] = useState(false);

  const handleChatSubmit = (e) => {
    e.preventDefault();
    if (chatInput.trim()) {
      console.log('Chat input:', chatInput);
      const message = chatInput.trim();
      setChatInput('');
      // Pass the chat message to the main system
      onEnterMainSystem?.(message);
    }
  };

  const handleLogoClick = () => {
    onEnterMainSystem?.();
  };

  const handleNotificationClick = () => {
    console.log('Notifications clicked');
    onEnterMainSystem?.();
  };

  const handleFactCheckClick = () => {
    setIsFactCheckActive(!isFactCheckActive);
    console.log('Fact check toggled:', !isFactCheckActive);
  };

  return (
    <div className={`jarvis-header ${minimized ? 'minimized' : ''}`}>
      <div className="header-content">
        {/* Logo */}
        <div className="header-logo" onClick={handleLogoClick}>
          <div className="logo-icon">🤖</div>
          <span className="logo-text">J.A.R.V.I.S</span>
        </div>

        {/* Chat Bar */}
        <form className="header-chat" onSubmit={handleChatSubmit}>
          <input
            type="text"
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            placeholder="Chat with me..."
            className="chat-input"
          />
          <button type="submit" className="chat-submit" disabled={!chatInput.trim()}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path 
                d="M2 21L23 12L2 3V10L17 12L2 14V21Z" 
                fill="currentColor"
              />
            </svg>
          </button>
        </form>

        {/* Action Icons */}
        <div className="header-actions">
          {/* Notification Bell */}
          <button className="action-button notification-btn" onClick={handleNotificationClick}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path 
                d="M18 8A6 6 0 0 0 6 8C6 15 3 17 3 17H21C21 17 18 15 18 8Z" 
                stroke="currentColor" 
                strokeWidth="2" 
                strokeLinecap="round" 
                strokeLinejoin="round"
              />
              <path 
                d="M13.73 21A2 2 0 0 1 10.27 21" 
                stroke="currentColor" 
                strokeWidth="2" 
                strokeLinecap="round" 
                strokeLinejoin="round"
              />
            </svg>
            {notifications > 0 && (
              <span className="notification-badge">{notifications}</span>
            )}
          </button>

          {/* Fact Check Icon */}
          <button 
            className={`action-button fact-check-btn ${isFactCheckActive ? 'active' : ''}`}
            onClick={handleFactCheckClick}
            title="Fact Check Mode"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path 
                d="M9 12L11 14L15 10M21 12A9 9 0 1 1 3 12A9 9 0 0 1 21 12Z" 
                stroke="currentColor" 
                strokeWidth="2" 
                strokeLinecap="round" 
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
