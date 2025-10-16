/**
 * Task IPC Handlers
 * Handles all task-related IPC communication via Supabase
 * Uses conversation_sessions table with workflow_type='task'
 */

const { ipcMain } = require('electron');
const SupabaseAdapter = require('../services/SupabaseAdapter');

// Initialize Supabase adapter
const dbAdapter = new SupabaseAdapter({ useServiceRole: true });

function registerTaskHandlers(services, logger) {
  /**
   * Create a new task in Supabase
   */
  ipcMain.handle('tasks:create', async (event, taskData) => {
    try {
      // Get current user ID from auth service
      const userId = services.auth?.currentUser?.id;
      
      if (!userId) {
        return {
          success: false,
          error: 'User not authenticated'
        };
      }
      
      const result = await dbAdapter.createTask(userId, taskData);
      
      if (!result.success) {
        throw new Error(result.error);
      }

      logger.info('Task created', { taskId: result.task.id });

      return {
        success: true,
        data: {
          id: result.task.id,
          title: result.task.session_title,
          priority: result.task.workflow_metadata?.priority || 'medium',
          status: result.task.is_completed ? 'completed' : 'todo',
          createdAt: result.task.started_at
        }
      };
    } catch (error) {
      logger.error('Task create error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });

  /**
   * Get all tasks from Supabase
   */
  ipcMain.handle('tasks:getAll', async (event, filters = {}) => {
    try {
      // Get current user ID from auth service
      const userId = services.auth?.currentUser?.id;
      
      logger.info('Fetching tasks', { 
        userId,
        isAuthenticated: !!userId,
        filters 
      });
      
      if (!userId) {
        logger.warn('Cannot fetch tasks: No authenticated user');
        return {
          success: false,
          error: 'User not authenticated',
          tasks: []
        };
      }
      
      const result = await dbAdapter.getUserTasks(userId, { 
        includeCompleted: false,
        ...filters
      });

      if (!result.success) {
        logger.error('Failed to fetch tasks', { error: result.error });
        throw new Error(result.error);
      }

      logger.info('Tasks fetched successfully', { 
        count: result.tasks.length,
        userId 
      });

      return {
        success: true,
        tasks: result.tasks
      };
    } catch (error) {
      logger.error('Task getAll error:', error);
      return {
        success: false,
        error: error.message,
        tasks: []
      };
    }
  });

  /**
   * Update a task in Supabase
   */
  ipcMain.handle('tasks:update', async (event, { taskId, updates }) => {
    try {
      const result = await dbAdapter.updateTask(taskId, updates);

      if (!result.success) {
        throw new Error(result.error);
      }

      logger.info('Task updated', { taskId });

      return {
        success: true,
        data: {
          id: result.task.id,
          title: result.task.session_title,
          priority: result.task.workflow_metadata?.priority,
          status: result.task.is_completed ? 'completed' : 'todo',
          updatedAt: result.task.last_activity_at
        }
      };
    } catch (error) {
      logger.error('Task update error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });

  /**
   * Delete a task from Supabase
   */
  ipcMain.handle('tasks:delete', async (event, taskId) => {
    try {
      const result = await dbAdapter.deleteTask(taskId);

      if (!result.success) {
        throw new Error(result.error);
      }

      logger.info('Task deleted', { taskId });

      return {
        success: true
      };
    } catch (error) {
      logger.error('Task delete error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });

  /**
   * Get task statistics
   */
  ipcMain.handle('tasks:getStats', async () => {
    try {
      const result = await dbAdapter.getTaskStats(userId);

      if (!result.success) {
        throw new Error(result.error);
      }

      logger.info('Task stats fetched');

      return result;
    } catch (error) {
      logger.error('Task stats error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });

  logger.info('Task handlers registered (Supabase conversation_sessions)');
}

module.exports = registerTaskHandlers;

