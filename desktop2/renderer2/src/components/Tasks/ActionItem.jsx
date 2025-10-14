import { useState } from 'react';
import './ActionItem.css';

/**
 * ActionItem Component
 * Modern, elegant task card with progress indicator, app icons, and badges
 * Inspired by Apple's design language
 */
export default function ActionItem({ task, onToggle, onDelete, onUpdate, onChat }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(task.title);

  const handleSave = () => {
    if (editText.trim() && editText !== task.title) {
      onUpdate(task.id, { title: editText.trim() });
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      setEditText(task.title);
      setIsEditing(false);
    }
  };

  // Calculate progress percentage based on status
  const getProgress = () => {
    switch (task.status) {
      case 'completed':
        return 100;
      case 'in_progress':
        return task.progress || 83; // Default to 83% if not specified
      case 'todo':
        return 0;
      default:
        return task.progress || 0;
    }
  };

  // Get app icon based on task source or type
  const getAppIcon = () => {
    // If task has a source, show appropriate icon
    if (task.source) {
      const sourceIcons = {
        'slack': '💬',
        'teams': '🎯',
        'email': '📧',
        'jira': '📋',
        'github': '🔧',
        'calendar': '📅',
        'crm': '💼',
        'manual': '✏️'
      };
      return sourceIcons[task.source.toLowerCase()] || '✓';
    }
    
    // Check tags for additional context
    if (task.tags && task.tags.length > 0) {
      if (task.tags.includes('slack-auto')) return '💬';
      if (task.tags.includes('teams-auto')) return '🎯';
      if (task.tags.includes('email-auto')) return '📧';
      if (task.tags.includes('jira-auto')) return '📋';
    }
    
    // Fallback based on priority or default
    return '✓';
  };

  // Get background gradient for app icon based on source
  const getIconBackground = () => {
    if (!task.source) return 'linear-gradient(135deg, rgba(255, 255, 255, 0.12), rgba(255, 255, 255, 0.06))';
    
    const gradients = {
      'slack': 'linear-gradient(135deg, rgba(74, 21, 75, 0.5), rgba(224, 30, 90, 0.5))',
      'teams': 'linear-gradient(135deg, rgba(99, 91, 229, 0.5), rgba(67, 56, 202, 0.5))',
      'email': 'linear-gradient(135deg, rgba(59, 130, 246, 0.5), rgba(37, 99, 235, 0.5))',
      'jira': 'linear-gradient(135deg, rgba(0, 82, 204, 0.5), rgba(0, 101, 255, 0.5))',
      'github': 'linear-gradient(135deg, rgba(31, 41, 55, 0.5), rgba(17, 24, 39, 0.5))',
      'crm': 'linear-gradient(135deg, rgba(251, 146, 60, 0.5), rgba(249, 115, 22, 0.5))',
      'manual': 'linear-gradient(135deg, rgba(168, 85, 247, 0.5), rgba(147, 51, 234, 0.5))'
    };
    
    return gradients[task.source.toLowerCase()] || 'linear-gradient(135deg, rgba(255, 255, 255, 0.12), rgba(255, 255, 255, 0.06))';
  };

  // Get priority display text
  const getPriorityLabel = () => {
    const labels = {
      'urgent': 'Urgent',
      'high': 'High',
      'medium': 'Medium',
      'low': 'Low'
    };
    return labels[task.priority] || 'Medium';
  };

  // Get notification count (if task has related items)
  const getNotificationCount = () => {
    return task.relatedCount || task.notificationCount || 0;
  };

  const progress = getProgress();
  const notificationCount = getNotificationCount();

  return (
    <div className={`action-item ${task.status} priority-${task.priority || 'medium'}`}>
      <div className="action-item-content">
        {/* App Icon */}
        <div 
          className="action-app-icon"
          style={{ background: getIconBackground() }}
        >
          <span>{getAppIcon()}</span>
        </div>

        {/* Main Content */}
        <div className="action-main">
          {isEditing ? (
            <input
              className="action-edit-input"
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              onBlur={handleSave}
              onKeyDown={handleKeyDown}
              autoFocus
            />
          ) : (
            <div 
              className="action-title"
              onDoubleClick={() => setIsEditing(true)}
            >
              {task.title}
            </div>
          )}

          {/* Progress Bar */}
          <div className="action-progress-container">
            <div className="action-progress-bar">
              <div 
                className="action-progress-fill"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="action-progress-text">{progress}%</div>
          </div>
        </div>

        {/* Right Side Actions */}
        <div className="action-right">
          {/* Notification Badge */}
          {notificationCount > 0 && (
            <div className="action-notification-badge">
              +{notificationCount}
            </div>
          )}

          {/* Priority Badge */}
          <div className={`action-priority-badge priority-${task.priority || 'medium'}`}>
            {getPriorityLabel()}
          </div>

          {/* Checkbox */}
          <button 
            className="action-checkbox"
            onClick={() => onToggle(task.id, task.status)}
            title={task.status === 'completed' ? 'Mark as incomplete' : 'Mark as complete'}
          >
            {task.status === 'completed' && (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Hidden action buttons (shown on hover) */}
      <div className="action-hover-buttons">
        {onChat && (
          <button
            className="action-btn chat-btn"
            onClick={() => onChat(task)}
            title="AI Chat"
          >
            💬
          </button>
        )}
        <button
          className="action-btn delete-btn"
          onClick={() => onDelete(task.id)}
          title="Delete"
        >
          🗑️
        </button>
      </div>
    </div>
  );
}

