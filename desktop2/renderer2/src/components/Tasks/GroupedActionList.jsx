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
      key: 'medium',
      title: 'Normal',
      icon: '●',
      color: '#007AFF',
      tasks: groupedTasks.medium
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
      {sections.map(section => {
        // Only show sections that have tasks
        if (section.tasks.length === 0) return null;

        const isCollapsed = collapsed[section.key];

        return (
          <div key={section.key} className="task-section">
            {/* Section Header */}
            <div 
              className="section-header"
              onClick={() => toggleSection(section.key)}
              style={{ '--section-color': section.color }}
            >
              <div className="section-header-left">
                <svg 
                  className={`collapse-icon ${isCollapsed ? 'collapsed' : ''}`}
                  width="16" 
                  height="16" 
                  viewBox="0 0 24 24" 
                  fill="none" 
                  stroke="currentColor" 
                  strokeWidth="2"
                >
                  <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
                <span className="section-icon">{section.icon}</span>
                <h3 className="section-title">{section.title}</h3>
              </div>
              <span className="section-count">{section.tasks.length}</span>
            </div>

            {/* Section Content */}
            {!isCollapsed && (
              <div className="section-content">
                {/* Show limited or all tasks */}
                {(showAll[section.key] ? section.tasks : section.tasks.slice(0, INITIAL_DISPLAY_LIMIT)).map((task, index) => (
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
                {section.tasks.length > INITIAL_DISPLAY_LIMIT && (
                  <button 
                    className="show-more-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleShowAll(section.key);
                    }}
                  >
                    {showAll[section.key] 
                      ? `Show less` 
                      : `Show ${section.tasks.length - INITIAL_DISPLAY_LIMIT} more`
                    }
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* Empty State */}
      {tasks.length === 0 && (
        <div className="tasks-empty-state">
          <div className="empty-icon">✨</div>
          <h3 className="empty-title">All clear!</h3>
          <p className="empty-subtitle">No tasks to show</p>
        </div>
      )}
    </div>
  );
}

