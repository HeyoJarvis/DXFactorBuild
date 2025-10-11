/**
 * Repository File Fetcher
 * 
 * Fetches code files from GitHub repositories using GitHub App authentication.
 * Filters and downloads relevant source files for indexing.
 * 
 * Features:
 * 1. Fetch repository file tree via GitHub API
 * 2. Filter code files (skip binaries, node_modules, etc.)
 * 3. Download file contents in batches
 * 4. Extract file metadata (language, size, path)
 * 5. Handle rate limiting and retries
 */

const winston = require('winston');
const fs = require('fs');

class RepositoryFileFetcher {
  constructor(options = {}) {
    this.options = {
      githubAppId: options.githubAppId || process.env.GITHUB_APP_ID,
      githubAppInstallationId: options.githubAppInstallationId || process.env.GITHUB_APP_INSTALLATION_ID,
      githubAppPrivateKeyPath: options.githubAppPrivateKeyPath || process.env.GITHUB_APP_PRIVATE_KEY_PATH,
      githubAppPrivateKey: options.githubAppPrivateKey || process.env.GITHUB_APP_PRIVATE_KEY,
      logLevel: options.logLevel || 'info',
      maxFileSize: options.maxFileSize || 1024 * 1024, // 1MB max per file
      batchSize: options.batchSize || 10, // Files to fetch in parallel
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
        new winston.transports.File({ filename: 'logs/file-fetcher.log' })
      ],
      defaultMeta: { service: 'file-fetcher' }
    });

    this._octokit = null;

    // File patterns to include
    this.codeExtensions = [
      '.js', '.jsx', '.ts', '.tsx',
      '.py', '.java', '.go', '.rb',
      '.php', '.cs', '.cpp', '.c', '.h',
      '.swift', '.kt', '.rs', '.scala',
      '.vue', '.svelte'
    ];

    // Patterns to exclude
    this.excludePatterns = [
      'node_modules',
      'dist',
      'build',
      '.git',
      'coverage',
      '.next',
      '.nuxt',
      'vendor',
      '__pycache__',
      '.pytest_cache',
      'target',
      'bin',
      'obj',
      '.vscode',
      '.idea',
      'package-lock.json',
      'yarn.lock',
      'pnpm-lock.yaml',
      '.min.js',
      '.bundle.js'
    ];

    this.logger.info('Repository File Fetcher initialized');
  }

  /**
   * Initialize Octokit with GitHub App
   * @private
   */
  async _getOctokit() {
    if (this._octokit) return this._octokit;

    try {
      const { createAppAuth } = await import('@octokit/auth-app');
      const privateKey = this.options.githubAppPrivateKey || 
                        fs.readFileSync(this.options.githubAppPrivateKeyPath, 'utf8');

      const mod = await import('@octokit/rest');
      this._octokit = new mod.Octokit({
        authStrategy: createAppAuth,
        auth: {
          appId: this.options.githubAppId,
          privateKey: privateKey,
          installationId: this.options.githubAppInstallationId,
        },
      });

      this.logger.info('Octokit initialized with GitHub App');
      return this._octokit;
    } catch (error) {
      this.logger.error('Failed to initialize Octokit', { error: error.message });
      throw error;
    }
  }

  /**
   * Check if file should be excluded
   * @private
   */
  _shouldExclude(path) {
    return this.excludePatterns.some(pattern => path.includes(pattern));
  }

  /**
   * Check if file is a code file we want to index
   * @private
   */
  _isCodeFile(path) {
    const ext = path.substring(path.lastIndexOf('.'));
    return this.codeExtensions.includes(ext);
  }

  /**
   * Detect programming language from file extension
   * @private
   */
  _detectLanguage(path) {
    const ext = path.substring(path.lastIndexOf('.'));
    const languageMap = {
      '.js': 'javascript',
      '.jsx': 'javascript',
      '.ts': 'typescript',
      '.tsx': 'typescript',
      '.py': 'python',
      '.java': 'java',
      '.go': 'go',
      '.rb': 'ruby',
      '.php': 'php',
      '.cs': 'csharp',
      '.cpp': 'cpp',
      '.c': 'c',
      '.h': 'c',
      '.swift': 'swift',
      '.kt': 'kotlin',
      '.rs': 'rust',
      '.scala': 'scala',
      '.vue': 'vue',
      '.svelte': 'svelte'
    };
    return languageMap[ext] || 'unknown';
  }

  /**
   * Fetch repository file tree
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @param {string} branch - Branch name (default: main)
   * @returns {Promise<Array>} List of file paths
   */
  async fetchFileTree(owner, repo, branch = 'main') {
    try {
      this.logger.info('Fetching file tree', { owner, repo, branch });
      
      const octokit = await this._getOctokit();
      
      // Get default branch if not specified
      if (branch === 'main') {
        const { data: repoData } = await octokit.repos.get({ owner, repo });
        branch = repoData.default_branch;
      }

      // Get tree recursively
      const { data } = await octokit.git.getTree({
        owner,
        repo,
        tree_sha: branch,
        recursive: 'true'
      });

      // Filter for code files only
      const codeFiles = data.tree
        .filter(item => item.type === 'blob')
        .filter(item => this._isCodeFile(item.path))
        .filter(item => !this._shouldExclude(item.path))
        .filter(item => item.size <= this.options.maxFileSize);

      this.logger.info('File tree fetched', {
        owner,
        repo,
        totalFiles: data.tree.length,
        codeFiles: codeFiles.length
      });

      return codeFiles.map(file => ({
        path: file.path,
        sha: file.sha,
        size: file.size,
        language: this._detectLanguage(file.path)
      }));

    } catch (error) {
      this.logger.error('Failed to fetch file tree', {
        owner,
        repo,
        error: error.message
      });
      throw new Error(`Failed to fetch file tree: ${error.message}`);
    }
  }

  /**
   * Fetch file content
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @param {string} path - File path
   * @returns {Promise<Object>} File data with content
   */
  async fetchFileContent(owner, repo, path) {
    try {
      const octokit = await this._getOctokit();
      
      const { data } = await octokit.repos.getContent({
        owner,
        repo,
        path
      });

      if (data.type !== 'file' || !data.content) {
        throw new Error('Not a file or no content available');
      }

      // Decode base64 content
      const content = Buffer.from(data.content, 'base64').toString('utf8');

      return {
        path: data.path,
        content: content,
        size: data.size,
        sha: data.sha,
        language: this._detectLanguage(data.path)
      };

    } catch (error) {
      this.logger.error('Failed to fetch file content', {
        owner,
        repo,
        path,
        error: error.message
      });
      throw new Error(`Failed to fetch file ${path}: ${error.message}`);
    }
  }

  /**
   * Fetch multiple files in batches
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @param {Array} filePaths - Array of file paths
   * @returns {Promise<Array>} Array of file data with content
   */
  async fetchFiles(owner, repo, filePaths) {
    this.logger.info('Fetching files in batches', {
      owner,
      repo,
      fileCount: filePaths.length,
      batchSize: this.options.batchSize
    });

    const files = [];
    const errors = [];

    // Process in batches to avoid rate limiting
    for (let i = 0; i < filePaths.length; i += this.options.batchSize) {
      const batch = filePaths.slice(i, i + this.options.batchSize);
      
      this.logger.debug('Processing batch', {
        batchNumber: Math.floor(i / this.options.batchSize) + 1,
        filesInBatch: batch.length
      });

      const batchResults = await Promise.allSettled(
        batch.map(filePath => this.fetchFileContent(owner, repo, filePath.path || filePath))
      );

      for (const result of batchResults) {
        if (result.status === 'fulfilled') {
          files.push(result.value);
        } else {
          errors.push(result.reason.message);
          this.logger.warn('File fetch failed', { error: result.reason.message });
        }
      }

      // Small delay between batches to respect rate limits
      if (i + this.options.batchSize < filePaths.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    this.logger.info('Files fetched', {
      owner,
      repo,
      successful: files.length,
      failed: errors.length
    });

    return {
      files,
      errors,
      stats: {
        total: filePaths.length,
        successful: files.length,
        failed: errors.length
      }
    };
  }

  /**
   * Fetch all code files from a repository
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @param {string} branch - Branch name (default: main)
   * @returns {Promise<Object>} Repository files and metadata
   */
  async fetchRepository(owner, repo, branch = 'main') {
    try {
      this.logger.info('Fetching repository', { owner, repo, branch });
      
      const startTime = Date.now();

      // Step 1: Get file tree
      const fileTree = await this.fetchFileTree(owner, repo, branch);
      
      if (fileTree.length === 0) {
        this.logger.warn('No code files found in repository', { owner, repo });
        return {
          owner,
          repo,
          branch,
          files: [],
          stats: { total: 0, successful: 0, failed: 0 },
          processingTime: Date.now() - startTime
        };
      }

      // Step 2: Fetch file contents
      const result = await this.fetchFiles(owner, repo, fileTree);

      const processingTime = Date.now() - startTime;

      this.logger.info('Repository fetch completed', {
        owner,
        repo,
        filesIndexed: result.files.length,
        processingTimeMs: processingTime
      });

      return {
        owner,
        repo,
        branch,
        files: result.files,
        stats: result.stats,
        processingTime
      };

    } catch (error) {
      this.logger.error('Failed to fetch repository', {
        owner,
        repo,
        error: error.message,
        stack: error.stack
      });
      throw new Error(`Failed to fetch repository ${owner}/${repo}: ${error.message}`);
    }
  }
}

module.exports = RepositoryFileFetcher;

