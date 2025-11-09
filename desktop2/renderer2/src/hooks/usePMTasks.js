/**
 * usePMTasks Hook
 * Manages JIRA tasks for PM/Functional roles via Electron IPC
 * PMs see all JIRA tasks for their selected unit/team
 */

import { useState, useEffect, useCallback } from 'react';

export function usePMTasks(user, selectedUnit = null) {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [jiraConnected, setJiraConnected] = useState(false);

  /**
   * Check JIRA connection status
   */
  const checkJiraConnection = useCallback(async () => {
    try {
      if (!window.electronAPI?.jira?.checkConnection) {
        setJiraConnected(false);
        return;
      }
      const response = await window.electronAPI.jira.checkConnection();
      setJiraConnected(response.connected || false);
    } catch (error) {
      console.error('Failed to check JIRA connection:', error);
      setJiraConnected(false);
    }
  }, []);

  /**
   * Load all JIRA tasks (team-wide)
   * PMs see ALL JIRA tasks, not filtered by team or assignee
   */
  const loadUnitJiraTasks = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Fetch ALL JIRA tasks (no team filtering)
      const filters = {
        externalSource: 'jira', // Only JIRA tasks
        skipTeamFilter: true // Don't filter by team
      };

      const response = await window.electronAPI.tasks.getAll(filters);

      if (response.success) {
        // Additional client-side filtering to ensure only JIRA tasks
        const jiraTasks = (response.tasks || []).filter(task =>
          task.externalSource === 'jira' ||
          task.external_source === 'jira' ||
          task.externalKey ||
          task.external_key ||
          task.jira_status
        );

        console.log('📊 PM: All JIRA tasks loaded:', {
          total: response.tasks?.length || 0,
          jiraOnly: jiraTasks.length,
          tasks: jiraTasks
        });
        setTasks(jiraTasks);
      } else {
        throw new Error(response.error || 'Failed to load JIRA tasks');
      }
    } catch (err) {
      console.error('Load JIRA tasks error:', err);
      setError(err.message);
      setTasks([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  /**
   * Update a task
   */
  const updateTask = useCallback(async (taskId, updates) => {
    try {
      console.log('🔄 PM updateTask called:', { taskId, updates });
      const response = await window.electronAPI.tasks.update({ taskId, updates });
      console.log('📡 Update response:', response);

      if (!response) {
        throw new Error('No response from update task');
      }

      if (response.success) {
        // Reload tasks to get fresh data from backend
        await loadUnitJiraTasks();
        return response.data;
      } else {
        // Safely handle error response
        let errorMsg = 'Failed to update task';
        if (typeof response.error === 'string') {
          errorMsg = response.error;
        } else if (response.error && typeof response.error === 'object' && response.error.message) {
          errorMsg = response.error.message;
        }
        throw new Error(errorMsg);
      }
    } catch (err) {
      console.error('Update task error:', err);
      setError(err?.message || String(err));
      throw err;
    }
  }, [loadUnitJiraTasks]);

  /**
   * Delete a task
   */
  const deleteTask = useCallback(async (taskId) => {
    try {
      const response = await window.electronAPI.tasks.delete(taskId);

      if (response.success) {
        // Reload tasks to get fresh data from backend
        await loadUnitJiraTasks();
      } else {
        throw new Error(response.error || 'Failed to delete task');
      }
    } catch (err) {
      console.error('Delete task error:', err);
      setError(err.message);
      throw err;
    }
  }, [loadUnitJiraTasks]);

  /**
   * Toggle task status
   */
  const toggleTask = useCallback(async (taskId, currentStatus) => {
    const newStatus = currentStatus === 'completed' ? 'todo' :
                     currentStatus === 'todo' ? 'in_progress' :
                     'completed';

    return updateTask(taskId, { status: newStatus });
  }, [updateTask]);

  /**
   * Get task statistics
   */
  const getStats = useCallback(() => {
    return {
      total: tasks.length,
      todo: tasks.filter(t => !t.is_completed && (!t.jira_status || ['To Do', 'Backlog', 'Open'].includes(t.jira_status))).length,
      inProgress: tasks.filter(t => !t.is_completed && ['In Progress', 'In Development', 'In Review'].includes(t.jira_status)).length,
      completed: tasks.filter(t => t.is_completed || ['Done', 'Resolved', 'Closed', 'Completed'].includes(t.jira_status)).length
    };
  }, [tasks]);

  // Load tasks when user or selectedUnit changes
  useEffect(() => {
    console.log('👁️ PM tasks effect triggered:', {
      userId: user?.id,
      teamId: selectedUnit?.id || user?.team_id
    });
    loadUnitJiraTasks();
  }, [loadUnitJiraTasks, user, selectedUnit]);

  // Check JIRA connection on mount
  useEffect(() => {
    checkJiraConnection();

    // Listen for task created events from main process
    let taskCreatedCleanup;
    if (window.electronAPI?.onTaskCreated) {
      taskCreatedCleanup = window.electronAPI.onTaskCreated(() => {
        console.log('🔔 Task created event received, refreshing PM tasks');
        loadUnitJiraTasks();
      });
    }

    // Set up periodic refresh every 30 seconds
    const refreshInterval = setInterval(() => {
      console.log('🔄 Auto-refreshing PM tasks (periodic)');
      loadUnitJiraTasks();
    }, 30000); // 30 seconds

    return () => {
      if (taskCreatedCleanup) taskCreatedCleanup();
      clearInterval(refreshInterval);
    };
  }, [loadUnitJiraTasks, checkJiraConnection]);

  return {
    tasks,
    loading,
    error,
    jiraConnected,
    updateTask,
    deleteTask,
    toggleTask,
    refreshTasks: loadUnitJiraTasks,
    stats: getStats()
  };
}
