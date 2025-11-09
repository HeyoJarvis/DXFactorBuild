import { useState } from 'react';
import './KanbanBoard.css';

/**
 * KanbanBoard - Drag-and-drop board for sales users
 * Features:
 * - Three columns: To-Do, In Progress, Done
 * - Drag and drop tasks between columns
 * - Updates JIRA status automatically
 * - Clean Apple-style design
 */
export default function KanbanBoard({ tasks, onUpdateTask, onMonitor, isTeamDevView }) {
  const [draggedTask, setDraggedTask] = useState(null);
  const [dragOverColumn, setDragOverColumn] = useState(null);

  // Group tasks by status
  const columns = {
    'todo': {
      title: 'To-Do',
      icon: '○',
      color: '#64748b',
      tasks: tasks.filter(task =>
        !task.is_completed &&
        (!task.jira_status || ['To Do', 'Backlog', 'Open'].includes(task.jira_status))
      )
    },
    'in_progress': {
      title: 'In Progress',
      icon: '◐',
      color: '#3b82f6',
      tasks: tasks.filter(task =>
        !task.is_completed &&
        ['In Progress', 'In Development', 'In Review'].includes(task.jira_status)
      )
    },
    'done': {
      title: 'Done',
      icon: '✓',
      color: '#10b981',
      tasks: tasks.filter(task =>
        task.is_completed ||
        ['Done', 'Resolved', 'Closed', 'Completed'].includes(task.jira_status)
      )
    }
  };

  // Handle drag start
  const handleDragStart = (e, task) => {
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
  const handleDragLeave = () => {
    setDragOverColumn(null);
  };

  // Handle drop
  const handleDrop = async (e, columnKey) => {
    e.preventDefault();
    setDragOverColumn(null);

    if (!draggedTask) return;

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

    if (currentColumn === columnKey) {
      setDraggedTask(null);
      return;
    }

    // Update task status
    const updates = {
      jira_status: newStatus,
      is_completed: columnKey === 'done'
    };

    // Call update handler
    if (onUpdateTask) {
      await onUpdateTask(draggedTask.id, updates);
    }

    setDraggedTask(null);
  };

  return (
    <div className="kanban-board">
      {/* Board Columns */}
      <div className="kanban-columns">
        {Object.entries(columns).map(([columnKey, column]) => (
          <div
            key={columnKey}
            className={`kanban-column ${dragOverColumn === columnKey ? 'drag-over' : ''}`}
            onDragOver={(e) => handleDragOver(e, columnKey)}
            onDragLeave={handleDragLeave}
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
            <div className="kanban-cards">
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
                      {task.source === 'jira' && (
                        <div className="meta-badge source-jira">JIRA</div>
                      )}
                    </div>

                    {/* Monitor Button for Team Dev View */}
                    {isTeamDevView && onMonitor && (
                      <button
                        className="card-monitor-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          onMonitor(task);
                        }}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                          <circle cx="12" cy="12" r="3"></circle>
                        </svg>
                        Monitor
                      </button>
                    )}

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
      <div className="kanban-stats">
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
          <div className="stat-number" style={{ color: '#1e293b' }}>{tasks.length}</div>
          <div className="stat-label">Total</div>
        </div>
      </div>
    </div>
  );
}
