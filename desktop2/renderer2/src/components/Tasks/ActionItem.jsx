import './ActionItem.css';
import { useState } from 'react';

/**
 * ActionItem Component - Modern Task Card with Checklists
 * Displays task with progress, metadata, checklists, and action buttons
 */
export default function ActionItem({ task, index, onToggle, onDelete, onUpdate, onChat }) {

  const [showActions, setShowActions] = useState(false);

  // Extract task data
  const {
    id,
    title = task.session_title || task.title,
    status = task.is_completed ? 'completed' : 'todo',
    priority = task.workflow_metadata?.priority || task.priority || 'medium',
    source = task.external_source || 'slack',
    work_type = task.workflow_metadata?.work_type || task.work_type || 'task',
    progress = status === 'completed' ? 100 : status === 'in_progress' ? 65 : 0,
    external_key = task.external_key || task.key || '',
    category = task.category || 'Development',
    subtasks = task.subtasks || [],
    tags = task.tags || [],
    user = task.user || {} // Added user property
  } = task;

  // Get status label and time estimate
  const getStatusLabel = () => {
    const labels = {
      'todo': 'Today',
      'in_progress': 'This Week',
      'completed': 'Completed'
    };
    return labels[status] || 'Anytime';
  };

  // Get source display (Slack or JIRA)
  const getSourceDisplay = () => {
    const sources = {
      slack: {
        icon: '/Slack_icon_2019.svg.png',
        label: 'Slack'
      },
      jira: {
        icon: '/JIRALOGO.png',
        label: 'Jira'
      }
    };
    return sources[source] || sources.slack;
  };

  // Get priority color
  const getPriorityColor = () => {
    const colors = {
      urgent: '#ef4444',
      high: '#f97316',
      medium: '#eab308',
      low: '#3b82f6'
    };
    return colors[priority] || '#3b82f6';
  };

  const sourceDisplay = getSourceDisplay();

  // Handle card click - open chat
  const handleCardClick = (e) => {
    if (e.target.closest('.action-checkbox') || e.target.closest('.action-button')) return;
    if (onChat) {
      onChat(task);
    }
  };

  // Handle checkbox toggle
  const handleToggle = (e) => {
    e.stopPropagation();
    if (onToggle) {
      onToggle(id, status);
    }
  };

  // Handle subtask toggle
  const handleSubtaskToggle = (e, subtaskIndex) => {
    e.stopPropagation();
    // Update subtask completion state
    if (onUpdate) {
      const updatedSubtasks = [...subtasks];
      updatedSubtasks[subtaskIndex] = {
        ...updatedSubtasks[subtaskIndex],
        completed: !updatedSubtasks[subtaskIndex].completed
      };
      onUpdate(id, { subtasks: updatedSubtasks });
    }
  };

  // Handle mark done
  const handleMarkDone = (e) => {
    e.stopPropagation();
    if (onToggle) {
      onToggle(id, 'completed');
    }
  };

  // Handle edit
  const handleEdit = (e) => {
    e.stopPropagation();
    // Placeholder for edit functionality
    console.log('Edit task:', id);
  };

  // Handle archive
  const handleArchive = (e) => {
    e.stopPropagation();
    if (onDelete) {
      onDelete(id);
    }
  };

  return (
    <div
      className={`action-item-clean ${status === 'completed' ? 'completed' : ''}`}
      onClick={handleCardClick}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      {/* Top Row - Logo + Full Width Title */}
      <div className="action-top-row">
        <div className="action-logo">
          {source === 'slack' ? (
            <img 
              src={sourceDisplay.icon} 
              alt="Slack" 
              className="logo-image"
            />
          ) : source === 'jira' ? (
            <img 
              src={sourceDisplay.icon}
              alt="Jira"
              className="logo-image"
              onError={(e) => e.target.style.opacity = '0.5'}
            />
          ) : null}
        </div>
        <h3 className="action-title-clean">{title}</h3>
      </div>

      {/* Bottom Row - SCRUM + Avatar + Badges on Left */}
      <div className="action-bottom-row">
        <div className="action-bottom-left-stack">
          {/* SCRUM Key - Top */}
          <div className="action-scrum-row">
            {external_key && <span className="action-scrum-key">{external_key}</span>}
          </div>
          
          {/* Avatar + Badges - Bottom */}
          <div className="action-avatar-badges-row">
            <div className="action-profile-avatar">
              {user?.name ? user.name.substring(0, 2).toUpperCase() : 'AS'}
            </div>
            <div className="action-bottom-badges">
              {work_type && <span className="action-badge">{work_type}</span>}
              {priority && <span className="action-badge priority-badge">{priority}</span>}
            </div>
          </div>
        </div>
      </div>

      {/* Mark Done Button - Bottom Right Corner */}
      <button className="action-button-mark-done" onClick={(e) => { e.stopPropagation(); handleToggle(); }}>
        Mark Done
      </button>

      {/* Progress Bar */}
      {progress > 0 && (
        <div className="action-progress-section">
          <span className="action-progress-label" style={{ color: getPriorityColor() }}>
            {getStatusLabel()}
          </span>
          <div className="action-progress-bar-container">
            <div 
              className="action-progress-bar"
              style={{ width: `${progress}%`, backgroundColor: getPriorityColor() }}
            />
          </div>
          <span className="action-progress-percentage">{progress}%</span>
        </div>
      )}

      {/* Subtasks/Checklist */}
      {subtasks && subtasks.length > 0 && (
        <div className="action-checklist">
          {subtasks.map((subtask, idx) => (
            <label key={idx} className={`checklist-item ${subtask.completed ? 'completed' : ''}`}>
              <input
                type="checkbox"
                className="checklist-checkbox"
                checked={subtask.completed || false}
                onChange={(e) => handleSubtaskToggle(e, idx)}
              />
              <span className="checklist-text">{subtask.title || subtask.text}</span>
            </label>
          ))}
        </div>
      )}

      {/* Completed Checkmark */}
      {status === 'completed' && (
        <div className="action-completed-check">✓</div>
      )}
    </div>
  );
}
