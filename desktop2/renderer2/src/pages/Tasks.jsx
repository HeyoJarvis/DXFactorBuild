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
    jiraView,
    setJiraView,
    jiraConnected,
    updateTask,
    deleteTask,
    toggleTask,
    linkToJira,
    unlinkFromJira,
    monitorTask,
    unmonitorTask,
    refreshTasks
  } = useSalesTasks(user, assignmentView);
  
  const [chatTask, setChatTask] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewFilter, setViewFilter] = useState('All');
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [isSyncing, setIsSyncing] = useState(false);
  const [linkingTask, setLinkingTask] = useState(null);
  const [jiraKey, setJiraKey] = useState('');
  const [linkError, setLinkError] = useState('');

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

  const handleRefresh = async () => {
    setIsSyncing(true);
    try {
      await refreshTasks();
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Failed to refresh tasks:', error);
    } finally {
      setTimeout(() => setIsSyncing(false), 1000);
    }
  };

  const handleLinkToJira = async () => {
    if (!jiraKey.trim()) {
      setLinkError('Please enter a JIRA ticket key');
      return;
    }

    try {
      setLinkError('');
      await linkToJira(linkingTask, jiraKey.trim().toUpperCase());
      setLinkingTask(null);
      setJiraKey('');
      // Show success message
      console.log('✅ Successfully linked to JIRA');
    } catch (error) {
      console.error('Failed to link:', error);
      setLinkError(error.message || 'Failed to link to JIRA. Make sure the ticket key is correct.');
    }
  };

  const handleUnlinkFromJira = async (taskId) => {
    if (window.confirm('Are you sure you want to unlink this task from JIRA?')) {
      try {
        await unlinkFromJira(taskId);
      } catch (error) {
        console.error('Failed to unlink:', error);
        alert('Failed to unlink from JIRA');
      }
    }
  };

  const handleMonitorTask = async (task) => {
    try {
      await monitorTask(task);
      // Show success feedback
      console.log('✅ Now monitoring:', task.title || task.session_title);
    } catch (error) {
      console.error('Failed to monitor task:', error);
      alert('Failed to monitor task. Please try again.');
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
              <button 
                className="refresh-button"
                onClick={handleRefresh}
                disabled={isSyncing}
                title="Refresh tasks"
              >
                <svg 
                  className={`refresh-icon ${isSyncing ? 'spinning' : ''}`} 
                  width="14" 
                  height="14" 
                  viewBox="0 0 24 24" 
                  fill="none" 
                  stroke="currentColor" 
                  strokeWidth="2" 
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                >
                  <polyline points="23 4 23 10 17 10"></polyline>
                  <polyline points="1 20 1 14 7 14"></polyline>
                  <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
                </svg>
              </button>
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

      {/* Task View Toggle */}
      <div className="view-toggle-container">
        <div className="view-toggle">
          <button 
            className={`toggle-btn ${!jiraView ? 'active' : ''}`}
            onClick={() => setJiraView(false)}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 11l3 3L22 4"></path>
              <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
            </svg>
            My Tasks
          </button>
          <button 
            className={`toggle-btn ${jiraView ? 'active' : ''}`}
            onClick={() => setJiraView(true)}
            title="View developer JIRA tasks from your team"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
              <circle cx="9" cy="7" r="4"></circle>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
            </svg>
            Team Dev Tasks
            {jiraView && tasks.length > 0 && (
              <span className="toggle-badge">{tasks.length}</span>
            )}
          </button>
        </div>
        {jiraView && (
          <div className="jira-status-hint">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="16" x2="12" y2="12"></line>
              <line x1="12" y1="8" x2="12.01" y2="8"></line>
            </svg>
            Monitor developer JIRA tasks to track progress for clients
          </div>
        )}
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
              onMonitor={jiraView ? handleMonitorTask : null}
              isTeamDevView={jiraView}
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
              onMonitor={jiraView ? handleMonitorTask : null}
              isTeamDevView={jiraView}
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
              onMonitor={jiraView ? handleMonitorTask : null}
              isTeamDevView={jiraView}
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

      {/* Link to JIRA Modal */}
      {linkingTask && (
        <div className="modal-overlay" onClick={() => setLinkingTask(null)}>
          <div className="modal-content jira-link-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Link Task to JIRA</h3>
              <button className="modal-close" onClick={() => setLinkingTask(null)}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
            <div className="modal-body">
              <p className="modal-description">
                Enter the JIRA ticket key (e.g., PROJ-123) to link this task
              </p>
              <div className="input-group">
                <label htmlFor="jira-key-input">JIRA Ticket Key</label>
                <input
                  id="jira-key-input"
                  type="text"
                  className="jira-key-input"
                  placeholder="PROJ-123"
                  value={jiraKey}
                  onChange={(e) => {
                    setJiraKey(e.target.value);
                    setLinkError('');
                  }}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      handleLinkToJira();
                    }
                  }}
                  autoFocus
                />
                {linkError && (
                  <div className="error-message">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10"></circle>
                      <line x1="12" y1="8" x2="12" y2="12"></line>
                      <line x1="12" y1="16" x2="12.01" y2="16"></line>
                    </svg>
                    {linkError}
                  </div>
                )}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setLinkingTask(null)}>
                Cancel
              </button>
              <button className="btn-primary" onClick={handleLinkToJira}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
                  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
                </svg>
                Link to JIRA
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
