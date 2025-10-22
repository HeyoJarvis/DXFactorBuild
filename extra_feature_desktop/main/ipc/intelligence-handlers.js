/**
 * Intelligence IPC Handlers
 * Handles AI Q&A and context engine communication with multi-session support
 */

const { ipcMain } = require('electron');

function registerIntelligenceHandlers(services) {
  const { teamContextEngine, supabaseAdapter, codeIndexer, logger } = services;

  /**
   * Ask question with context filtering
   */
  ipcMain.handle('intelligence:ask', async (event, userId, question, options) => {
    try {
      const contextFilter = options?.contextFilter || {};
      
      logger.info('IPC: intelligence:ask', { 
        userId, 
        question: question.substring(0, 100),
        hasContextFilter: !!options?.contextFilter,
        meetingIds: contextFilter.meetingIds?.length || 0,
        taskIds: contextFilter.taskIds?.length || 0,
        repositories: contextFilter.repositories?.length || 0
      });

      // If context filter is provided, fetch filtered data
      let filteredContext = null;
      if (contextFilter.meetingIds?.length > 0 || contextFilter.taskIds?.length > 0) {
        filteredContext = await getFilteredContext(
          userId, 
          contextFilter, 
          supabaseAdapter, 
          logger
        );
      }

      // Query code indexer if repositories are selected
      let codeContext = null;
      if (contextFilter.repositories?.length > 0 && codeIndexer) {
        codeContext = await queryCodeContext(
          question,
          contextFilter.repositories,
          codeIndexer,
          logger
        );
      }

      // Merge contexts and ask question
      const enhancedOptions = {
        ...options,
        filteredContext,
        codeContext
      };

      return await teamContextEngine.askQuestion(userId, question, enhancedOptions);
    } catch (error) {
      logger.error('IPC Error: intelligence:ask', { error: error.message });
      return { success: false, error: error.message };
    }
  });

  /**
   * Clear conversation history (for a specific session if provided)
   */
  ipcMain.handle('intelligence:clearHistory', async (event, sessionId) => {
    try {
      logger.info('IPC: intelligence:clearHistory', { sessionId });
      
      if (sessionId) {
        // Session-specific history is managed by frontend
        return { success: true };
      }
      
      teamContextEngine.clearHistory();
      return { success: true };
    } catch (error) {
      logger.error('IPC Error: intelligence:clearHistory', { error: error.message });
      return { success: false, error: error.message };
    }
  });

  /**
   * Get conversation history (global or session-specific)
   */
  ipcMain.handle('intelligence:getHistory', async (event, sessionId) => {
    try {
      logger.info('IPC: intelligence:getHistory', { sessionId });
      
      if (sessionId) {
        // Session-specific history is managed by frontend
        return { success: true, history: [] };
      }
      
      const history = teamContextEngine.getHistory();
      return { success: true, history };
    } catch (error) {
      logger.error('IPC Error: intelligence:getHistory', { error: error.message });
      return { success: false, error: error.message };
    }
  });

  logger.info('Intelligence IPC handlers registered');
}

/**
 * Get filtered context based on selected IDs
 */
async function getFilteredContext(userId, contextFilter, supabaseAdapter, logger) {
  const context = {
    meetings: [],
    tasks: []
  };

  try {
    // Fetch selected meetings
    if (contextFilter.meetingIds?.length > 0) {
      const { data: meetings, error } = await supabaseAdapter.supabase
        .from('team_meetings')  // ✅ Fixed: Use team_meetings, not meeting_summaries
        .select('*')
        .in('id', contextFilter.meetingIds)
        .eq('user_id', userId);
      
      if (!error && meetings) {
        context.meetings = meetings;
        logger.info('Fetched filtered meetings', { count: meetings.length });
      } else if (error) {
        logger.warn('Failed to fetch meetings', { error: error.message });
      }
    }

    // Fetch selected tasks
    if (contextFilter.taskIds?.length > 0) {
      const { data: tasks, error } = await supabaseAdapter.supabase
        .from('team_updates')
        .select('*')
        .in('id', contextFilter.taskIds)
        .eq('user_id', userId);
      
      if (!error && tasks) {
        context.tasks = tasks;
        logger.info('Fetched filtered tasks', { count: tasks.length });
      }
    }

    return context;
  } catch (error) {
    logger.error('Failed to fetch filtered context', { error: error.message });
    return context;
  }
}

/**
 * Query code context from selected repositories
 */
async function queryCodeContext(question, repositories, codeIndexer, logger) {
  try {
    // Query the first repository (can be extended to query multiple)
    if (repositories.length > 0) {
      const repo = repositories[0];
      
      // Normalize owner - could be string or object
      const ownerName = typeof repo.owner === 'object' ? repo.owner.login : repo.owner;
      const repoName = repo.name;
      
      logger.info('Querying code context', { 
        owner: ownerName, 
        repo: repoName 
      });

      // Check if repository is indexed
      const status = await codeIndexer.vectorStore.getIndexingStatus(
        ownerName, 
        repoName, 
        'main'
      );

      // If not indexed or failed, trigger indexing
      if (!status || status.status === 'failed' || status.status === 'pending') {
        logger.info('Repository not indexed, triggering auto-indexing', {
          owner: ownerName,
          repo: repoName,
          currentStatus: status?.status || 'not found'
        });

        // Trigger indexing (non-blocking)
        codeIndexer.indexRepository(ownerName, repoName, 'main')
          .then(result => {
            logger.info('Auto-indexing completed', {
              owner: ownerName,
              repo: repoName,
              chunks: result.chunks
            });
          })
          .catch(err => {
            logger.error('Auto-indexing failed', {
              owner: ownerName,
              repo: repoName,
              error: err.message
            });
          });

        return {
          answer: `The repository ${ownerName}/${repoName} is being indexed for the first time. This will take a few minutes. You can ask questions about the code once indexing is complete.`,
          sources: [],
          indexing: true
        };
      }

      // If currently indexing, inform user
      if (status.status === 'in_progress') {
        const progress = status.progress_percentage || 0;
        return {
          answer: `The repository ${ownerName}/${repoName} is currently being indexed (${progress}% complete). Please wait a moment and try again.`,
          sources: [],
          indexing: true
        };
      }

      // Repository is indexed, query it
      const result = await codeIndexer.queryEngine.query(question, {
        repositoryOwner: ownerName,
        repositoryName: repoName,
        searchLimit: 15  // ✅ Fixed: Use correct parameter name + increased from 5 to 15
      });

      if (result) {
        logger.info('Code context retrieved', { 
          chunkCount: result.sources?.length || 0,  // ✅ Fixed: Use 'sources' not 'chunks'
          confidence: result.confidence
        });
        
        // If no sources found, provide helpful message
        if (!result.sources || result.sources.length === 0) {
          return {
            answer: result.answer || `No relevant code found in ${ownerName}/${repoName} for this question. The repository has ${status.indexed_chunks} code chunks indexed. Try asking a more specific question about the codebase.`,
            sources: [],
            noResults: true
          };
        }
        
        return {
          answer: result.answer,
          sources: result.sources.map(source => ({  // ✅ Fixed: Use 'sources' not 'chunks'
            type: 'code',
            file: source.filePath,
            content: source.chunkName || source.chunkType,
            repository: `${ownerName}/${repoName}`,
            similarity: source.similarity
          }))
        };
      }
    }
  } catch (error) {
    logger.warn('Failed to query code context', { error: error.message });
  }
  
  return null;
}

module.exports = { registerIntelligenceHandlers };


