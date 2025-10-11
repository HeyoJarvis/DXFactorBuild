/**
 * Code Vector Store
 * 
 * Manages storage and retrieval of code embeddings in Supabase pgvector.
 * Provides semantic search capabilities over code chunks.
 * 
 * Features:
 * 1. Store code chunks with embeddings
 * 2. Semantic similarity search
 * 3. Repository indexing status tracking
 * 4. Batch insert operations
 * 5. Index management
 */

const winston = require('winston');
const { createClient } = require('@supabase/supabase-js');

class CodeVectorStore {
  constructor(options = {}) {
    this.options = {
      logLevel: options.logLevel || 'info',
      batchSize: options.batchSize || 100,
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
        new winston.transports.File({ filename: 'logs/vector-store.log' })
      ],
      defaultMeta: { service: 'vector-store' }
    });

    // Initialize Supabase client directly
    this.supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY
    );

    this.logger.info('Code Vector Store initialized');
  }

  /**
   * Store a single code chunk with embedding
   * @param {Object} chunk - Chunk object with embedding
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @param {string} branch - Branch name
   * @returns {Promise<Object>} Inserted chunk
   */
  async storeChunk(chunk, owner, repo, branch = 'main') {
    try {
      const { data, error } = await this.supabase
        .from('code_chunks')
        .insert({
          repository_owner: owner,
          repository_name: repo,
          repository_branch: branch,
          file_path: chunk.filePath,
          file_language: chunk.language,
          chunk_content: chunk.content,
          chunk_type: chunk.type,
          chunk_name: chunk.name,
          chunk_index: chunk.chunkIndex,
          total_chunks: chunk.totalChunks,
          start_line: chunk.startLine,
          token_count: chunk.tokens,
          embedding: chunk.embedding,
          metadata: {
            indexedAt: new Date().toISOString()
          }
        })
        .select()
        .single();

      if (error) throw error;

      return data;

    } catch (error) {
      this.logger.error('Failed to store chunk', {
        owner,
        repo,
        filePath: chunk.filePath,
        error: error.message
      });
      throw new Error(`Failed to store chunk: ${error.message}`);
    }
  }

  /**
   * Store multiple chunks in batches
   * @param {Array} chunks - Array of chunk objects with embeddings
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @param {string} branch - Branch name
   * @returns {Promise<Object>} Insert results
   */
  async storeChunks(chunks, owner, repo, branch = 'main') {
    this.logger.info('Storing chunks in batches', {
      owner,
      repo,
      totalChunks: chunks.length,
      batchSize: this.options.batchSize
    });

    const results = {
      successful: 0,
      failed: 0,
      errors: []
    };

    // Process in batches
    for (let i = 0; i < chunks.length; i += this.options.batchSize) {
      const batch = chunks.slice(i, i + this.options.batchSize);
      
      const records = batch.map(chunk => ({
        repository_owner: owner,
        repository_name: repo,
        repository_branch: branch,
        file_path: chunk.filePath,
        file_language: chunk.language,
        chunk_content: chunk.content,
        chunk_type: chunk.type,
        chunk_name: chunk.name,
        chunk_index: chunk.chunkIndex,
        total_chunks: chunk.totalChunks,
        start_line: chunk.startLine,
        token_count: chunk.tokens,
        embedding: JSON.stringify(chunk.embedding), // Supabase requires stringified arrays for vector type
        metadata: {}
      }));

      try {
        const { error } = await this.supabase
          .from('code_chunks')
          .insert(records);

        if (error) throw error;

        results.successful += batch.length;

        this.logger.debug('Batch stored', {
          batchNumber: Math.floor(i / this.options.batchSize) + 1,
          chunksInBatch: batch.length
        });

      } catch (error) {
        results.failed += batch.length;
        results.errors.push(error.message);
        
        this.logger.error('Batch storage failed', {
          batchNumber: Math.floor(i / this.options.batchSize) + 1,
          error: error.message
        });
      }
    }

    this.logger.info('Chunks stored', {
      owner,
      repo,
      successful: results.successful,
      failed: results.failed
    });

    return results;
  }

  /**
   * Search code chunks by semantic similarity
   * @param {Array} queryEmbedding - Query embedding vector
   * @param {Object} options - Search options
   * @returns {Promise<Array>} Matching chunks with similarity scores
   */
  async searchChunks(queryEmbedding, options = {}) {
    const {
      owner = null,
      repo = null,
      language = null,
      threshold = 0.5,
      limit = 10
    } = options;

    try {
      this.logger.debug('Searching chunks', {
        owner,
        repo,
        language,
        threshold,
        limit
      });

      const { data, error } = await this.supabase
        .rpc('search_code_chunks', {
          query_embedding: JSON.stringify(queryEmbedding),
          match_threshold: threshold,
          match_count: limit,
          filter_owner: owner,
          filter_repo: repo,
          filter_language: language
        });

      if (error) throw error;

      this.logger.debug('Search completed', {
        resultsCount: data.length
      });

      return data;

    } catch (error) {
      this.logger.error('Search failed', {
        owner,
        repo,
        error: error.message
      });
      throw new Error(`Search failed: ${error.message}`);
    }
  }

  /**
   * Initialize indexing status for a repository
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @param {string} branch - Branch name
   * @param {number} totalFiles - Total files to index
   * @returns {Promise<Object>} Status record
   */
  async initializeIndexingStatus(owner, repo, branch = 'main', totalFiles = 0) {
    try {
      const { data, error} = await this.supabase
        .from('code_indexing_status')
        .upsert({
          repository_owner: owner,
          repository_name: repo,
          repository_branch: branch,
          status: 'in_progress',
          total_files: totalFiles,
          indexed_files: 0,
          total_chunks: 0,
          indexed_chunks: 0,
          progress_percentage: 0,
          started_at: new Date().toISOString()
        }, {
          onConflict: 'repository_owner,repository_name,repository_branch'
        })
        .select()
        .single();

      if (error) throw error;

      return data;

    } catch (error) {
      this.logger.error('Failed to initialize indexing status', {
        owner,
        repo,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Update indexing status
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @param {string} branch - Branch name
   * @param {Object} updates - Status updates
   * @returns {Promise<Object>} Updated status
   */
  async updateIndexingStatus(owner, repo, branch = 'main', updates = {}) {
    try {
      const { data, error } = await this.supabase
        .from('code_indexing_status')
        .update(updates)
        .eq('repository_owner', owner)
        .eq('repository_name', repo)
        .eq('repository_branch', branch)
        .select()
        .single();

      if (error) throw error;

      return data;

    } catch (error) {
      this.logger.error('Failed to update indexing status', {
        owner,
        repo,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get indexing status for a repository
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @param {string} branch - Branch name
   * @returns {Promise<Object>} Status record
   */
  async getIndexingStatus(owner, repo, branch = 'main') {
    try {
      const { data, error } = await this.supabase
        .from('code_indexing_status')
        .select('*')
        .eq('repository_owner', owner)
        .eq('repository_name', repo)
        .eq('repository_branch', branch)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = not found
        throw error;
      }

      return data;

    } catch (error) {
      this.logger.error('Failed to get indexing status', {
        owner,
        repo,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * List all indexed repositories
   * @returns {Promise<Array>} List of indexed repositories
   */
  async listIndexedRepositories() {
    try {
      const { data, error } = await this.supabase
        .from('code_indexing_status')
        .select('*')
        .order('updated_at', { ascending: false });

      if (error) throw error;

      return data;

    } catch (error) {
      this.logger.error('Failed to list indexed repositories', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Delete all chunks for a repository
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @param {string} branch - Branch name
   * @returns {Promise<void>}
   */
  async deleteRepositoryChunks(owner, repo, branch = 'main') {
    try {
      this.logger.info('Deleting repository chunks', { owner, repo, branch });

      const { error } = await this.supabase
        .from('code_chunks')
        .delete()
        .eq('repository_owner', owner)
        .eq('repository_name', repo)
        .eq('repository_branch', branch);

      if (error) throw error;

      this.logger.info('Repository chunks deleted', { owner, repo, branch });

    } catch (error) {
      this.logger.error('Failed to delete repository chunks', {
        owner,
        repo,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get chunk count for a repository
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @param {string} branch - Branch name
   * @returns {Promise<number>} Number of chunks
   */
  async getChunkCount(owner, repo, branch = 'main') {
    try {
      const { count, error } = await this.supabase
        .from('code_chunks')
        .select('*', { count: 'exact', head: true })
        .eq('repository_owner', owner)
        .eq('repository_name', repo)
        .eq('repository_branch', branch);

      if (error) throw error;

      return count || 0;

    } catch (error) {
      this.logger.error('Failed to get chunk count', {
        owner,
        repo,
        error: error.message
      });
      throw error;
    }
  }
}

module.exports = CodeVectorStore;

