import { useState, useRef, useEffect } from 'react';
import useWidgetData from '../../hooks/useWidgetData';
import './Widget.css';

/**
 * Widget - Smart draggable widget that can be a note or specialized component
 * Supports slash commands:
 * - /track metrics from [source] - Create a metric tracker widget
 * - /notify [topic] - Create a notification space
 * - Regular text - Simple note widget
 * 
 * @param {Object} widget - Widget data with id, x, y, content, type, color
 * @param {Function} onUpdate - Callback when widget is updated
 * @param {Function} onDelete - Callback when widget is deleted
 */
export default function Widget({ widget, onUpdate, onDelete }) {
  const { data, loading, error, refresh } = useWidgetData(widget);
  const [isDragging, setIsDragging] = useState(false);
  const [isEditing, setIsEditing] = useState(!widget.content);
  const [tempContent, setTempContent] = useState(widget.content || '');
  const [dragStartPos, setDragStartPos] = useState(null);
  const dragOffset = useRef({ x: 0, y: 0 });
  const widgetRef = useRef(null);
  const hasDragged = useRef(false);

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (isDragging && dragStartPos) {
        hasDragged.current = true;
        
        const newX = e.clientX - dragOffset.current.x;
        const newY = e.clientY - dragOffset.current.y;
        
        // Constrain to viewport bounds with padding
        const padding = 20;
        const maxX = window.innerWidth - widgetRef.current?.offsetWidth - padding;
        const maxY = window.innerHeight - widgetRef.current?.offsetHeight - padding;
        
        const constrainedX = Math.max(padding, Math.min(newX, maxX));
        const constrainedY = Math.max(padding, Math.min(newY, maxY));
        
        onUpdate(widget.id, { x: constrainedX, y: constrainedY });
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setDragStartPos(null);
      
      // Reset drag flag after a short delay to prevent accidental clicks
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
  }, [isDragging, dragStartPos, widget.id, onUpdate]);

  const handleMouseDown = (e) => {
    // Only start drag from header, but not from delete button
    if (e.target.closest('.widget-header') && !e.target.closest('.widget-delete')) {
      e.preventDefault();
      setIsDragging(true);
      setDragStartPos({ x: e.clientX, y: e.clientY });
      dragOffset.current = {
        x: e.clientX - widget.x,
        y: e.clientY - widget.y
      };
    }
  };

  const parseSlashCommand = (content) => {
    if (!content.startsWith('/')) return null;

    const trimmed = content.trim();
    
    // /track metrics from [source]
    if (trimmed.startsWith('/track')) {
      const match = trimmed.match(/\/track\s+(.+?)\s+from\s+(.+)/i);
      if (match) {
        return {
          type: 'tracker',
          target: match[1].trim(),
          source: match[2].trim()
        };
      }
    }
    
    // /notify [topic]
    if (trimmed.startsWith('/notify')) {
      const match = trimmed.match(/\/notify\s+(.+)/i);
      if (match) {
        return {
          type: 'notifier',
          topic: match[1].trim()
        };
      }
    }

    return null;
  };

  const handleContentChange = (e) => {
    setTempContent(e.target.value);
  };

  const handleSave = (e) => {
    e?.stopPropagation();
    const command = parseSlashCommand(tempContent);
    
    if (command) {
      // Transform widget based on slash command
      onUpdate(widget.id, { 
        content: tempContent,
        type: command.type,
        metadata: command
      });
    } else {
      // Regular note
      onUpdate(widget.id, { 
        content: tempContent,
        type: 'note'
      });
    }
    setIsEditing(false);
  };

  const handleCancel = (e) => {
    e?.stopPropagation();
    setTempContent(widget.content || '');
    setIsEditing(false);
  };

  const handleTextClick = (e) => {
    // Prevent editing if we just dragged
    if (hasDragged.current || isDragging) {
      return;
    }
    
    e.stopPropagation();
    setTempContent(widget.content || '');
    setIsEditing(true);
  };

  const renderWidgetContent = () => {
    // If editing, show textarea with save/cancel buttons
    if (isEditing) {
      return (
        <div className="widget-editor" onClick={(e) => e.stopPropagation()}>
          <textarea
            value={tempContent}
            onChange={handleContentChange}
            onClick={(e) => e.stopPropagation()}
            placeholder="Type a note or use /track or /notify commands..."
            autoFocus
          />
          <div className="widget-actions">
            <button className="widget-save-btn" onClick={handleSave}>
              Save
            </button>
            <button className="widget-cancel-btn" onClick={handleCancel}>
              Cancel
            </button>
          </div>
        </div>
      );
    }

    // Render based on widget type
    switch (widget.type) {
      case 'tracker':
        return (
          <div className="widget-tracker" onClick={handleTextClick}>
            <div className="tracker-header">
              <span className="tracker-label">Tracking</span>
              <span className="tracker-target">{widget.metadata?.target}</span>
            </div>
            <div className="tracker-source">from {widget.metadata?.source}</div>
            
            {loading && (
              <div className="tracker-loading">
                <div className="mini-spinner"></div>
                <span>Loading...</span>
              </div>
            )}
            
            {error && (
              <div className="tracker-error">
                <span>⚠️ {error}</span>
              </div>
            )}
            
            {!loading && !error && data && (
              <>
                <div className="tracker-count">
                  <span className="count-badge">{data.count}</span>
                  <span>items found</span>
                </div>
                
                {data.items && data.items.length > 0 && (
                  <div className="tracker-items">
                    {data.items.slice(0, 3).map((item, idx) => (
                      <div key={idx} className="tracker-item">
                        <div className="item-title">{item.key || item.name || item.title || item.summary}</div>
                        <div className="item-meta">
                          {item.status && <span className="item-status">{item.status}</span>}
                          {item.from && <span className="item-from">from {item.from}</span>}
                        </div>
                      </div>
                    ))}
                    {data.items.length > 3 && (
                      <div className="tracker-more">+{data.items.length - 3} more</div>
                    )}
                  </div>
                )}
                
                <button 
                  className="tracker-refresh"
                  onClick={(e) => {
                    e.stopPropagation();
                    refresh();
                  }}
                  title="Refresh data"
                >
                  ↻
                </button>
              </>
            )}
          </div>
        );

      case 'notifier':
        return (
          <div className="widget-notifier" onClick={handleTextClick}>
            <div className="notifier-header">
              <span className="notifier-label">Notifications</span>
            </div>
            <div className="notifier-topic">{widget.metadata?.topic}</div>
            
            {loading && (
              <div className="notifier-loading">
                <div className="mini-spinner"></div>
              </div>
            )}
            
            {error && (
              <div className="notifier-error">
                <span>⚠️ {error}</span>
              </div>
            )}
            
            {!loading && !error && data && (
              <>
                <div className="notifier-count">
                  <span className={`notification-badge ${data.count > 0 ? 'has-items' : ''}`}>
                    {data.count}
                  </span>
                  <span>new items</span>
                </div>
                
                {data.items && data.items.length > 0 && (
                  <div className="notifier-items">
                    {data.items.slice(0, 3).map((item, idx) => (
                      <div key={item.id || idx} className="notifier-item">
                        <div className="notifier-item-header">
                          <span className="source-tag">{item.source}</span>
                          {item.from && <span className="item-from-small">{item.from}</span>}
                        </div>
                        <div className="item-title">{item.title}</div>
                        {item.status && <div className="item-status-small">{item.status}</div>}
                      </div>
                    ))}
                    {data.items.length > 3 && (
                      <div className="notifier-more">+{data.items.length - 3} more</div>
                    )}
                  </div>
                )}
                
                <button 
                  className="notifier-refresh"
                  onClick={(e) => {
                    e.stopPropagation();
                    refresh();
                  }}
                  title="Refresh notifications"
                >
                  ↻
                </button>
              </>
            )}
          </div>
        );

      default:
        // Regular note
        return (
          <div 
            className="widget-note-text"
            onClick={handleTextClick}
          >
            {widget.content || 'Click to edit...'}
          </div>
        );
    }
  };

  const getWidgetLabel = () => {
    switch (widget.type) {
      case 'tracker':
        return 'Tracker';
      case 'notifier':
        return 'Notifier';
      default:
        return 'Note';
    }
  };

  const getSourceBadge = () => {
    const source = widget.source || widget.metadata?.source;
    if (!source) return null;
    
    const sourceMap = {
      jira: { color: '#0052CC', label: 'JIRA' },
      slack: { color: '#4A154B', label: 'Slack' },
      email: { color: '#EA4335', label: 'Email' },
      github: { color: '#24292e', label: 'GitHub' },
      tasks: { color: '#10b981', label: 'Tasks' }
    };
    return sourceMap[source.toLowerCase()] || null;
  };

  const sourceBadge = getSourceBadge();

  return (
    <div
      ref={widgetRef}
      className={`widget widget-${widget.type || 'note'} ${isDragging ? 'dragging' : ''}`}
      style={{
        left: `${widget.x}px`,
        top: `${widget.y}px`,
        backgroundColor: widget.color
      }}
      onMouseDown={handleMouseDown}
    >
      <div className="widget-header">
        <span className="widget-type-label">{getWidgetLabel()}</span>
        <div className="widget-header-right">
          {sourceBadge && (
            <span 
              className="widget-source-badge" 
              style={{ backgroundColor: sourceBadge.color }}
              title={`Data from ${sourceBadge.label}`}
            >
              {sourceBadge.label}
            </span>
          )}
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
      </div>
      
      <div className="widget-content">
        {renderWidgetContent()}
      </div>

      <div className="widget-timestamp">
        {new Date(widget.createdAt).toLocaleDateString()}
      </div>
    </div>
  );
}

