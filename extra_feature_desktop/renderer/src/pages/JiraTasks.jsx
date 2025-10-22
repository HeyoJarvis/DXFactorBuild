import React, { useState, useEffect } from 'react';
import './JiraTasks.css';

function JiraTasks({ user }) {
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState({ jira: false });
  const [updates, setUpdates] = useState([]);
  const [filter, setFilter] = useState('all'); // all, open, in_progress, done
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTask, setSelectedTask] = useState(null);
  const [stats, setStats] = useState({ total: 0, open: 0, inProgress: 0, done: 0 });
  const [lastSync, setLastSync] = useState(null);

  useEffect(() => {
    // Only run if user is available
    if (user && user.id) {
      checkConnection();
      loadTasks();
    }
  }, [user]);

  const checkConnection = async () => {
    try {
      const result = await window.electronAPI.auth.checkStatus();
      if (result && result.success && result.connections) {
        setConnectionStatus(result.connections);
      }
    } catch (error) {
      console.error('Failed to check connection:', error);
      setConnectionStatus({ jira: false });
    }
  };

  const loadTasks = async () => {
    setLoading(true);
    try {
      const result = await window.electronAPI.sync.getUpdates({ days: 30 });
      if (result && result.success && result.updates) {
        const jiraTasks = (result.updates || []).filter(u => 
          u && u.update_type && u.update_type.startsWith('jira_')
        );
        setUpdates(jiraTasks);
        calculateStats(jiraTasks);
        setLastSync(new Date());
      } else {
        console.error('Failed to load tasks:', result?.error || 'Unknown error');
        setUpdates([]);
      }
    } catch (error) {
      console.error('Error loading tasks:', error);
      setUpdates([]);
    } finally {
      setLoading(false);
    }
  };

  const syncFromJIRA = async () => {
    if (!user || !user.id) {
      alert('User not logged in');
      return;
    }
    
    setSyncing(true);
    try {
      const result = await window.electronAPI.sync.fetchJIRA(user.id, { days: 30 });
      if (result && result.success) {
        await loadTasks(); // Reload from database
        alert(`✅ Synced successfully!\n\n${result.updates?.length || 0} updates fetched`);
      } else {
        alert('❌ Sync failed: ' + (result?.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Sync error:', error);
      alert('Error: ' + error.message);
    } finally {
      setSyncing(false);
    }
  };

  const calculateStats = (tasks) => {
    const total = tasks.length;
    const open = tasks.filter(t => getTaskStatus(t) === 'open').length;
    const inProgress = tasks.filter(t => getTaskStatus(t) === 'in_progress').length;
    const done = tasks.filter(t => getTaskStatus(t) === 'done').length;
    setStats({ total, open, inProgress, done });
  };

  const getTaskStatus = (task) => {
    const content = task.content_text?.toLowerCase() || '';
    const metadata = task.metadata || {};
    
    // Check metadata first
    if (metadata.status) {
      const status = metadata.status.toLowerCase();
      if (status.includes('done') || status.includes('closed') || status.includes('resolved')) {
        return 'done';
      }
      if (status.includes('progress') || status.includes('development')) {
        return 'in_progress';
      }
      return 'open';
    }
    
    // Fallback to content parsing
    if (content.includes('done') || content.includes('closed') || content.includes('resolved')) {
      return 'done';
    }
    if (content.includes('in progress') || content.includes('development')) {
      return 'in_progress';
    }
    return 'open';
  };

  const getTaskPriority = (task) => {
    const content = task.content_text?.toLowerCase() || '';
    const metadata = task.metadata || {};
    
    if (metadata.priority) {
      return metadata.priority;
    }
    
    if (content.includes('critical') || content.includes('blocker')) return 'Critical';
    if (content.includes('high')) return 'High';
    if (content.includes('medium')) return 'Medium';
    if (content.includes('low')) return 'Low';
    return 'Medium';
  };

  const getTaskType = (task) => {
    const updateType = task.update_type;
    if (updateType === 'jira_issue_created') return 'New Issue';
    if (updateType === 'jira_issue_updated') return 'Updated';
    if (updateType === 'jira_comment') return 'Comment';
    return 'Issue';
  };

  const filterTasks = () => {
    let filtered = updates;

    // Filter by status
    if (filter !== 'all') {
      filtered = filtered.filter(task => getTaskStatus(task) === filter);
    }

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(task =>
        task.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        task.content_text?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Sort by created date (newest first)
    return filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  };

  const connectJIRA = async () => {
    try {
      const result = await window.electronAPI.auth.connectJIRA();
      if (result && result.success) {
        alert('✅ JIRA connected successfully!');
        // Refresh connection status and load tasks
        await checkConnection();
        await loadTasks();
      } else {
        alert('❌ Connection failed: ' + (result?.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Connection error:', error);
      alert('Error: ' + error.message);
    }
  };

  const renderConnectionBanner = () => {
    if (connectionStatus.jira) {
      return (
        <div className="connection-banner connected">
          <div className="banner-content">
            <span className="banner-icon">✅</span>
            <div>
              <strong>JIRA Connected</strong>
              <p>Showing tasks from the last 30 days</p>
            </div>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={syncFromJIRA} disabled={syncing}>
            {syncing ? '⏳ Syncing...' : '🔄 Sync Now'}
          </button>
        </div>
      );
    }

    return (
      <div className="connection-banner disconnected">
        <div className="banner-content">
          <span className="banner-icon">⚠️</span>
          <div>
            <strong>JIRA Not Connected</strong>
            <p>Connect your JIRA account to see tasks and cards</p>
          </div>
        </div>
        <button className="btn btn-primary btn-sm" onClick={connectJIRA}>
          🔗 Connect JIRA
        </button>
      </div>
    );
  };

  const renderStats = () => (
    <div className="stats-grid">
      <div className="stat-card">
        <div className="stat-value">{stats.total}</div>
        <div className="stat-label">Total Tasks</div>
      </div>
      <div className="stat-card stat-open">
        <div className="stat-value">{stats.open}</div>
        <div className="stat-label">Open</div>
      </div>
      <div className="stat-card stat-progress">
        <div className="stat-value">{stats.inProgress}</div>
        <div className="stat-label">In Progress</div>
      </div>
      <div className="stat-card stat-done">
        <div className="stat-value">{stats.done}</div>
        <div className="stat-label">Done</div>
      </div>
    </div>
  );

  const renderTaskCard = (task) => {
    const status = getTaskStatus(task);
    const priority = getTaskPriority(task);
    const type = getTaskType(task);

    return (
      <div
        key={task.id}
        className={`task-card ${selectedTask?.id === task.id ? 'selected' : ''}`}
        onClick={() => setSelectedTask(task)}
      >
        <div className="task-header">
          <div className="task-meta">
            <span className={`status-badge status-${status}`}>
              {status === 'open' && '📋'}
              {status === 'in_progress' && '🔄'}
              {status === 'done' && '✅'}
              {' '}
              {status.replace('_', ' ')}
            </span>
            <span className={`priority-badge priority-${priority.toLowerCase()}`}>
              {priority}
            </span>
            <span className="type-badge">{type}</span>
          </div>
          <div className="task-date">
            {new Date(task.created_at).toLocaleDateString()}
          </div>
        </div>

        <h3 className="task-title">{task.title || 'Untitled Task'}</h3>

        <p className="task-content">
          {task.content_text?.substring(0, 150)}
          {task.content_text?.length > 150 && '...'}
        </p>

        {task.metadata?.assignee && (
          <div className="task-assignee">
            <span className="assignee-avatar">
              {typeof task.metadata.assignee === 'string' 
                ? task.metadata.assignee[0]?.toUpperCase() 
                : (task.metadata.assignee.displayName?.[0] || task.metadata.assignee.email?.[0] || '?').toUpperCase()}
            </span>
            <span className="assignee-name">
              {typeof task.metadata.assignee === 'string' 
                ? task.metadata.assignee 
                : task.metadata.assignee.displayName || task.metadata.assignee.email || 'Unknown'}
            </span>
          </div>
        )}
      </div>
    );
  };

  const renderTaskDetail = () => {
    if (!selectedTask) {
      return (
        <div className="task-detail-empty">
          <div className="empty-icon">📋</div>
          <p>Select a task to view details</p>
        </div>
      );
    }

    const status = getTaskStatus(selectedTask);
    const priority = getTaskPriority(selectedTask);
    const type = getTaskType(selectedTask);

    return (
      <div className="task-detail">
        <div className="detail-header">
          <div>
            <h2 className="detail-title">{selectedTask.title || 'Untitled Task'}</h2>
            <div className="detail-meta">
              <span className={`status-badge status-${status}`}>
                {status === 'open' && '📋'}
                {status === 'in_progress' && '🔄'}
                {status === 'done' && '✅'}
                {' '}
                {status.replace('_', ' ')}
              </span>
              <span className={`priority-badge priority-${priority.toLowerCase()}`}>
                {priority}
              </span>
              <span className="type-badge">{type}</span>
            </div>
          </div>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => setSelectedTask(null)}
          >
            ✕ Close
          </button>
        </div>

        <div className="detail-section">
          <h3>Description</h3>
          <div className="detail-content">
            {selectedTask.content_text || 'No description available'}
          </div>
        </div>

        <div className="detail-info-grid">
          <div className="info-item">
            <label>Created</label>
            <span>{new Date(selectedTask.created_at).toLocaleString()}</span>
          </div>
          {selectedTask.metadata?.assignee && (
            <div className="info-item">
              <label>Assignee</label>
              <span className="assignee-info">
                <span className="assignee-avatar">
                  {typeof selectedTask.metadata.assignee === 'string'
                    ? selectedTask.metadata.assignee[0]?.toUpperCase()
                    : (selectedTask.metadata.assignee.displayName?.[0] || selectedTask.metadata.assignee.email?.[0] || '?').toUpperCase()}
                </span>
                {typeof selectedTask.metadata.assignee === 'string'
                  ? selectedTask.metadata.assignee
                  : selectedTask.metadata.assignee.displayName || selectedTask.metadata.assignee.email || 'Unknown'}
              </span>
            </div>
          )}
          {selectedTask.metadata?.project && (
            <div className="info-item">
              <label>Project</label>
              <span>
                {typeof selectedTask.metadata.project === 'string'
                  ? selectedTask.metadata.project
                  : selectedTask.metadata.project.name || selectedTask.metadata.project.key || 'Unknown'}
              </span>
            </div>
          )}
          {selectedTask.external_id && (
            <div className="info-item">
              <label>JIRA ID</label>
              <span className="jira-id">{selectedTask.external_id}</span>
            </div>
          )}
        </div>

        {selectedTask.metadata && Object.keys(selectedTask.metadata).length > 0 && (
          <div className="detail-section">
            <h3>Additional Information</h3>
            <pre className="metadata-display">
              {JSON.stringify(selectedTask.metadata, null, 2)}
            </pre>
          </div>
        )}
      </div>
    );
  };

  const filteredTasks = filterTasks();

  // Show loading if user is not yet available
  if (!user) {
    return (
      <div className="jira-tasks-page">
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="jira-tasks-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">📋 JIRA Tasks</h1>
          <p className="page-subtitle">View and manage your JIRA issues and tasks</p>
        </div>
        {lastSync && (
          <div className="last-sync">
            <small>Last synced: {lastSync.toLocaleTimeString()}</small>
          </div>
        )}
      </div>

      {renderConnectionBanner()}

      {connectionStatus.jira && (
        <>
          {renderStats()}

          <div className="tasks-toolbar">
            <div className="filter-buttons">
              <button
                className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
                onClick={() => setFilter('all')}
              >
                All ({stats.total})
              </button>
              <button
                className={`filter-btn ${filter === 'open' ? 'active' : ''}`}
                onClick={() => setFilter('open')}
              >
                📋 Open ({stats.open})
              </button>
              <button
                className={`filter-btn ${filter === 'in_progress' ? 'active' : ''}`}
                onClick={() => setFilter('in_progress')}
              >
                🔄 In Progress ({stats.inProgress})
              </button>
              <button
                className={`filter-btn ${filter === 'done' ? 'active' : ''}`}
                onClick={() => setFilter('done')}
              >
                ✅ Done ({stats.done})
              </button>
            </div>

            <div className="search-box">
              <input
                type="text"
                placeholder="Search tasks..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="search-input"
              />
            </div>
          </div>

          <div className="tasks-container">
            <div className="tasks-list">
              {loading ? (
                <div className="loading-state">
                  <div className="spinner"></div>
                  <p>Loading tasks...</p>
                </div>
              ) : filteredTasks.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">📭</div>
                  <p>No tasks found</p>
                  <small>
                    {searchTerm
                      ? 'Try adjusting your search'
                      : 'Click "Sync Now" to fetch tasks from JIRA'}
                  </small>
                </div>
              ) : (
                filteredTasks.map(renderTaskCard)
              )}
            </div>

            <div className="task-detail-panel">
              {renderTaskDetail()}
            </div>
          </div>
        </>
      )}

      {!connectionStatus.jira && !loading && (
        <div className="disconnected-state">
          <div className="disconnected-icon">🔗</div>
          <h2>Connect JIRA to Get Started</h2>
          <p>
            Connect your JIRA account to view and manage your tasks directly from Team Sync.
          </p>
          <button className="btn btn-primary" onClick={connectJIRA}>
            🔗 Connect JIRA Now
          </button>
        </div>
      )}
    </div>
  );
}

export default JiraTasks;

