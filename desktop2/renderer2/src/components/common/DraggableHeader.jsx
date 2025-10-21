import { useState } from 'react';
import './DraggableHeader.css';

export default function DraggableHeader({ title, onMinimize, onMaximize, onClose, showControls = true }) {
  const [isMaximized, setIsMaximized] = useState(false);

  const handleMinimize = () => {
    if (onMinimize) {
      onMinimize();
    } else if (window.electronAPI?.window?.minimize) {
      window.electronAPI.window.minimize();
    }
  };

  const handleMaximize = () => {
    setIsMaximized(!isMaximized);
    if (onMaximize) {
      onMaximize();
    } else if (window.electronAPI?.window?.toggleMaximize) {
      window.electronAPI.window.toggleMaximize();
    }
  };

  const handleClose = () => {
    if (onClose) {
      onClose();
    } else if (window.close) {
      window.close();
    }
  };

  return (
    <div className="draggable-header">
      <div className="draggable-header-drag-area">
        <div className="draggable-header-title">{title || 'HeyJarvis'}</div>
      </div>
      
      {showControls && (
        <div className="draggable-header-controls">
          <button 
            className="draggable-header-btn minimize" 
            onClick={handleMinimize}
            title="Minimize"
          >
            <svg width="12" height="12" viewBox="0 0 12 12">
              <line x1="1" y1="6" x2="11" y2="6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
          
          <button 
            className="draggable-header-btn maximize" 
            onClick={handleMaximize}
            title={isMaximized ? "Restore" : "Maximize"}
          >
            {isMaximized ? (
              <svg width="12" height="12" viewBox="0 0 12 12">
                <rect x="2" y="3" width="7" height="7" fill="none" stroke="currentColor" strokeWidth="1.5"/>
                <rect x="3" y="2" width="7" height="7" fill="none" stroke="currentColor" strokeWidth="1.5"/>
              </svg>
            ) : (
              <svg width="12" height="12" viewBox="0 0 12 12">
                <rect x="2" y="2" width="8" height="8" fill="none" stroke="currentColor" strokeWidth="1.5"/>
              </svg>
            )}
          </button>
          
          <button 
            className="draggable-header-btn close" 
            onClick={handleClose}
            title="Close"
          >
            <svg width="12" height="12" viewBox="0 0 12 12">
              <line x1="2" y1="2" x2="10" y2="10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              <line x1="10" y1="2" x2="2" y2="10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}

