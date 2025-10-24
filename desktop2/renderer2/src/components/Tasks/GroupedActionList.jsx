import { useState } from 'react';
import ActionItem from './ActionItem';
import './GroupedActionList.css';

/**
 * GroupedActionList - Tasks grouped by priority with collapsible sections
 * Reduces overwhelm by organizing tasks into manageable groups
 */
export default function GroupedActionList({ tasks, onToggle, onDelete, onUpdate, onChat }) {
  // Track which sections are collapsed
  const [collapsed, setCollapsed] = useState({
    urgent: false,
    high: false,
    medium: false,
    low: true, // Low priority starts collapsed
    completed: true // Completed starts collapsed
  });

  // Track which sections are showing all items
  const [showAll, setShowAll] = useState({
    urgent: false,
    high: false,
    medium: false,
    low: false,
    completed: false
  });

  // Track if showing all tasks
  const [showAllTasks, setShowAllTasks] = useState(false);

  // Limit for initial display
  const INITIAL_DISPLAY_LIMIT = 5;

  // Group tasks by priority
  const groupedTasks = {
    urgent: tasks.filter(t => !t.is_completed && (t.workflow_metadata?.priority === 'urgent' || t.priority === 'urgent')),
    high: tasks.filter(t => !t.is_completed && (t.workflow_metadata?.priority === 'high' || t.priority === 'high')),
    medium: tasks.filter(t => !t.is_completed && (t.workflow_metadata?.priority === 'medium' || t.priority === 'medium' || (!t.workflow_metadata?.priority && !t.priority))),
    low: tasks.filter(t => !t.is_completed && (t.workflow_metadata?.priority === 'low' || t.priority === 'low')),
    completed: tasks.filter(t => t.is_completed)
  };

  // Toggle section collapse
  const toggleSection = (section) => {
    setCollapsed(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  // Toggle show all for a section
  const toggleShowAll = (section) => {
    setShowAll(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  // Calculate statistics
  const stats = {
    todo: groupedTasks.urgent.length + groupedTasks.high.length + groupedTasks.medium.length + groupedTasks.low.length,
    active: Math.max(1, tasks.filter(t => t.status === 'in_progress' || t.workflow_metadata?.status === 'in_progress').length),
    done: groupedTasks.completed.length,
    total: tasks.length
  };
  
  const progressPercentage = stats.total > 0 ? Math.round((stats.done / stats.total) * 100) : 0;

  // Section configuration
  const sections = [
    {
      key: 'urgent',
      title: 'Urgent',
      icon: '🔥',
      color: '#FF3B30',
      tasks: groupedTasks.urgent
    },
    {
      key: 'high',
      title: 'High Priority',
      icon: '⚡',
      color: '#FF9F0A',
      tasks: groupedTasks.high
    },
    {
      key: 'low',
      title: 'Low Priority',
      icon: '○',
      color: '#8E8E93',
      tasks: groupedTasks.low
    },
    {
      key: 'completed',
      title: 'Completed',
      icon: '✓',
      color: '#34C759',
      tasks: groupedTasks.completed
    }
  ];

  return (
    <div className="grouped-action-list">
      <div className="action-list-items">
        {/* Render tasks in a flat list with limit */}
        {(showAllTasks ? tasks : tasks.slice(0, INITIAL_DISPLAY_LIMIT)).map((task, index) => (
          <ActionItem
            key={task.id}
            task={task}
            index={index}
            onToggle={onToggle}
            onDelete={onDelete}
            onUpdate={onUpdate}
            onChat={onChat}
          />
        ))}

        {/* Show More/Less Button */}
        {tasks.length > INITIAL_DISPLAY_LIMIT && (
          <button 
            className="show-more-btn"
            onClick={() => setShowAllTasks(!showAllTasks)}
          >
            {showAllTasks 
              ? `Show less` 
              : `Show ${tasks.length - INITIAL_DISPLAY_LIMIT} more`
            }
          </button>
        )}

        {/* Empty State */}
        {tasks.length === 0 && (
          <div className="tasks-empty-state">
            <div className="empty-icon">✨</div>
            <h3 className="empty-title">All clear!</h3>
            <p className="empty-subtitle">No tasks to show</p>
          </div>
        )}
      </div>

      {/* Stats Footer */}
      {tasks.length > 0 && (
        <div className="tasks-stats-footer">
          <div className="stats-row">
            <div className="stat-item">
              <div className="stat-number" style={{ color: '#64748b' }}>{stats.todo}</div>
              <div className="stat-label">To Do</div>
            </div>
            <div className="stat-item">
              <div className="stat-number" style={{ color: '#007aff' }}>{stats.active}</div>
              <div className="stat-label">Active</div>
            </div>
            <div className="stat-item">
              <div className="stat-number" style={{ color: '#34c759' }}>{stats.done}</div>
              <div className="stat-label">Done</div>
            </div>
            <div className="stat-item">
              <div className="stat-number" style={{ color: '#1e293b' }}>{stats.total}</div>
              <div className="stat-label">Total</div>
            </div>
          </div>
          
          <div className="stats-progress-section">
            <div className="progress-label">Weekly Progress</div>
            <div className="progress-percentage">{progressPercentage}%</div>
          </div>
          
          <div className="progress-bar-container">
            <div className="progress-bar" style={{ width: `${progressPercentage}%` }} />
          </div>
        </div>
      )}
    </div>
  );
}

