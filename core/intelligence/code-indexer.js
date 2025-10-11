/**
 * Code Indexer Orchestrator
 * 
 * Main orchestrator that coordinates repository indexing workflow.
 * Manages the complete pipeline from fetching code to storing embeddings.
 * 
 * Features:
 * 1. Orchestrate complete indexing workflow
 * 2. Progress tracking and status updates
 * 3. Error handling and recovery
 * 4. Event emission for real-time updates
 * 5. Support for batch and incremental indexing
 */

const winston = require('winston');
const EventEmitter = require('events');
const RepositoryFileFetcher = require('./repository-file-fetcher');
const CodeChunker = require('./code-chunker');
const EmbeddingService = require('./embedding-service');
const CodeVectorStore = require('../../data/storage/code-vector-store');
const CodeQueryEngine = require('./code-query-engine');

class CodeIndexer extends EventEmitter {
  constructor(options = {}) {
    super();

    this.options = {
      logLevel: options.logLevel || 'info',
      batchSize: options.batchSize || 50,
      ...options
    };

    this.logger = winston.createLogger({
      level: this.options.logLevel,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'logs/code-indexer.log' })
      ],
      defaultMeta: { service: 'code-indexer' }
    });

    // Initialize services
    this.fileFetcher = new RepositoryFileFetcher({
      logLevel: this.options.logLevel
    });

    this.chunker = new CodeChunker({
      logLevel: this.options.logLevel
    });

    this.embeddingService = new EmbeddingService({
      logLevel: this.options.logLevel
    });

    this.vectorStore = new CodeVectorStore({
      logLevel: this.options.logLevel
    });

    this.queryEngine = new CodeQueryEngine({
      logLevel: this.options.logLevel
    });

    // Track current indexing jobs
    this.activeJobs = new Map();

    this.logger.info('Code Indexer initialized');
  }

  /**
   * Get job status
   * @param {string} jobId - Job identifier
   * @returns {Object} Job status
   */
  getJobStatus(jobId) {
    return this.activeJobs.get(jobId) || null;
  }

  /**
   * Check if repository is currently being indexed
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @returns {boolean}
   */
  isIndexing(owner, repo) {
    const jobId = `${owner}/${repo}`;
    const job = this.activeJobs.get(jobId);
    return job && job.status === 'in_progress';
  }

  /**
   * Index a repository
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @param {string} branch - Branch name (default: main)
   * @returns {Promise<Object>} Indexing result
   */
  async indexRepository(owner, repo, branch = 'main') {
    const jobId = `${owner}/${repo}`;
    const startTime = Date.now();

    // Check if already indexing
    if (this.isIndexing(owner, repo)) {
      throw new Error(`Repository ${jobId} is already being indexed`);
    }

    this.logger.info('Starting repository indexing', { owner, repo, branch });

    // Initialize job tracking
    const job = {
      id: jobId,
      owner,
      repo,
      branch,
      status: 'in_progress',
      phase: 'initializing',
      progress: 0,
      startTime,
      stats: {
        files: 0,
        chunks: 0,
        embeddings: 0
      }
    };

    this.activeJobs.set(jobId, job);
    this.emit('indexing:started', job);

    try {
      // Phase 1: Initialize status in database
      job.phase = 'initializing';
      this.emit('indexing:progress', job);
      
      await this.vectorStore.initializeIndexingStatus(owner, repo, branch);

      // Phase 2: Fetch repository files
      job.phase = 'fetching';
      job.progress = 10;
      this.emit('indexing:progress', job);
      
      this.logger.info('Fetching repository files', { owner, repo, branch });
      const repoData = await this.fileFetcher.fetchRepository(owner, repo, branch);
      
      if (repoData.files.length === 0) {
        throw new Error('No code files found in repository');
      }

      job.stats.files = repoData.files.length;
      this.emit('indexing:progress', job);

      await this.vectorStore.updateIndexingStatus(owner, repo, branch, {
        total_files: repoData.files.length
      });

      // Phase 3: Chunk code files
      job.phase = 'chunking';
      job.progress = 30;
      this.emit('indexing:progress', job);
      
      this.logger.info('Chunking code files', { owner, repo, fileCount: repoData.files.length });
      const chunks = this.chunker.chunkFiles(repoData.files);
      
      job.stats.chunks = chunks.length;
      this.emit('indexing:progress', job);

      await this.vectorStore.updateIndexingStatus(owner, repo, branch, {
        total_chunks: chunks.length
      });

      // Phase 4: Generate embeddings
      job.phase = 'embedding';
      job.progress = 50;
      this.emit('indexing:progress', job);
      
      this.logger.info('Generating embeddings', { owner, repo, chunkCount: chunks.length });
      const embeddedChunks = await this.embeddingService.embedChunks(chunks);
      
      job.stats.embeddings = embeddedChunks.length;
      this.emit('indexing:progress', job);

      // Phase 5: Store in vector database
      job.phase = 'storing';
      job.progress = 75;
      this.emit('indexing:progress', job);
      
      this.logger.info('Storing chunks in vector database', { owner, repo, chunkCount: embeddedChunks.length });
      
      // Delete existing chunks first (for re-indexing)
      await this.vectorStore.deleteRepositoryChunks(owner, repo, branch);
      
      // Store new chunks
      const storeResults = await this.vectorStore.storeChunks(embeddedChunks, owner, repo, branch);
      
      this.emit('indexing:progress', job);

      // Phase 6: Finalize
      job.phase = 'finalizing';
      job.progress = 95;
      this.emit('indexing:progress', job);
      
      const duration = Date.now() - startTime;

      await this.vectorStore.updateIndexingStatus(owner, repo, branch, {
        status: 'completed',
        indexed_files: repoData.files.length,
        indexed_chunks: storeResults.successful,
        progress_percentage: 100,
        completed_at: new Date().toISOString(),
        duration_ms: duration
      });

      // Complete job
      job.status = 'completed';
      job.progress = 100;
      job.duration = duration;
      job.result = {
        files: repoData.files.length,
        chunks: chunks.length,
        embeddings: embeddedChunks.length,
        stored: storeResults.successful,
        failed: storeResults.failed,
        duration
      };

      this.activeJobs.set(jobId, job);
      this.emit('indexing:completed', job);

      this.logger.info('Repository indexing completed', {
        owner,
        repo,
        branch,
        duration,
        ...job.result
      });

      return job.result;

    } catch (error) {
      const duration = Date.now() - startTime;

      this.logger.error('Repository indexing failed', {
        owner,
        repo,
        branch,
        error: error.message,
        stack: error.stack,
        duration
      });

      // Update database status
      await this.vectorStore.updateIndexingStatus(owner, repo, branch, {
        status: 'failed',
        error_message: error.message
      }).catch(err => {
        this.logger.error('Failed to update error status', { error: err.message });
      });

      // Update job
      job.status = 'failed';
      job.error = error.message;
      job.duration = duration;
      this.activeJobs.set(jobId, job);
      this.emit('indexing:failed', job);

      throw error;
    }
  }

  /**
   * Index multiple repositories in sequence
   * @param {Array<Object>} repositories - Array of {owner, repo, branch}
   * @returns {Promise<Array>} Array of indexing results
   */
  async indexRepositories(repositories) {
    this.logger.info('Batch indexing repositories', {
      count: repositories.length
    });

    const results = [];

    for (const { owner, repo, branch = 'main' } of repositories) {
      try {
        const result = await this.indexRepository(owner, repo, branch);
        results.push({ owner, repo, branch, success: true, ...result });
      } catch (error) {
        this.logger.error('Batch indexing item failed', {
          owner,
          repo,
          error: error.message
        });
        results.push({
          owner,
          repo,
          branch,
          success: false,
          error: error.message
        });
      }
    }

    return results;
  }

  /**
   * Query indexed code
   * @param {string} question - Natural language question
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Query result
   */
  async query(question, options = {}) {
    return this.queryEngine.query(question, options);
  }

  /**
   * List all indexed repositories
   * @returns {Promise<Array>} List of repositories
   */
  async listIndexedRepositories() {
    return this.vectorStore.listIndexedRepositories();
  }

  /**
   * Get indexing status for a repository
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @param {string} branch - Branch name
   * @returns {Promise<Object>} Status
   */
  async getIndexingStatus(owner, repo, branch = 'main') {
    // Check active jobs first
    const jobId = `${owner}/${repo}`;
    const activeJob = this.activeJobs.get(jobId);
    
    if (activeJob && activeJob.status === 'in_progress') {
      return {
        status: 'in_progress',
        phase: activeJob.phase,
        progress: activeJob.progress,
        stats: activeJob.stats,
        startTime: activeJob.startTime
      };
    }

    // Check database
    const dbStatus = await this.vectorStore.getIndexingStatus(owner, repo, branch);
    
    if (!dbStatus) {
      return {
        status: 'not_indexed',
        message: 'This repository has not been indexed yet'
      };
    }

    return dbStatus;
  }

  /**
   * Check if code indexer is available and configured
   * @returns {Promise<Object>} Availability status
   */
  async checkAvailability() {
    const checks = {
      github: false,
      openai: false,
      anthropic: false,
      supabase: false,
      overall: false
    };

    try {
      // Check GitHub
      checks.github = !!(process.env.GITHUB_APP_ID && 
                        process.env.GITHUB_APP_INSTALLATION_ID && 
                        (process.env.GITHUB_APP_PRIVATE_KEY_PATH || process.env.GITHUB_APP_PRIVATE_KEY));

      // Check OpenAI
      checks.openai = !!process.env.OPENAI_API_KEY;

      // Check Anthropic
      checks.anthropic = !!process.env.ANTHROPIC_API_KEY;

      // Check Supabase
      checks.supabase = !!(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY);

      // Overall availability
      checks.overall = checks.github && checks.openai && checks.anthropic && checks.supabase;

      return checks;

    } catch (error) {
      this.logger.error('Availability check failed', { error: error.message });
      return { ...checks, error: error.message };
    }
  }

  /**
   * Get service statistics
   * @returns {Object} Statistics
   */
  getStats() {
    return {
      embedding: this.embeddingService.getStats(),
      query: this.queryEngine.getStats(),
      activeJobs: Array.from(this.activeJobs.values())
    };
  }
}

module.exports = CodeIndexer;

