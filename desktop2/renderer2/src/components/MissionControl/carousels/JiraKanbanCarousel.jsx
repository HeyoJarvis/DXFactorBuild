import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './JiraKanbanCarousel.css';
import SlimHeader from '../common/SlimHeader';

/**
 * JiraKanbanCarousel - Kanban board for PM/Functional users in Mission Control V2
 *
 * Features:
 * - Shows ALL JIRA tasks for the unit/team
 * - Three columns: To-Do, In Progress, Done
 * - Drag and drop to update JIRA status
 * - Clean Apple-style design
 * - Integrated with SlimHeader
 */
export default function JiraKanbanCarousel({ tasks, onTaskSelect, user, onUpdateTask }) {
  const [draggedTask, setDraggedTask] = useState(null);
  const [dragOverColumn, setDragOverColumn] = useState(null);
  const [localTasks, setLocalTasks] = useState(tasks || []);
  const navigate = useNavigate();

  // Teams functionality hidden - no longer used
  // const handleTeamsClick = () => {
  //   navigate('/mission-control?mode=team');
  // };

  const handleSettingsClick = () => {
    navigate('/settings');
  };

  // Use local tasks for display
  const taskList = localTasks.length > 0 ? localTasks : tasks || [];

  // Group tasks by status
  const columns = {
    'todo': {
      title: 'To-Do',
      icon: '○',
      color: '#64748b',
      tasks: taskList.filter(task =>
        !task.is_completed &&
        (!task.jira_status || ['To Do', 'Backlog', 'Open'].includes(task.jira_status))
      )
    },
    'in_progress': {
      title: 'In Progress',
      icon: '◐',
      color: '#3b82f6',
      tasks: taskList.filter(task =>
        !task.is_completed &&
        ['In Progress', 'In Development', 'In Review'].includes(task.jira_status)
      )
    },
    'done': {
      title: 'Done',
      icon: '✓',
      color: '#10b981',
      tasks: taskList.filter(task =>
        task.is_completed ||
        ['Done', 'Resolved', 'Closed', 'Completed'].includes(task.jira_status)
      )
    }
  };

  // Handle drag start
  const handleDragStart = (e, task) => {
    console.log('🎯 Drag started:', task.title || task.session_title);
    setDraggedTask(task);
    e.dataTransfer.effectAllowed = 'move';
    e.target.style.opacity = '0.5';
  };

  // Handle drag end
  const handleDragEnd = (e) => {
    e.target.style.opacity = '1';
    setDraggedTask(null);
    setDragOverColumn(null);
  };

  // Handle drag over column
  const handleDragOver = (e, columnKey) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverColumn(columnKey);
  };

  // Handle drag leave
  const handleDragLeave = (e, columnKey) => {
    // Only clear if we're actually leaving the column container
    if (e.currentTarget === e.target) {
      setDragOverColumn(null);
    }
  };

  // Handle drop - Update local state only, no backend sync for now
  const handleDrop = (e, columnKey) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverColumn(null);

    console.log('📥 Drop event triggered:', { columnKey, hasDraggedTask: !!draggedTask });

    if (!draggedTask) {
      console.warn('⚠️ No dragged task found on drop');
      return;
    }

    // Map column to JIRA status
    const statusMapping = {
      'todo': 'To Do',
      'in_progress': 'In Progress',
      'done': 'Done'
    };

    const newStatus = statusMapping[columnKey];

    // Don't update if dropping in same column
    const currentColumn = Object.keys(columns).find(key =>
      columns[key].tasks.some(t => t.id === draggedTask.id)
    );

    console.log('📊 Drop info:', {
      task: draggedTask.title || draggedTask.session_title,
      from: currentColumn,
      to: columnKey,
      newStatus: newStatus
    });

    if (currentColumn === columnKey) {
      console.log('ℹ️ Dropped in same column, no update needed');
      setDraggedTask(null);
      return;
    }

    // Update local task state
    const updatedTasks = localTasks.map(task => {
      if (task.id === draggedTask.id) {
        return {
          ...task,
          jira_status: newStatus,
          is_completed: columnKey === 'done'
        };
      }
      return task;
    });

    setLocalTasks(updatedTasks);
    console.log('✅ Task moved locally (not saved to backend yet)');

    setDraggedTask(null);
  };

  // Handle card click to open detail view
  const handleCardClick = (task) => {
    if (onTaskSelect) {
      onTaskSelect(task);
    }
  };

  return (
    <div className="jira-kanban-wrapper">
      <SlimHeader
        title="Jira Progress"
        onTeamsClick={null}
        onSettingsClick={handleSettingsClick}
      />

      <div className="jira-kanban-board">
        {/* Board Columns */}
        <div className="kanban-columns-container">
          {Object.entries(columns).map(([columnKey, column]) => (
            <div
              key={columnKey}
              className={`kanban-column ${dragOverColumn === columnKey ? 'drag-over' : ''}`}
              onDragOver={(e) => handleDragOver(e, columnKey)}
              onDragLeave={(e) => handleDragLeave(e, columnKey)}
              onDrop={(e) => handleDrop(e, columnKey)}
            >
              {/* Column Header */}
              <div className="kanban-column-header" style={{ borderTopColor: column.color }}>
                <div className="column-title-group">
                  <span className="column-icon" style={{ color: column.color }}>{column.icon}</span>
                  <h3 className="column-title">{column.title}</h3>
                </div>
                <span className="column-count" style={{ color: column.color }}>
                  {column.tasks.length}
                </span>
              </div>

              {/* Column Cards */}
              <div className="kanban-cards-list">
                {column.tasks.length === 0 ? (
                  <div className="kanban-empty-state">
                    <div className="empty-circle" style={{ borderColor: column.color }}></div>
                    <p>No tasks</p>
                  </div>
                ) : (
                  column.tasks.map((task) => (
                    <div
                      key={task.id}
                      className="kanban-card"
                      draggable
                      onDragStart={(e) => handleDragStart(e, task)}
                      onDragEnd={handleDragEnd}
                      onClick={() => handleCardClick(task)}
                    >
                      {/* Card Header */}
                      <div className="kanban-card-header">
                        <span className="card-key">{task.external_key || task.externalKey || 'TASK'}</span>
                        {task.priority && (
                          <span className={`card-priority priority-${task.priority.toLowerCase()}`}>
                            {task.priority}
                          </span>
                        )}
                      </div>

                      {/* Card Title */}
                      <h4 className="kanban-card-title">
                        {task.title || task.session_title || 'Untitled Task'}
                      </h4>

                      {/* Card Meta */}
                      <div className="kanban-card-meta">
                        {task.story_points && (
                          <div className="meta-badge">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"></path>
                            </svg>
                            {task.story_points} pts
                          </div>
                        )}
                        {task.jira_issue_type && (
                          <div className="meta-badge">
                            {task.jira_issue_type}
                          </div>
                        )}
                      </div>

                      {/* Assignee */}
                      {task.assignee && (
                        <div className="card-assignee">
                          <div className="assignee-avatar">
                            {task.assignee.charAt(0).toUpperCase()}
                          </div>
                          <span className="assignee-name">{task.assignee}</span>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Board Stats */}
        <div className="kanban-stats-footer">
          <div className="stat-item">
            <div className="stat-number" style={{ color: '#64748b' }}>{columns.todo.tasks.length}</div>
            <div className="stat-label">To-Do</div>
          </div>
          <div className="stat-item">
            <div className="stat-number" style={{ color: '#3b82f6' }}>{columns.in_progress.tasks.length}</div>
            <div className="stat-label">In Progress</div>
          </div>
          <div className="stat-item">
            <div className="stat-number" style={{ color: '#10b981' }}>{columns.done.tasks.length}</div>
            <div className="stat-label">Done</div>
          </div>
          <div className="stat-divider"></div>
          <div className="stat-item">
            <div className="stat-number" style={{ color: '#1e293b' }}>{taskList.length}</div>
            <div className="stat-label">Total</div>
          </div>
        </div>
      </div>
    </div>
  );
}
