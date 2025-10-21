import './ActionItem.css';

/**
 * ActionItem Component
 * Displays a single task card with minimal luxury aesthetic
 */
export default function ActionItem({ task, index, onToggle, onDelete, onUpdate, onChat }) {

  // Extract task data
  const {
    id,
    title = task.session_title || task.title,
    status = task.is_completed ? 'completed' : 'todo',
    priority = task.workflow_metadata?.priority || task.priority || 'medium',
    source = task.external_source || 'slack',
    work_type = task.workflow_metadata?.work_type || task.work_type || 'task',
    assignee = task.workflow_metadata?.assignee,
    assignedBy = task.workflow_metadata?.assignedBy,
    created_at = task.started_at || task.created_at,
    progress = status === 'completed' ? 100 : status === 'in_progress' ? 83 : 0
  } = task;

  // Format date
  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  // Get priority color
  const getPriorityColor = () => {
    const colors = {
      urgent: '#FF3B30',
      high: '#FF9F0A',
      medium: '#007AFF',
      low: '#8E8E93'
    };
    return colors[priority] || colors.medium;
  };

  // Get status label
  const getStatusLabel = () => {
    const labels = {
      todo: 'To Do',
      in_progress: 'In Progress',
      completed: 'Completed'
    };
    return labels[status] || 'To Do';
  };

  // Get work type icon and color
  const getWorkTypeDisplay = () => {
    const workTypes = {
      calendar: {
        icon: '📅',
        label: 'Calendar',
        color: '#34C759',
        bgColor: 'rgba(52, 199, 89, 0.1)'
      },
      email: {
        icon: '📧',
        label: 'Email',
        color: '#5AC8FA',
        bgColor: 'rgba(90, 200, 250, 0.1)'
      },
      outreach: {
        icon: '📤',
        label: 'Outreach',
        color: '#AF52DE',
        bgColor: 'rgba(175, 82, 222, 0.1)'
      }
    };
    return workTypes[work_type] || null;
  };

  const workTypeDisplay = getWorkTypeDisplay();

  // Handle card click - open chat
  const handleCardClick = (e) => {
    // Don't trigger if clicking on checkbox
    if (e.target.closest('.task-checkbox')) return;
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

  return (
    <div
      className={`action-item ${status === 'completed' ? 'completed' : ''} priority-${priority}`}
      onClick={handleCardClick}
    >
      {/* Priority Badge - Top Right */}
      <div className={`action-priority-badge priority-${priority}`}>
        {priority.charAt(0).toUpperCase() + priority.slice(1)}
      </div>

      {/* Work Type Badge - Special tasks (Calendar/Email) */}
      {workTypeDisplay && (
        <div 
          className="action-work-type-badge"
          style={{ 
            backgroundColor: workTypeDisplay.bgColor,
            color: workTypeDisplay.color,
            border: `1px solid ${workTypeDisplay.color}40`
          }}
          title={workTypeDisplay.label}
        >
          <span className="work-type-icon">{workTypeDisplay.icon}</span>
          <span className="work-type-label">{workTypeDisplay.label}</span>
        </div>
      )}

      {/* Header with Slack Logo and Title */}
      <div className="action-item-header">
        {/* Slack Logo Icon */}
        <div className="action-app-icon">
          <img 
            src="/Slack_icon_2019.svg.png" 
            alt="Slack" 
            style={{ width: '24px', height: '24px', objectFit: 'contain' }}
          />
        </div>

        {/* Task Title */}
        <div className="action-title">{title}</div>
      </div>

      {/* Progress Bar */}
      <div className="action-progress-container">
        <div className="action-progress-bar">
          <div 
            className="action-progress-fill"
            style={{ width: `${progress}%` }}
          ></div>
        </div>
        <div className="action-progress-text">{progress}%</div>
      </div>

      {/* Footer with Metadata and Status */}
      <div className="action-footer">
        <div className="action-footer-left">
          {assignedBy && (
            <div className="meta-item assignee">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                <circle cx="12" cy="7" r="4"></circle>
              </svg>
              {assignedBy}
            </div>
          )}
          {created_at && (
            <div className="meta-item date">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <polyline points="12 6 12 12 16 14"></polyline>
              </svg>
              {formatDate(created_at)}
            </div>
          )}
        </div>

        {/* Status Badge - Bottom Right */}
        <div className={`action-status-badge status-${status}`}>
          <div className="status-indicator"></div>
          {getStatusLabel()}
        </div>
      </div>
    </div>
  );
}
