import { useState, useRef, useEffect } from 'react';
import useWidgetData from '../../hooks/useWidgetData';
import './Widget.css';

/**
 * Widget - Draggable widget component for dashboard
 * Supports 9 widget types with configuration
 */
export default function Widget({ widget, onUpdate, onDelete }) {
  const { data, loading, error, refresh } = useWidgetData(widget);
  const [isDragging, setIsDragging] = useState(false);
  const [isConfiguring, setIsConfiguring] = useState(!widget.config || Object.keys(widget.config).length === 0);
  const [configValue, setConfigValue] = useState('');
  const dragOffset = useRef({ x: 0, y: 0 });
  const widgetRef = useRef(null);
  const hasDragged = useRef(false);

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (isDragging) {
        hasDragged.current = true;
        const newX = e.clientX - dragOffset.current.x;
        const newY = e.clientY - dragOffset.current.y;
        onUpdate(widget.id, { x: newX, y: newY });
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setTimeout(() => {
        hasDragged.current = false;
      }, 100);
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, widget.id, onUpdate]);

  const handleMouseDown = (e) => {
    if (e.target.closest('.widget-header') && !e.target.closest('.widget-delete')) {
      e.preventDefault();
      setIsDragging(true);
      dragOffset.current = {
        x: e.clientX - widget.x,
        y: e.clientY - widget.y
      };
    }
  };

  const handleConfigSave = () => {
    if (!configValue.trim()) return;
    
    const config = {};
    switch (widget.type) {
      case 'jira-by-team':
        config.team = configValue.trim();
        break;
      case 'jira-by-unit':
        config.unit = configValue.trim();
        break;
      case 'jira-by-person':
        config.person = configValue.trim();
        break;
      case 'jira-by-feature':
        config.feature = configValue.trim();
        break;
      case 'feature-progress':
        config.repo = configValue.trim();
        break;
      case 'slack-messages':
        config.handle = configValue.trim();
        break;
      case 'teams-messages':
        config.handle = configValue.trim();
        break;
      case 'email-tracker':
        config.email = configValue.trim();
        break;
      default:
        break;
    }
    
    onUpdate(widget.id, { config });
    setIsConfiguring(false);
  };

  const handleContentClick = (e) => {
    if (hasDragged.current || isDragging) return;
    e.stopPropagation();
    if (widget.type === 'quick-note') {
      setIsConfiguring(true);
    }
  };

  const handleNoteChange = (e) => {
    setConfigValue(e.target.value);
  };

  const handleNoteSave = () => {
    onUpdate(widget.id, { config: { content: configValue } });
    setIsConfiguring(false);
  };

  const getWidgetInfo = () => {
    const info = {
      'quick-note': { icon: '📝', label: 'Quick Note' },
      'jira-by-team': { icon: '👥', label: 'JIRA by Team' },
      'jira-by-unit': { icon: '🏢', label: 'JIRA by Unit' },
      'jira-by-person': { icon: '👤', label: 'JIRA by Person' },
      'jira-by-feature': { icon: '🎯', label: 'JIRA by Feature' },
      'feature-progress': { icon: '💻', label: 'Feature Progress' },
      'slack-messages': { icon: '💬', label: 'Slack Messages' },
      'teams-messages': { icon: '📢', label: 'Teams Messages' },
      'email-tracker': { icon: '📧', label: 'Email Tracker' }
    };
    return info[widget.type] || { icon: '📝', label: 'Widget' };
  };

  const getConfigPlaceholder = () => {
    const placeholders = {
      'jira-by-team': 'Enter team name...',
      'jira-by-unit': 'Enter unit name...',
      'jira-by-person': 'Enter person name...',
      'jira-by-feature': 'Enter feature/epic name...',
      'feature-progress': 'Enter repository name...',
      'slack-messages': 'Enter Slack handle (e.g., @username)...',
      'teams-messages': 'Enter Teams handle...',
      'email-tracker': 'Enter email address...',
      'quick-note': 'Type your note...'
    };
    return placeholders[widget.type] || 'Enter configuration...';
  };

  const renderContent = () => {
    // Configuration UI
    if (isConfiguring) {
      return (
        <div className="widget-config" onClick={(e) => e.stopPropagation()}>
          <textarea
            value={configValue}
            onChange={widget.type === 'quick-note' ? handleNoteChange : (e) => setConfigValue(e.target.value)}
            placeholder={getConfigPlaceholder()}
            autoFocus
            onClick={(e) => e.stopPropagation()}
          />
          <button 
            className="widget-config-save"
            onClick={widget.type === 'quick-note' ? handleNoteSave : handleConfigSave}
          >
            Save
          </button>
        </div>
      );
    }

    // Quick Note display
    if (widget.type === 'quick-note') {
      return (
        <div className="widget-note-content" onClick={handleContentClick}>
          {widget.config?.content || 'Click to edit...'}
        </div>
      );
    }

    // Data widgets
    if (loading) {
      return (
        <div className="widget-loading">
          <div className="widget-spinner"></div>
          <span>Loading...</span>
        </div>
      );
    }

    if (error) {
      return (
        <div className="widget-error">
          <span>⚠️ {error}</span>
          <button className="widget-retry" onClick={refresh}>Retry</button>
        </div>
      );
    }

    if (data) {
      return (
        <div className="widget-data">
          <div className="widget-data-header">
            <span className="widget-count">{data.count || 0}</span>
            <span className="widget-count-label">items</span>
          </div>
          
          {data.items && data.items.length > 0 && (
            <div className="widget-items">
              {data.items.slice(0, 3).map((item, idx) => (
                <div key={idx} className="widget-item">
                  <div className="widget-item-title">
                    {item.key || item.title || item.summary || item.subject || 'Item'}
                  </div>
                  {item.status && (
                    <div className="widget-item-status">{item.status}</div>
                  )}
                </div>
              ))}
              {data.items.length > 3 && (
                <div className="widget-more">+{data.items.length - 3} more</div>
              )}
            </div>
          )}
          
          <button 
            className="widget-refresh"
            onClick={(e) => {
              e.stopPropagation();
              refresh();
            }}
            title="Refresh data"
          >
            ↻
          </button>
        </div>
      );
    }

    return null;
  };

  const widgetInfo = getWidgetInfo();

  return (
    <div
      ref={widgetRef}
      className={`widget widget-${widget.type} ${isDragging ? 'dragging' : ''}`}
      style={{
        left: `${widget.x}px`,
        top: `${widget.y}px`,
        backgroundColor: widget.color
      }}
      onMouseDown={handleMouseDown}
    >
      <div className="widget-header">
        <span className="widget-icon">{widgetInfo.icon}</span>
        <span className="widget-label">{widgetInfo.label}</span>
        <button 
          className="widget-delete"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(widget.id);
          }}
          onMouseDown={(e) => e.stopPropagation()}
          title="Delete widget"
        >
          ×
        </button>
      </div>
      
      <div className="widget-content">
        {renderContent()}
      </div>

      {widget.config && Object.keys(widget.config).length > 0 && widget.type !== 'quick-note' && (
        <div className="widget-config-display">
          {widget.config.team || widget.config.unit || widget.config.person || 
           widget.config.feature || widget.config.repo || widget.config.handle || 
           widget.config.email}
        </div>
      )}

      <div className="widget-timestamp">
        {new Date(widget.createdAt).toLocaleDateString()}
      </div>
    </div>
  );
}
