/**
 * useSalesTasks Hook
 * Manages sales tasks via Electron IPC with route filtering
 */

import { useState, useEffect, useCallback } from 'react';

export function useSalesTasks() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  /**
   * Load sales tasks only (route_to: 'tasks-sales')
   */
  const loadTasks = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await window.electronAPI.tasks.getAll({
        routeTo: 'tasks-sales'
      });

      if (response.success) {
        console.log('📋 Sales tasks loaded:', {
          count: response.tasks?.length || 0,
          tasks: response.tasks
        });
        setTasks(response.tasks || []);
      } else {
        throw new Error(response.error || 'Failed to load sales tasks');
      }
    } catch (err) {
      console.error('Load sales tasks error:', err);
      setError(err.message);
      setTasks([]); // Set empty array on error
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Create a new sales task
   */
  const addTask = useCallback(async (taskData) => {
    try {
      const response = await window.electronAPI.tasks.create({
        ...taskData,
        routeTo: 'tasks-sales',
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
      console.error('Add sales task error:', err);
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

  // Load tasks on mount
  useEffect(() => {
    loadTasks();
    
    // Listen for task created events from main process
    if (window.electronAPI?.onTaskCreated) {
      const cleanup = window.electronAPI.onTaskCreated(() => {
        console.log('🔔 Task created event received, refreshing sales tasks');
        // Auto-refresh tasks when new task is created from Slack
        loadTasks();
      });
      
      return cleanup;
    }
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

