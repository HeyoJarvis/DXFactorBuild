import './ActionItem.css';

/**
 * ActionItem Component - Modern, Elegant Task Card
 * Clean, minimalist design with smooth interactions
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
    progress = status === 'completed' ? 100 : status === 'in_progress' ? 65 : 0
  } = task;

  // Handle description - can be string or ADF object (from JIRA)
  const rawDescription = task.description || task.body || task.action_description || '';
  const description = typeof rawDescription === 'string' 
    ? rawDescription 
    : (rawDescription?.content ? extractTextFromADF(rawDescription) : '');

  // Extract plain text from ADF (Atlassian Document Format) object
  function extractTextFromADF(adf) {
    if (!adf || typeof adf !== 'object') return '';
    
    // If it has content array, extract text from it
    if (Array.isArray(adf.content)) {
      return adf.content
        .map(node => {
          if (node.type === 'paragraph' && Array.isArray(node.content)) {
            return node.content
              .map(textNode => textNode.text || '')
              .join('');
          }
          if (node.type === 'text') {
            return node.text || '';
          }
          // Recursively handle nested content
          if (node.content) {
            return extractTextFromADF(node);
          }
          return '';
        })
        .filter(text => text.trim())
        .join(' ');
    }
    
    return '';
  }

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

  // Get status label
  const getStatusLabel = () => {
    const labels = {
      todo: 'To Do',
      in_progress: 'In Progress',
      completed: 'Completed'
    };
    return labels[status] || 'To Do';
  };

  // Get source display (Slack or JIRA)
  const getSourceDisplay = () => {
    const sources = {
      slack: {
        icon: '/Slack_icon_2019.svg.png',
        label: 'Slack',
        color: '#4A154B',
        bgColor: 'rgba(74, 21, 75, 0.1)'
      },
      jira: {
        icon: '🔷',
        label: 'Jira',
        color: '#0052CC',
        bgColor: 'rgba(0, 82, 204, 0.1)'
      }
    };
    return sources[source] || sources.slack;
  };

  // Get work type icon and color
  const getWorkTypeDisplay = () => {
    const workTypes = {
      calendar: {
        icon: '📅',
        label: 'Meeting',
        color: '#34C759'
      },
      email: {
        icon: '📧',
        label: 'Email',
        color: '#5AC8FA'
      },
      outreach: {
        icon: '📤',
        label: 'Outreach',
        color: '#AF52DE'
      },
      task: {
        icon: '✓',
        label: 'Task',
        color: '#007AFF'
      }
    };
    return workTypes[work_type] || workTypes.task;
  };

  const sourceDisplay = getSourceDisplay();
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
      className={`action-item-clean ${status === 'completed' ? 'completed' : ''}`}
      onClick={handleCardClick}
    >
      {/* Source Logo */}
      <div className="action-logo">
        {source === 'slack' ? (
          <img 
            src={sourceDisplay.icon} 
            alt="Slack" 
            className="logo-image"
          />
        ) : source === 'jira' ? (
          <img 
            src="/JIRALOGO.png" 
            alt="Jira"
            className="logo-image"
            onError={(e) => {
              // Fallback to emoji if image not found
              e.target.style.display = 'none';
              e.target.nextSibling.style.display = 'flex';
            }}
          />
        ) : null}
        <span className="logo-emoji-fallback" style={{ display: 'none' }}>
          {sourceDisplay.icon}
        </span>
      </div>
      
      {/* Title */}
      <div className="action-content">
        <h3 className="action-title-clean">{title}</h3>
      </div>
    </div>
  );
}
