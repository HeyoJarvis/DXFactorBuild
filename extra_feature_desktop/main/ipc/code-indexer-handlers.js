/**
 * Code Indexer IPC Handlers
 * Connects the Code Indexer to the frontend
 */

const { ipcMain } = require('electron');

function registerCodeIndexerHandlers(services) {
  const { logger, codeIndexer } = services;

  /**
   * Setup all code indexer IPC handlers
   */
  // Index a repository
  ipcMain.handle('codeIndexer:indexRepository', async (event, params) => {
    try {
      const { owner, repo, branch = 'main' } = params;
      
      logger.info('🔄 Starting repository indexing', { owner, repo, branch });

      const result = await codeIndexer.indexRepository(owner, repo, branch);
      
      logger.info('✅ Repository indexed successfully', { 
        owner, 
        repo,
        chunks: result.chunks
      });
      
      return {
        success: true,
        result
      };

    } catch (error) {
      logger.error('❌ Repository indexing failed', { 
        error: error.message,
        stack: error.stack 
      });
      
      return {
        success: false,
        error: error.message
      };
    }
  });

  // Query the codebase
  ipcMain.handle('codeIndexer:query', async (event, params) => {
    try {
      const { query, owner, repo } = params;
      
      logger.info('🔍 Code indexer query', { 
        query: query.substring(0, 100),
        owner,
        repo
      });

      const result = await codeIndexer.queryEngine.query(query, {
        repositoryOwner: owner,
        repositoryName: repo
      });
      
      logger.info('✅ Code query successful');
      
      return {
        success: true,
        data: result
      };

    } catch (error) {
      logger.error('❌ Code query failed', { 
        error: error.message,
        stack: error.stack 
      });
      
      return {
        success: false,
        error: error.message
      };
    }
  });

  // Get indexing status for a repository
  ipcMain.handle('codeIndexer:getStatus', async (event, params) => {
    try {
      const { owner, repo, branch = 'main' } = params;
      
      const status = await codeIndexer.vectorStore.getIndexingStatus(owner, repo, branch);
      
      return {
        success: true,
        status
      };
    } catch (error) {
      logger.error('❌ Failed to get indexer status', { 
        error: error.message 
      });
      
      return {
        success: false,
        error: error.message
      };
    }
  });

  // Check if code indexer is configured
  ipcMain.handle('codeIndexer:checkAvailability', async (event) => {
    try {
      const hasGitHub = !!(process.env.GITHUB_APP_ID && 
                         process.env.GITHUB_APP_INSTALLATION_ID && 
                         process.env.GITHUB_APP_PRIVATE_KEY_PATH);
      const hasOpenAI = !!process.env.OPENAI_API_KEY;
      const hasAnthropic = !!process.env.ANTHROPIC_API_KEY;
      const hasSupabase = !!(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY);
      
      const available = hasGitHub && hasOpenAI && hasAnthropic && hasSupabase;
      
      return {
        success: true,
        available,
        configured: {
          github: hasGitHub,
          openai: hasOpenAI,
          anthropic: hasAnthropic,
          supabase: hasSupabase
        },
        message: available 
          ? 'Code Indexer is ready' 
          : 'Missing required configuration'
      };
    } catch (error) {
      logger.error('❌ Failed to check availability', { 
        error: error.message 
      });
      
      return {
        success: false,
        available: false,
        error: error.message
      };
    }
  });

  // Get job status (for progress tracking)
  ipcMain.handle('codeIndexer:getJobStatus', async (event, params) => {
    try {
      const { owner, repo } = params;
      const jobId = `${owner}/${repo}`;
      
      const job = codeIndexer.getJobStatus(jobId);
      
      return {
        success: true,
        job
      };
    } catch (error) {
      logger.error('❌ Failed to get job status', { 
        error: error.message 
      });
      
      return {
        success: false,
        error: error.message
      };
    }
  });

  logger.info('✅ Code Indexer IPC handlers registered');
}

module.exports = { registerCodeIndexerHandlers };

