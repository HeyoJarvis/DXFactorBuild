import { useState, useRef, useEffect } from 'react';
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
  const [isDragging, setIsDragging] = useState(false);
  const [isEditing, setIsEditing] = useState(!widget.content);
  const [tempContent, setTempContent] = useState(widget.content || '');
  const dragOffset = useRef({ x: 0, y: 0 });
  const widgetRef = useRef(null);

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (isDragging) {
        const newX = e.clientX - dragOffset.current.x;
        const newY = e.clientY - dragOffset.current.y;
        
        onUpdate(widget.id, { x: newX, y: newY });
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
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
    if (e.target.closest('.widget-header')) {
      setIsDragging(true);
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

  const handleSave = () => {
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

  const handleCancel = () => {
    setTempContent(widget.content || '');
    setIsEditing(false);
  };

  const handleTextClick = () => {
    if (!isDragging) {
      setTempContent(widget.content || '');
      setIsEditing(true);
    }
  };

  const renderWidgetContent = () => {
    // If editing, show textarea with save/cancel buttons
    if (isEditing) {
      return (
        <div className="widget-editor">
          <textarea
            value={tempContent}
            onChange={handleContentChange}
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
            <div className="tracker-status">
              <div className="status-indicator active"></div>
              <span>Monitoring...</span>
            </div>
          </div>
        );

      case 'notifier':
        return (
          <div className="widget-notifier" onClick={handleTextClick}>
            <div className="notifier-header">
              <span className="notifier-label">Notifications</span>
            </div>
            <div className="notifier-topic">{widget.metadata?.topic}</div>
            <div className="notifier-count">
              <span className="notification-badge">0</span>
              <span>new items</span>
            </div>
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
        <button 
          className="widget-delete"
          onClick={() => onDelete(widget.id)}
          title="Delete widget"
        >
          ×
        </button>
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

