import React from 'react';
import './SlimHeader.css';

/**
 * SlimHeader - Minimalist header bar for Jira and Calendar pages
 * Features: Teams dropdown, Settings button, optional page title
 */
export default function SlimHeader({ onTeamsClick, onSettingsClick, title }) {
  return (
    <div className="slim-header">
      <div className="slim-header-left">
        {title && (
          <div className="header-title">
            <span className="title-text">{title}</span>
          </div>
        )}
      </div>

      <div className="slim-header-right">
        {/* Teams Button */}
        <button
          className="slim-header-btn"
          onClick={onTeamsClick}
          title="Switch teams"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
            <circle cx="9" cy="7" r="4"></circle>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
            <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
          </svg>
        </button>

        {/* Settings Button */}
        <button
          className="slim-header-btn"
          onClick={onSettingsClick}
          title="Settings"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3"></circle>
            <path d="M12 1v6m0 6v6M5.64 5.64l4.24 4.24m4.24 4.24l4.24 4.24M1 12h6m6 0h6M5.64 18.36l4.24-4.24m4.24-4.24l4.24-4.24"></path>
          </svg>
        </button>
      </div>
    </div>
  );
}
