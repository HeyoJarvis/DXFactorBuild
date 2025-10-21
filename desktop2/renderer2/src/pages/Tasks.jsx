import { useState, useEffect } from 'react';
import { useSalesTasks } from '../hooks/useSalesTasks';
import ActionList from '../components/Tasks/ActionList';
import TaskChat from '../components/Tasks/TaskChat';
import './Tasks.css';

export default function Tasks({ user }) {
  const [assignmentView, setAssignmentView] = useState('all');

  const {
    tasks,
    loading,
    updateTask,
    deleteTask,
    toggleTask
  } = useSalesTasks(user, assignmentView);
  
  const [chatTask, setChatTask] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewFilter, setViewFilter] = useState('All');
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [isSyncing, setIsSyncing] = useState(false);

  // Update last updated timestamp when tasks change
  useEffect(() => {
    if (!loading) {
      setLastUpdated(new Date());
      // Simulate sync animation
      setIsSyncing(true);
      setTimeout(() => setIsSyncing(false), 1000);
    }
  }, [tasks, loading]);

  const handleUpdateTask = async (taskId, updates) => {
    try {
      await updateTask(taskId, updates);
    } catch (error) {
      console.error('Failed to update task:', error);
    }
  };

  const handleDeleteTask = async (taskId) => {
    try {
      await deleteTask(taskId);
    } catch (error) {
      console.error('Failed to delete task:', error);
    }
  };

  const handleToggleTask = async (taskId, currentStatus) => {
    try {
      await toggleTask(taskId, currentStatus);
    } catch (error) {
      console.error('Failed to toggle task:', error);
    }
  };

  if (loading) {
    return (
      <div className="tasks-page loading">
        <div className="loading-spinner">
          <div className="spinner-circle"></div>
          <span>Loading tasks...</span>
        </div>
      </div>
    );
  }

  // Calculate task stats
  const completedCount = tasks.filter(t => t.status === 'completed' || t.is_completed).length;
  const totalCount = tasks.length;
  const overdueCount = tasks.filter(t => {
    if (t.is_completed) return false;
    // Add logic for overdue tasks based on due_date if available
    return false;
  }).length;
  const unassignedCount = tasks.filter(t => !t.workflow_metadata?.assignedBy && !t.is_completed).length;

  // Group tasks by status
  const todayTasks = tasks.filter(t => !t.is_completed && t.priority === 'urgent');
  const upcomingTasks = tasks.filter(t => !t.is_completed && t.priority !== 'urgent');
  const completedTasks = tasks.filter(t => t.is_completed || t.status === 'completed');

  // Format last updated time
  const formatLastUpdated = () => {
    const now = new Date();
    const diff = Math.floor((now - lastUpdated) / 1000);
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return lastUpdated.toLocaleDateString();
  };

  return (
    <div className="tasks-page">
      {/* Simplified Professional Header */}
      <div className="task-header">
        <div className="header-container">
          {/* Left - Title and Sync Status */}
          <div className="header-left">
            <h1 className="header-title">TASKS</h1>
            <div className="sync-status">
              <div className={`sync-dot ${isSyncing ? 'syncing' : ''}`}></div>
              <span className="sync-text">Synced from Slack</span>
            </div>
          </div>

          {/* Center - Search */}
          <div className="header-center">
            <div className="search-wrapper">
              <svg className="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"></circle>
                <path d="m21 21-4.35-4.35"></path>
              </svg>
              <input 
                type="text"
                className="search-field"
                placeholder="Search or filter tasks..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          {/* Right - Controls */}
          <div className="header-right">
            <select className="view-selector" value={viewFilter} onChange={(e) => setViewFilter(e.target.value)}>
              <option>All</option>
              <option>My Tasks</option>
              <option>Mentions</option>
              <option>Urgent</option>
            </select>
            
            <button className="btn-primary">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
              Add Task
            </button>
            
            <button 
              className="btn-ghost btn-icon"
              onClick={() => {
                if (window.electronAPI?.window) {
                  window.close();
                }
              }}
              title="Minimize"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
            </button>
          </div>
        </div>
        
        {/* Elegant bottom divider */}
        <div className="header-divider"></div>
      </div>

      {/* Intelligence Bar */}
      {(overdueCount > 0 || unassignedCount > 0) && (
        <div className="intelligence-bar">
          {overdueCount > 0 && (
            <div className="intelligence-pill danger">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
              </svg>
              {overdueCount} overdue task{overdueCount > 1 ? 's' : ''}
            </div>
          )}
          {unassignedCount > 0 && (
            <div className="intelligence-pill warning">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path>
                <circle cx="9" cy="7" r="4"></circle>
                <line x1="22" y1="11" x2="16" y2="11"></line>
              </svg>
              {unassignedCount} unassigned item{unassignedCount > 1 ? 's' : ''}
            </div>
          )}
          <div className="intelligence-pill info">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline>
              <polyline points="17 6 23 6 23 12"></polyline>
            </svg>
            Updated {formatLastUpdated()}
          </div>
        </div>
      )}

      {/* Tasks Container with Grouping */}
      <div className="tasks-container">
        {todayTasks.length > 0 && (
          <div className="task-group">
            <div className="task-group-header">
              <h2 className="task-group-title">Today</h2>
              <span className="task-group-count">{todayTasks.length}</span>
            </div>
            <ActionList
              tasks={todayTasks}
              onToggle={handleToggleTask}
              onDelete={handleDeleteTask}
              onUpdate={handleUpdateTask}
              onChat={setChatTask}
            />
          </div>
        )}

        {upcomingTasks.length > 0 && (
          <div className="task-group">
            <div className="task-group-header">
              <h2 className="task-group-title">Upcoming</h2>
              <span className="task-group-count">{upcomingTasks.length}</span>
            </div>
            <ActionList
              tasks={upcomingTasks}
              onToggle={handleToggleTask}
              onDelete={handleDeleteTask}
              onUpdate={handleUpdateTask}
              onChat={setChatTask}
            />
          </div>
        )}

        {completedTasks.length > 0 && (
          <div className="task-group">
            <div className="task-group-header collapsible">
              <div className="group-header-left">
                <svg className="collapse-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
                <h2 className="task-group-title">Completed</h2>
              </div>
              <span className="task-group-count">{completedTasks.length}</span>
            </div>
            <ActionList
              tasks={completedTasks}
              onToggle={handleToggleTask}
              onDelete={handleDeleteTask}
              onUpdate={handleUpdateTask}
              onChat={setChatTask}
            />
          </div>
        )}

        {tasks.length === 0 && (
          <div className="tasks-empty">
            <div className="empty-icon">✨</div>
            <div className="empty-title">No tasks yet</div>
            <div className="empty-subtitle">Create your first task to get started</div>
          </div>
        )}
      </div>
      
      {/* Task Chat Modal */}
      {chatTask && (
        <TaskChat 
          task={chatTask} 
          onClose={() => setChatTask(null)} 
        />
      )}
    </div>
  );
}
