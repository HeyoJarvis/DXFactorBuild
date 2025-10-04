/**
 * useTasks Hook
 * Manages tasks via Electron IPC (which connects to Supabase/local storage)
 */

import { useState, useEffect, useCallback } from 'react';

export function useTasks() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  /**
   * Load all tasks from backend
   */
  const loadTasks = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await window.electronAPI.tasks.getAll();

      if (response.success) {
        // Backend returns tasks array directly
        setTasks(response.tasks || []);
      } else {
        throw new Error(response.error || 'Failed to load tasks');
      }
    } catch (err) {
      console.error('Load tasks error:', err);
      setError(err.message);
      setTasks([]); // Set empty array on error
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Create a new task
   */
  const addTask = useCallback(async (taskData) => {
    try {
      const response = await window.electronAPI.tasks.create(taskData);

      if (response.success) {
        // Reload tasks to get fresh data from backend
        await loadTasks();
        return response.data;
      } else {
        throw new Error(response.error || 'Failed to create task');
      }
    } catch (err) {
      console.error('Add task error:', err);
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

