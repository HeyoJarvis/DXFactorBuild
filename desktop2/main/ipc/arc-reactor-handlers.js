/**
 * Arc Reactor IPC Handlers
 * Handles role switching and system state management for the Arc Reactor UI
 */

const { ipcMain } = require('electron');

/**
 * Register all Arc Reactor IPC handlers
 * @param {Object} services - Application services
 * @param {Object} logger - Winston logger instance
 */
function registerArcReactorHandlers(services, logger) {
  /**
   * Set user role (developer/sales)
   */
  ipcMain.handle('system:setRole', async (event, role) => {
    try {
      logger.info('Setting user role', { role });

      if (role !== 'developer' && role !== 'sales') {
        throw new Error(`Invalid role: ${role}`);
      }

      // Store role in services for future use
      if (!services.state) {
        services.state = {};
      }
      services.state.currentRole = role;

      // You could also persist this to database or electron-store if needed
      // For now, it's stored in localStorage on the frontend

      logger.info('✅ User role updated', { role });

      return {
        success: true,
        role
      };
    } catch (error) {
      logger.error('Failed to set role', { error: error.message, role });
      return {
        success: false,
        error: error.message
      };
    }
  });

  /**
   * Get current user role
   */
  ipcMain.handle('system:getRole', async (event) => {
    try {
      const role = services.state?.currentRole || 'developer';

      return {
        success: true,
        role
      };
    } catch (error) {
      logger.error('Failed to get role', { error: error.message });
      return {
        success: false,
        error: error.message,
        role: 'developer' // Fallback
      };
    }
  });

  /**
   * Get Arc Reactor menu items based on role
   */
  ipcMain.handle('arcReactor:getMenuItems', async (event, role = 'developer') => {
    try {
      const menuItemsByRole = {
        developer: [
          { id: 'chat', label: 'AI Copilot', icon: '💬', route: '/copilot' },
          { id: 'tasks', label: 'Dev Tasks', icon: '📋', route: '/tasks' },
          { id: 'code', label: 'Code Indexer', icon: '🔍', route: '/code' },
          { id: 'github', label: 'GitHub', icon: '🐙', route: '/github' }
        ],
        sales: [
          { id: 'chat', label: 'AI Copilot', icon: '💬', route: '/copilot' },
          { id: 'tasks', label: 'Sales Tasks', icon: '📋', route: '/tasks' },
          { id: 'crm', label: 'CRM Dashboard', icon: '📊', route: '/crm' },
          { id: 'deals', label: 'Deals', icon: '💰', route: '/deals' }
        ]
      };

      const menuItems = menuItemsByRole[role] || menuItemsByRole.developer;

      return {
        success: true,
        menuItems
      };
    } catch (error) {
      logger.error('Failed to get menu items', { error: error.message, role });
      return {
        success: false,
        error: error.message,
        menuItems: []
      };
    }
  });

  logger.info('✅ Arc Reactor IPC handlers registered');
}

module.exports = registerArcReactorHandlers;



