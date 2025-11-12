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
        // Additional client-side filtering to ensure ONLY tasks with external_source='jira'
        const jiraTasks = (response.tasks || []).filter(task => {
          // ONLY show tasks that explicitly have external_source set to 'jira'
          const isJira = task.external_source === 'jira' || task.externalSource === 'jira';
          
          // Debug: Log tasks that are marked as JIRA
          if (isJira) {
            console.log('🔍 JIRA task found:', {
              id: task.id,
              title: task.title,
              external_source: task.external_source,
              external_id: task.external_id,
              external_key: task.external_key,
              is_completed: task.is_completed,
              jira_deleted: task.jira_deleted,
              status: task.status
            });
          }
          
          return isJira;
        });

        console.log('📊 PM: All JIRA tasks loaded:', {
          total: response.tasks?.length || 0,
          jiraOnly: jiraTasks.length,
          completedCount: jiraTasks.filter(t => t.is_completed).length,
          deletedCount: jiraTasks.filter(t => t.jira_deleted).length
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
   * Uses internal status field which is now properly synced with JIRA status
   */
  const getStats = useCallback(() => {
    return {
      total: tasks.length,
      todo: tasks.filter(t => t.status === 'todo' || (!t.status && !t.is_completed)).length,
      inProgress: tasks.filter(t => t.status === 'in_progress').length,
      completed: tasks.filter(t => t.status === 'completed' || t.is_completed).length
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
