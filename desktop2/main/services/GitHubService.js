/**
 * GitHub Service for Direct Repository Access
 * Uses GitHub App authentication to list and access repositories
 */

const fs = require('fs');

// Will be loaded dynamically as ES modules
let Octokit, createAppAuth;

class GitHubService {
  constructor({ logger, supabaseAdapter }) {
    this.logger = logger;
    this.supabaseAdapter = supabaseAdapter;
    this.octokit = null;
    this.isInitialized = false;
    this.modulesLoaded = false;
    
    this.logger.info('🔧 GitHub Service created', {
      hasLogger: !!logger,
      hasSupabase: !!supabaseAdapter,
      isConfigured: this.isConfigured()
    });
  }
  
  /**
   * Load ES modules dynamically
   */
  async loadModules() {
    if (this.modulesLoaded) return;
    
    try {
      const octokitModule = await import('@octokit/rest');
      const authModule = await import('@octokit/auth-app');
      
      Octokit = octokitModule.Octokit;
      createAppAuth = authModule.createAppAuth;
      
      this.modulesLoaded = true;
      this.logger.info('✅ Octokit ES modules loaded');
    } catch (error) {
      this.logger.error('Failed to load Octokit modules:', error);
      throw error;
    }
  }

  /**
   * Check if GitHub is configured
   */
  isConfigured() {
    const hasGithubApp = !!(
      process.env.GITHUB_APP_ID &&
      process.env.GITHUB_APP_INSTALLATION_ID &&
      (process.env.GITHUB_APP_PRIVATE_KEY_PATH || process.env.GITHUB_APP_PRIVATE_KEY)
    );

    const hasToken = !!process.env.GITHUB_TOKEN;

    return hasGithubApp || hasToken;
  }

  /**
   * Initialize GitHub client
   */
  async initialize() {
    try {
      if (!this.isConfigured()) {
        return {
          success: false,
          error: 'GitHub not configured - please set up GitHub App credentials or Personal Token'
        };
      }

      // Option 1: GitHub App (preferred)
      if (process.env.GITHUB_APP_ID && process.env.GITHUB_APP_INSTALLATION_ID) {
        await this.initializeWithApp();
      }
      // Option 2: Personal Access Token (fallback)
      else if (process.env.GITHUB_TOKEN) {
        await this.initializeWithToken();
      }

      this.isInitialized = true;
      this.logger.info('GitHub service initialized successfully');

      return {
        success: true,
        connected: true
      };

    } catch (error) {
      this.logger.error('Failed to initialize GitHub service', {
        error: error.message
      });
      
      return {
        success: false,
        connected: false,
        error: error.message
      };
    }
  }

  /**
   * Initialize with GitHub App
   */
  async initializeWithApp() {
    const appId = process.env.GITHUB_APP_ID;
    const installationId = process.env.GITHUB_APP_INSTALLATION_ID;
    
    // Read private key
    let privateKey;
    if (process.env.GITHUB_APP_PRIVATE_KEY_PATH) {
      privateKey = fs.readFileSync(process.env.GITHUB_APP_PRIVATE_KEY_PATH, 'utf8');
    } else if (process.env.GITHUB_APP_PRIVATE_KEY) {
      privateKey = process.env.GITHUB_APP_PRIVATE_KEY;
    } else {
      throw new Error('GitHub App private key not found');
    }

    // Create Octokit instance with App authentication
    const { Octokit } = await import('@octokit/rest');
    const { createAppAuth } = await import('@octokit/auth-app');
    
    this.octokit = new Octokit({
      authStrategy: createAppAuth,
      auth: {
        appId,
        privateKey,
        installationId: parseInt(installationId)
      }
    });
    
    this.logger.info('GitHub App authenticated', { appId, installationId });
  }

  /**
   * Initialize with Personal Access Token
   */
  async initializeWithToken() {
    const { Octokit } = await import('@octokit/rest');
    this.octokit = new Octokit({
      auth: process.env.GITHUB_TOKEN
    });
    
    this.logger.info('GitHub authenticated with Personal Access Token');
  }

  /**
   * List accessible repositories
   */
  async listRepositories(options = {}) {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      if (!this.octokit) {
        throw new Error('GitHub client not initialized');
      }

      const { per_page = 100, page = 1, org, affiliation = 'owner,collaborator,organization_member' } = options;

      this.logger.info('Listing GitHub repositories', { per_page, page, org, affiliation });

      let repositories;

      if (org) {
        // List org repositories
        const response = await this.octokit.repos.listForOrg({
          org,
          per_page,
          page,
          type: 'all'
        });
        repositories = response.data;
      } else {
        // List installation repositories (for GitHub App)
        if (process.env.GITHUB_APP_INSTALLATION_ID) {
          const response = await this.octokit.apps.listReposAccessibleToInstallation({
            per_page,
            page
          });
          repositories = response.data.repositories || response.data;
        } else {
          // List authenticated user's repositories (for PAT)
          const response = await this.octokit.repos.listForAuthenticatedUser({
            per_page,
            page,
            affiliation
          });
          repositories = response.data;
        }
      }

      this.logger.info('Listed repositories successfully', { count: repositories.length });

      return {
        success: true,
        repositories: repositories.map(repo => ({
          id: repo.id,
          name: repo.name,
          full_name: repo.full_name,
          owner: repo.owner.login,
          private: repo.private,
          description: repo.description,
          url: repo.html_url,
          default_branch: repo.default_branch,
          language: repo.language,
          stargazers_count: repo.stargazers_count,
          forks_count: repo.forks_count,
          open_issues_count: repo.open_issues_count,
          created_at: repo.created_at,
          updated_at: repo.updated_at,
          pushed_at: repo.pushed_at
        })),
        count: repositories.length
      };

    } catch (error) {
      this.logger.error('Failed to list repositories', { error: error.message });
      
      return {
        success: false,
        error: error.message,
        repositories: []
      };
    }
  }

  /**
   * Get repository details
   */
  async getRepository(owner, repo) {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      if (!this.octokit) {
        throw new Error('GitHub client not initialized');
      }

      const response = await this.octokit.repos.get({
        owner,
        repo
      });

      return {
        success: true,
        repository: response.data
      };

    } catch (error) {
      this.logger.error('Failed to get repository', { owner, repo, error: error.message });
      
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get repository contents
   */
  async getContents(owner, repo, path = '', ref) {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      if (!this.octokit) {
        throw new Error('GitHub client not initialized');
      }

      const params = { owner, repo, path };
      if (ref) params.ref = ref;

      const response = await this.octokit.repos.getContent(params);

      return {
        success: true,
        contents: response.data
      };

    } catch (error) {
      this.logger.error('Failed to get repository contents', { owner, repo, path, error: error.message });
      
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Search repositories
   */
  async searchRepositories(query, options = {}) {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      if (!this.octokit) {
        throw new Error('GitHub client not initialized');
      }

      const { per_page = 30, page = 1 } = options;

      const response = await this.octokit.search.repos({
        q: query,
        per_page,
        page
      });

      return {
        success: true,
        repositories: response.data.items,
        total_count: response.data.total_count
      };

    } catch (error) {
      this.logger.error('Failed to search repositories', { query, error: error.message });
      
      return {
        success: false,
        error: error.message,
        repositories: []
      };
    }
  }
}

module.exports = GitHubService;

