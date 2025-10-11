/**
 * GitHub Actions CI/CD Service
 * 
 * Integrates with GitHub Actions for deployment monitoring:
 * - Workflow runs and status tracking
 * - Deployment events and history
 * - CI/CD pipeline health metrics
 * - DORA metrics calculation
 * 
 * Features:
 * 1. Real-time workflow run monitoring
 * 2. Deployment event tracking
 * 3. Link commits/PRs to deployments
 * 4. Calculate deployment metrics (frequency, lead time, MTTR, change failure rate)
 * 5. Detect risky deployments
 */

const winston = require('winston');
const EventEmitter = require('events');

class GitHubActionsService extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.options = {
      // GitHub App authentication (primary)
      githubAppId: options.githubAppId || process.env.GITHUB_APP_ID,
      githubAppInstallationId: options.githubAppInstallationId || process.env.GITHUB_APP_INSTALLATION_ID,
      githubAppPrivateKeyPath: options.githubAppPrivateKeyPath || process.env.GITHUB_APP_PRIVATE_KEY_PATH,
      githubAppPrivateKey: options.githubAppPrivateKey || process.env.GITHUB_APP_PRIVATE_KEY,
      
      // Personal Access Token (fallback - optional)
      githubToken: options.githubToken || process.env.GITHUB_TOKEN,
      
      // Repository is OPTIONAL - will be auto-detected from GitHub App installation
      repository: options.repository || (
        process.env.GITHUB_REPO_OWNER && process.env.GITHUB_REPO_NAME ? {
          owner: process.env.GITHUB_REPO_OWNER,
          repo: process.env.GITHUB_REPO_NAME
        } : null
      ),
      logLevel: options.logLevel || 'info',
      ...options
    };

    // Initialize logger
    this.logger = winston.createLogger({
      level: this.options.logLevel,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.Console(),
        new winston.transports.File({ 
          filename: 'logs/github-actions.log',
          maxsize: 5242880, // 5MB
          maxFiles: 5
        })
      ],
      defaultMeta: { service: 'github-actions-service' }
    });

    // Lazy Octokit initialization (ESM dynamic import)
    this._octokit = null;

    this.logger.info('GitHub Actions Service initialized', {
      repository: `${this.options.repository.owner}/${this.options.repository.repo}`
    });
  }

  /**
   * Get Octokit instance (lazy initialization)
   */
  async _getOctokit() {
    if (this._octokit) return this._octokit;
    
    const fs = require('fs');
    
    // Option 1: Try GitHub App authentication
    if (this.options.githubAppId && this.options.githubAppInstallationId) {
      try {
        const { createAppAuth } = await import('@octokit/auth-app');
        
        // Load private key
        let privateKey;
        if (this.options.githubAppPrivateKey) {
          privateKey = this.options.githubAppPrivateKey;
        } else if (this.options.githubAppPrivateKeyPath) {
          privateKey = fs.readFileSync(this.options.githubAppPrivateKeyPath, 'utf8');
        } else {
          throw new Error('GitHub App private key not found');
        }
        
        const mod = await import('@octokit/rest');
        this._octokit = new mod.Octokit({
          authStrategy: createAppAuth,
          auth: {
            appId: this.options.githubAppId,
            privateKey: privateKey,
            installationId: this.options.githubAppInstallationId,
          },
        });
        
        this.logger.info('GitHub App authentication successful');
        
        // Auto-detect repository if not specified
        if (!this.options.repository) {
          await this._autoDetectRepository();
        }
        
        return this._octokit;
      } catch (error) {
        this.logger.error('GitHub App authentication failed', {
          error: error.message
        });
        
        if (!this.options.githubToken) {
          throw new Error(`GitHub App authentication failed: ${error.message}`);
        }
        
        this.logger.warn('Falling back to Personal Access Token');
      }
    }
    
    // Option 2: Fallback to Personal Access Token
    if (this.options.githubToken) {
      const mod = await import('@octokit/rest');
      this._octokit = new mod.Octokit({ auth: this.options.githubToken });
      return this._octokit;
    }
    
    throw new Error('No GitHub authentication configured');
  }

  /**
   * Auto-detect repository from GitHub App installation
   */
  async _autoDetectRepository() {
    try {
      const { data } = await this._octokit.apps.listReposAccessibleToInstallation({
        per_page: 1
      });
      
      if (data.repositories && data.repositories.length > 0) {
        const repo = data.repositories[0];
        this.options.repository = {
          owner: repo.owner.login,
          repo: repo.name
        };
        
        this.logger.info('Repository auto-detected', {
          owner: this.options.repository.owner,
          repo: this.options.repository.repo
        });
      }
    } catch (error) {
      this.logger.warn('Failed to auto-detect repository', {
        error: error.message
      });
    }
  }

  /**
   * Get workflow runs
   */
  async getWorkflowRuns(options = {}) {
    try {
      const {
        workflow_id,
        branch,
        status,
        per_page = 30,
        page = 1
      } = options;

      this.logger.info('Fetching workflow runs', {
        repository: `${this.options.repository.owner}/${this.options.repository.repo}`,
        workflow_id,
        branch,
        status
      });

      const octokit = await this._getOctokit();
      
      const params = {
        owner: this.options.repository.owner,
        repo: this.options.repository.repo,
        per_page,
        page
      };

      if (workflow_id) params.workflow_id = workflow_id;
      if (branch) params.branch = branch;
      if (status) params.status = status;

      const { data } = await octokit.actions.listWorkflowRunsForRepo(params);

      const runs = data.workflow_runs.map(run => this._normalizeWorkflowRun(run));

      this.logger.info('Workflow runs fetched', {
        total: data.total_count,
        returned: runs.length
      });

      return {
        total_count: data.total_count,
        workflow_runs: runs
      };

    } catch (error) {
      this.logger.error('Failed to get workflow runs', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get specific workflow run
   */
  async getWorkflowRun(runId) {
    try {
      this.logger.info('Fetching workflow run', { runId });

      const octokit = await this._getOctokit();
      
      const { data } = await octokit.actions.getWorkflowRun({
        owner: this.options.repository.owner,
        repo: this.options.repository.repo,
        run_id: runId
      });

      return this._normalizeWorkflowRun(data);

    } catch (error) {
      this.logger.error('Failed to get workflow run', {
        runId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get workflow run jobs
   */
  async getWorkflowJobs(runId) {
    try {
      this.logger.info('Fetching workflow jobs', { runId });

      const octokit = await this._getOctokit();
      
      const { data } = await octokit.actions.listJobsForWorkflowRun({
        owner: this.options.repository.owner,
        repo: this.options.repository.repo,
        run_id: runId
      });

      return data.jobs.map(job => ({
        id: job.id,
        name: job.name,
        status: job.status,
        conclusion: job.conclusion,
        started_at: job.started_at,
        completed_at: job.completed_at,
        duration_ms: job.completed_at ? 
          new Date(job.completed_at) - new Date(job.started_at) : null,
        steps: job.steps?.map(step => ({
          name: step.name,
          status: step.status,
          conclusion: step.conclusion,
          number: step.number
        }))
      }));

    } catch (error) {
      this.logger.error('Failed to get workflow jobs', {
        runId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get deployments
   */
  async getDeployments(options = {}) {
    try {
      const {
        environment,
        per_page = 30,
        page = 1
      } = options;

      this.logger.info('Fetching deployments', {
        repository: `${this.options.repository.owner}/${this.options.repository.repo}`,
        environment
      });

      const octokit = await this._getOctokit();
      
      const params = {
        owner: this.options.repository.owner,
        repo: this.options.repository.repo,
        per_page,
        page
      };

      if (environment) params.environment = environment;

      const { data } = await octokit.repos.listDeployments(params);

      const deployments = data.map(deployment => this._normalizeDeployment(deployment));

      this.logger.info('Deployments fetched', {
        count: deployments.length
      });

      return deployments;

    } catch (error) {
      this.logger.error('Failed to get deployments', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get deployment statuses
   */
  async getDeploymentStatuses(deploymentId) {
    try {
      this.logger.info('Fetching deployment statuses', { deploymentId });

      const octokit = await this._getOctokit();
      
      const { data } = await octokit.repos.listDeploymentStatuses({
        owner: this.options.repository.owner,
        repo: this.options.repository.repo,
        deployment_id: deploymentId
      });

      return data.map(status => ({
        id: status.id,
        state: status.state,
        description: status.description,
        environment: status.environment,
        created_at: status.created_at,
        updated_at: status.updated_at
      }));

    } catch (error) {
      this.logger.error('Failed to get deployment statuses', {
        deploymentId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get recent deployments with full status
   */
  async getRecentDeploymentsWithStatus(options = {}) {
    try {
      const { environment, limit = 10 } = options;

      this.logger.info('Fetching recent deployments with status', {
        environment,
        limit
      });

      const deployments = await this.getDeployments({
        environment,
        per_page: limit
      });

      // Fetch statuses for each deployment
      const deploymentsWithStatus = await Promise.all(
        deployments.map(async (deployment) => {
          try {
            const statuses = await this.getDeploymentStatuses(deployment.id);
            const latestStatus = statuses[0]; // Most recent status
            
            return {
              ...deployment,
              current_status: latestStatus?.state,
              status_description: latestStatus?.description,
              status_updated_at: latestStatus?.updated_at,
              all_statuses: statuses
            };
          } catch (error) {
            this.logger.warn('Failed to get statuses for deployment', {
              deploymentId: deployment.id,
              error: error.message
            });
            return deployment;
          }
        })
      );

      return deploymentsWithStatus;

    } catch (error) {
      this.logger.error('Failed to get recent deployments with status', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Link PRs to workflow run
   */
  async getPRsForWorkflowRun(runId) {
    try {
      this.logger.info('Linking PRs to workflow run', { runId });

      const run = await this.getWorkflowRun(runId);
      const commitSha = run.head_commit?.sha;

      if (!commitSha) {
        return [];
      }

      const octokit = await this._getOctokit();
      
      // Find PRs associated with this commit
      const { data } = await octokit.repos.listPullRequestsAssociatedWithCommit({
        owner: this.options.repository.owner,
        repo: this.options.repository.repo,
        commit_sha: commitSha
      });

      return data.map(pr => ({
        number: pr.number,
        title: pr.title,
        state: pr.state,
        merged: pr.merged_at !== null,
        author: pr.user?.login,
        created_at: pr.created_at,
        merged_at: pr.merged_at,
        url: pr.html_url
      }));

    } catch (error) {
      this.logger.error('Failed to get PRs for workflow run', {
        runId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Normalize workflow run data
   */
  _normalizeWorkflowRun(run) {
    return {
      id: run.id,
      name: run.name,
      workflow_id: run.workflow_id,
      status: run.status,
      conclusion: run.conclusion,
      branch: run.head_branch,
      event: run.event,
      head_commit: {
        sha: run.head_sha,
        message: run.head_commit?.message,
        author: run.head_commit?.author?.name
      },
      created_at: run.created_at,
      updated_at: run.updated_at,
      run_started_at: run.run_started_at,
      duration_ms: run.updated_at && run.run_started_at ? 
        new Date(run.updated_at) - new Date(run.run_started_at) : null,
      run_number: run.run_number,
      run_attempt: run.run_attempt,
      url: run.html_url,
      actor: run.actor?.login,
      triggering_actor: run.triggering_actor?.login
    };
  }

  /**
   * Normalize deployment data
   */
  _normalizeDeployment(deployment) {
    return {
      id: deployment.id,
      sha: deployment.sha,
      ref: deployment.ref,
      environment: deployment.environment,
      description: deployment.description,
      creator: deployment.creator?.login,
      created_at: deployment.created_at,
      updated_at: deployment.updated_at,
      url: deployment.url
    };
  }

  /**
   * Health check
   */
  async healthCheck() {
    try {
      const octokit = await this._getOctokit();
      
      await octokit.repos.get({
        owner: this.options.repository.owner,
        repo: this.options.repository.repo
      });

      return {
        status: 'healthy',
        github_actions: 'connected',
        repository: `${this.options.repository.owner}/${this.options.repository.repo}`
      };

    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message
      };
    }
  }
}

module.exports = GitHubActionsService;

