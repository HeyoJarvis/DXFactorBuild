import { NavLink } from 'react-router-dom';
import { useState, useEffect } from 'react';
import './Navigation.css';

export default function Navigation({ onMinimize }) {
  const [userName, setUserName] = useState('');

  useEffect(() => {
    // Get user info from Slack or electron
    const getUserInfo = async () => {
      try {
        // Try to get from Slack first
        if (window.electronAPI?.slack?.getUserInfo) {
          const slackInfo = await window.electronAPI.slack.getUserInfo();
          if (slackInfo?.real_name) {
            const firstName = slackInfo.real_name.split(' ')[0];
            setUserName(firstName);
            return;
          }
        }
        // Fallback to electron user info
        if (window.electronAPI?.user?.getInfo) {
          const userInfo = await window.electronAPI.user.getInfo();
          const name = userInfo?.name || userInfo?.email || 'User';
          const firstName = name.split(' ')[0];
          setUserName(firstName);
        }
      } catch (error) {
        console.error('Failed to get user info:', error);
        setUserName('User');
      }
    };

    getUserInfo();
  }, []);

  const handleMinimize = () => {
    if (onMinimize) {
      onMinimize();
    }
  };

  return (
    <nav className="navigation">
      <div className="nav-brand">
        <div className="nav-logo-container">
          <img src="/Jarvis.png" alt="Jarvis" className="nav-logo-img" />
        </div>
        <div className="nav-brand-text">
          <span className="nav-title">Hey {userName || 'User'}</span>
        </div>
      </div>

      <div className="nav-controls">
        <button 
          className="nav-control-btn minimize-btn" 
          onClick={handleMinimize}
          title="Minimize"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
        </button>
      </div>
    </nav>
  );
}

