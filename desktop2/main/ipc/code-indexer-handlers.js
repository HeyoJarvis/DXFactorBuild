/**
 * Code Indexer IPC Handlers
 * Connects desktop2 app to the Engineering Intelligence API for GitHub code querying
 */

const { ipcMain } = require('electron');
const fetch = require('node-fetch');

class CodeIndexerHandlers {
  constructor(logger) {
    this.logger = logger;
    this.API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';
  }

  /**
   * Setup all code indexer IPC handlers
   */
  setup() {
    // Query the codebase
    ipcMain.handle('codeIndexer:query', async (event, params) => {
      try {
        const { query, repository, context } = params;
        
        this.logger.info('🔍 Code indexer query', { 
          query: query.substring(0, 100),
          repository 
        });

        const response = await fetch(`${this.API_BASE_URL}/api/engineering/query`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            query,
            repository,
            context
          })
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || `HTTP ${response.status}`);
        }

        const data = await response.json();
        
        this.logger.info('✅ Code indexer query successful');
        
        return {
          success: true,
          data: data.result
        };

      } catch (error) {
        this.logger.error('❌ Code indexer query failed', { 
          error: error.message,
          stack: error.stack 
        });
        
        return {
          success: false,
          error: error.message
        };
      }
    });

    // List accessible GitHub repositories
    ipcMain.handle('codeIndexer:listRepositories', async (event, params = {}) => {
      try {
        const { org, affiliation, per_page, page, q } = params;
        
        this.logger.info('📚 Listing GitHub repositories');

        const queryParams = new URLSearchParams();
        if (org) queryParams.append('org', org);
        if (affiliation) queryParams.append('affiliation', affiliation);
        if (per_page) queryParams.append('per_page', per_page);
        if (page) queryParams.append('page', page);
        if (q) queryParams.append('q', q);

        const response = await fetch(
          `${this.API_BASE_URL}/api/engineering/repos?${queryParams}`,
          {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json'
            }
          }
        );

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || `HTTP ${response.status}`);
        }

        const data = await response.json();
        
        this.logger.info('✅ Listed repositories', { 
          count: data.count 
        });
        
        return {
          success: true,
          repositories: data.repositories,
          count: data.count,
          page: data.page,
          per_page: data.per_page
        };

      } catch (error) {
        this.logger.error('❌ Failed to list repositories', { 
          error: error.message 
        });
        
        return {
          success: false,
          error: error.message,
          repositories: []
        };
      }
    });

    // Get indexer status
    ipcMain.handle('codeIndexer:getStatus', async (event) => {
      try {
        // Check if GitHub token is configured
        const hasToken = !!process.env.GITHUB_TOKEN;
        
        return {
          success: true,
          available: hasToken,
          configured: hasToken,
          message: hasToken 
            ? 'Code Indexer is ready' 
            : 'GitHub token not configured'
        };
      } catch (error) {
        this.logger.error('❌ Failed to get indexer status', { 
          error: error.message 
        });
        
        return {
          success: false,
          available: false,
          error: error.message
        };
      }
    });

    // Check availability (same as status, for compatibility)
    ipcMain.handle('codeIndexer:checkAvailability', async (event) => {
      return this.setup.codeIndexer.getStatus(event);
    });

    this.logger.info('✅ Code Indexer handlers registered');
  }
}

module.exports = CodeIndexerHandlers;

