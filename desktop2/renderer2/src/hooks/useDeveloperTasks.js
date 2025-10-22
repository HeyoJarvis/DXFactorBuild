/**
 * useDeveloperTasks Hook
 * Manages developer tasks via Electron IPC with route filtering
 */

import { useState, useEffect, useCallback } from 'react';

export function useDeveloperTasks(user, assignmentView = 'all') {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  /**
   * Load developer tasks only (route_to: 'mission-control')
   * Filtered by user role and assignment
   */
  const loadTasks = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const filters = {
        routeTo: 'mission-control',
        userRole: user?.user_role || 'developer',
        slackUserId: user?.slack_user_id
      };

      // Add assignment view filter if specified
      if (assignmentView && assignmentView !== 'all') {
        filters.assignmentView = assignmentView;
      }

      const response = await window.electronAPI.tasks.getAll(filters);

      if (response.success) {
        console.log('💻 Developer tasks loaded:', {
          count: response.tasks?.length || 0,
          userRole: filters.userRole,
          slackUserId: filters.slackUserId,
          assignmentView: assignmentView,
          tasks: response.tasks
        });
        setTasks(response.tasks || []);
      } else {
        throw new Error(response.error || 'Failed to load developer tasks');
      }
    } catch (err) {
      console.error('Load developer tasks error:', err);
      setError(err.message);
      setTasks([]); // Set empty array on error
    } finally {
      setLoading(false);
    }
  }, [user, assignmentView]);

  /**
   * Create a new developer task
   */
  const addTask = useCallback(async (taskData) => {
    try {
      const response = await window.electronAPI.tasks.create({
        ...taskData,
        routeTo: 'mission-control',
        workType: taskData.workType || 'task'
      });

      if (response.success) {
        // Reload tasks to get fresh data from backend
        await loadTasks();
        return response.data;
      } else {
        throw new Error(response.error || 'Failed to create task');
      }
    } catch (err) {
      console.error('Add developer task error:', err);
      setError(err.message);
      throw err;
    }
  }, [loadTasks]);

  /**
   * Update a task
   */
  const updateTask = useCallback(async (taskId, updates) => {
    try {
      const response = await window.electronAPI.tasks.update({ taskId, updates });

      if (response.success) {
        // Reload tasks to get fresh data from backend
        await loadTasks();
        return response.data;
      } else {
        throw new Error(response.error || 'Failed to update task');
      }
    } catch (err) {
      console.error('Update task error:', err);
      setError(err.message);
      throw err;
    }
  }, [loadTasks]);

  /**
   * Delete a task
   */
  const deleteTask = useCallback(async (taskId) => {
    try {
      const response = await window.electronAPI.tasks.delete(taskId);

      if (response.success) {
        // Reload tasks to get fresh data from backend
        await loadTasks();
      } else {
        throw new Error(response.error || 'Failed to delete task');
      }
    } catch (err) {
      console.error('Delete task error:', err);
      setError(err.message);
      throw err;
    }
  }, [loadTasks]);

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
      todo: tasks.filter(t => t.status === 'todo').length,
      inProgress: tasks.filter(t => t.status === 'in_progress').length,
      completed: tasks.filter(t => t.status === 'completed').length
    };
  }, [tasks]);

  // Load tasks on mount and set up auto-refresh
  useEffect(() => {
    loadTasks();
    
    // Listen for task created events from main process
    let taskCreatedCleanup;
    if (window.electronAPI?.onTaskCreated) {
      taskCreatedCleanup = window.electronAPI.onTaskCreated(() => {
        console.log('🔔 Task created event received, refreshing developer tasks');
        // Auto-refresh tasks when new task is created
        loadTasks();
      });
    }
    
    // Set up periodic refresh every 30 seconds to catch external changes
    const refreshInterval = setInterval(() => {
      console.log('🔄 Auto-refreshing developer tasks (periodic)');
      loadTasks();
    }, 30000); // 30 seconds
    
    return () => {
      if (taskCreatedCleanup) taskCreatedCleanup();
      clearInterval(refreshInterval);
    };
  }, [loadTasks]);

  return {
    tasks,
    loading,
    error,
    addTask,
    updateTask,
    deleteTask,
    toggleTask,
    refreshTasks: loadTasks,
    stats: getStats()
  };
}

