/**
 * Code Indexer IPC Handlers
 * Connects desktop2 app to the Engineering Intelligence API for GitHub code querying
 * Includes semantic parsing for intelligent query understanding
 */

const { ipcMain } = require('electron');
const fetch = require('node-fetch');
const SemanticParserService = require('../services/SemanticParserService');

class CodeIndexerHandlers {
  constructor(logger) {
    this.logger = logger;
    this.API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';
    this.semanticParser = new SemanticParserService(logger);
  }

  /**
   * Setup all code indexer IPC handlers
   */
  setup() {
    // Parse semantic intent (new handler)
    ipcMain.handle('codeIndexer:parseIntent', async (_event, params) => {
      try {
        const { query, repository, context } = params;

        this.logger.info('🧠 Parsing semantic intent', {
          query: query.substring(0, 100),
          repository
        });

        const understanding = await this.semanticParser.parseIntent({
          query,
          repository: `${repository.owner}/${repository.repo}`,
          ticketKey: context?.ticket?.key,
          ticketSummary: context?.ticket?.summary,
          ticketDescription: context?.ticket?.description,
          language: context?.language,
          recentFiles: context?.recentFiles
        });

        return understanding;

      } catch (error) {
        this.logger.error('❌ Failed to parse intent', {
          error: error.message
        });

        return {
          success: false,
          error: error.message
        };
      }
    });

    // Query the codebase (enhanced with optional semantic parsing)
    ipcMain.handle('codeIndexer:query', async (_event, params) => {
      try {
        const { query, repository, context, useSemanticParsing = true } = params;

        this.logger.info('🔍 Code indexer query', {
          query: query.substring(0, 100),
          repository,
          useSemanticParsing
        });

        let enrichedContext = context;

        // Optionally enrich with semantic understanding
        if (useSemanticParsing) {
          try {
            const enriched = await this.semanticParser.enrichQuery(
              query,
              `${repository.owner}/${repository.repo}`,
              context
            );

            if (enriched.semanticUnderstanding) {
              enrichedContext = enriched.context;
              this.logger.info('✨ Query enriched with semantic understanding', {
                capabilities: enrichedContext.capabilities,
                confidence: enrichedContext.confidence
              });
            }
          } catch (semanticError) {
            // Log but don't fail - continue with original context
            this.logger.warn('⚠️ Semantic parsing failed, continuing without enrichment', {
              error: semanticError.message
            });
          }
        }

        const response = await fetch(`${this.API_BASE_URL}/api/engineering/query`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            query,
            repository,
            context: enrichedContext
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
          data: data.result,
          semanticContext: enrichedContext
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
        // Check if GitHub App is configured (primary method)
        const hasGithubApp = !!(
          process.env.GITHUB_APP_ID &&
          process.env.GITHUB_APP_INSTALLATION_ID &&
          (process.env.GITHUB_APP_PRIVATE_KEY_PATH || process.env.GITHUB_APP_PRIVATE_KEY)
        );

        // Check if GitHub Token is configured (fallback)
        const hasToken = !!process.env.GITHUB_TOKEN;

        const isConfigured = hasGithubApp || hasToken;

        return {
          success: true,
          available: isConfigured,
          configured: isConfigured,
          authMethod: hasGithubApp ? 'GitHub App' : hasToken ? 'Personal Token' : 'None',
          message: isConfigured
            ? `Code Indexer is ready (using ${hasGithubApp ? 'GitHub App' : 'Personal Token'})`
            : 'GitHub not configured - please set up GitHub App credentials'
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

    // Index a repository
    ipcMain.handle('codeIndexer:indexRepository', async (event, params) => {
      try {
        const { owner, repo, branch = 'main' } = params;

        if (!owner || !repo) {
          throw new Error('Owner and repo are required');
        }

        this.logger.info('🔨 Starting repository indexing', {
          owner,
          repo,
          branch
        });

        const response = await fetch(`${this.API_BASE_URL}/api/engineering/index`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            owner,
            repo,
            branch
          })
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || `HTTP ${response.status}`);
        }

        const data = await response.json();

        this.logger.info('✅ Repository indexing started', {
          repository: data.repository,
          jobId: data.jobId
        });

        return {
          success: true,
          message: data.message,
          repository: data.repository,
          jobId: data.jobId
        };

      } catch (error) {
        this.logger.error('❌ Failed to start repository indexing', {
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
    ipcMain.handle('codeIndexer:getIndexingStatus', async (event, params) => {
      try {
        const { owner, repo, branch = 'main' } = params;

        if (!owner || !repo) {
          throw new Error('Owner and repo are required');
        }

        this.logger.info('📊 Getting indexing status', { owner, repo, branch });

        const queryParams = new URLSearchParams({ owner, repo, branch });
        const response = await fetch(
          `${this.API_BASE_URL}/api/engineering/index/status?${queryParams}`,
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

        this.logger.info('✅ Got indexing status', {
          status: data.status,
          progress: data.progress
        });

        return {
          success: true,
          status: data
        };

      } catch (error) {
        this.logger.error('❌ Failed to get indexing status', {
          error: error.message
        });

        return {
          success: false,
          error: error.message
        };
      }
    });

    this.logger.info('✅ Code Indexer handlers registered');
  }
}

module.exports = CodeIndexerHandlers;

