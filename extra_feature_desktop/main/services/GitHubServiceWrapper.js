/**
 * GitHub Service Wrapper for Team Sync Intelligence
 * 
 * Fetches PRs, commits, and extracts JIRA keys
 * Uses OAuth tokens from team_sync_integrations table
 */

class GitHubServiceWrapper {
  constructor(options = {}) {
    this.logger = options.logger || console;
    this.oauthService = options.oauthService;
    this.supabaseAdapter = options.supabaseAdapter;
    
    this.logger.info('GitHub Service Wrapper initialized for Team Sync');
  }

  /**
   * Check if GitHub is connected for a user
   * @param {string} userId - User ID
   * @returns {Promise<boolean>}
   */
  async isConnected(userId) {
    try {
      const { data, error } = await this.supabaseAdapter.supabase
        .from('team_sync_integrations')
        .select('id')
        .eq('user_id', userId)
        .eq('service_name', 'github')
        .single();

      return !error && data !== null;
    } catch (error) {
      return false;
    }
  }

  isAvailable() {
    // Always available if OAuth service is present
    return !!this.oauthService;
  }

  /**
   * Get recent pull requests
   * @param {string} userId - User ID
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Pull requests
   */
  async getRecentPRs(userId, options = {}) {
    try {
      const accessToken = await this.oauthService.getAccessToken(userId);
      const days = options.days || 7;
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

      this.logger.info('Fetching recent GitHub PRs', { userId, days });

      // Get user's repositories
      let repos = options.repos || await this._getUserRepos(accessToken);
      
      // Sort repos by most recently updated first
      repos = repos.sort((a, b) => new Date(b.updated_at || b.pushed_at || 0) - new Date(a.updated_at || a.pushed_at || 0));
      
      const allPRs = [];

      // Fetch PRs from each repo (check up to 10 most active repos)
      for (const repo of repos.slice(0, 10)) {
        try {
          const prs = await this._getRepoPRs(accessToken, repo.full_name, since);
          allPRs.push(...prs);
        } catch (error) {
          this.logger.warn('Failed to fetch PRs from repo', { 
            repo: repo.full_name, 
            error: error.message 
          });
        }
      }

      this.logger.info('GitHub PRs fetched', {
        userId,
        count: allPRs.length
      });

      return allPRs;

    } catch (error) {
      this.logger.error('Failed to get recent PRs', { 
        userId,
        error: error.message 
      });
      return [];
    }
  }

  /**
   * Get recent commits
   * @param {string} userId - User ID
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Commits with JIRA keys extracted
   */
  async getRecentCommits(userId, options = {}) {
    try {
      const accessToken = await this.oauthService.getAccessToken(userId);
      const days = options.days || 7;
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

      this.logger.info('Fetching recent GitHub commits', { userId, days });

      // Get user's repositories
      let repos = options.repos || await this._getUserRepos(accessToken);
      
      // Sort repos by most recently updated first
      repos = repos.sort((a, b) => new Date(b.updated_at || b.pushed_at || 0) - new Date(a.updated_at || a.pushed_at || 0));
      
      const allCommits = [];

      // Fetch commits from each repo (check up to 10 most active repos)
      for (const repo of repos.slice(0, 10)) {
        try {
          const commits = await this._getRepoCommits(accessToken, repo.full_name, since);
          allCommits.push(...commits);
        } catch (error) {
          this.logger.warn('Failed to fetch commits from repo', { 
            repo: repo.full_name, 
            error: error.message 
          });
        }
      }

      // Extract JIRA keys from commit messages
      const commitsWithJiraKeys = allCommits.map(commit => ({
        ...commit,
        jiraKeys: this._extractJiraKeys(commit.message)
      }));

      this.logger.info('GitHub commits fetched', {
        userId,
        count: commitsWithJiraKeys.length,
        withJiraKeys: commitsWithJiraKeys.filter(c => c.jiraKeys.length > 0).length
      });

      return commitsWithJiraKeys;

    } catch (error) {
      this.logger.error('Failed to get recent commits', { 
        userId,
        error: error.message 
      });
      return [];
    }
  }

  /**
   * List user's repositories (public method)
   * @param {string} userId - User ID
   * @returns {Promise<Array>} Repositories
   */
  async listRepositories(userId) {
    try {
      const accessToken = await this.oauthService.getAccessToken(userId);
      return await this._getUserRepos(accessToken);
    } catch (error) {
      this.logger.error('Failed to list repositories', { 
        userId,
        error: error.message 
      });
      return [];
    }
  }

  /**
   * Get user's repositories (private method)
   */
  async _getUserRepos(accessToken) {
    // GitHub Apps use installation endpoint, OAuth/PAT use user endpoint
    // Try installation endpoint first (for GitHub Apps), fallback to user endpoint
    let response = await fetch('https://api.github.com/installation/repositories?sort=updated&per_page=100', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28'
      }
    });

    if (response.ok) {
      // GitHub App - response has { total_count, repositories: [] }
      const data = await response.json();
      this.logger.info('Fetched repositories via GitHub App', { 
        count: data.repositories?.length || 0,
        total: data.total_count 
      });
      return data.repositories || [];
    }

    // Fallback to user endpoint for OAuth/PAT
    response = await fetch('https://api.github.com/user/repos?sort=updated&per_page=10', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to fetch GitHub repositories: ${response.status} ${errorText}`);
    }

    const repos = await response.json();
    this.logger.info('Fetched repositories via OAuth/PAT', { count: repos.length });
    return repos;
  }

  /**
   * Get pull requests from a repository
   */
  async _getRepoPRs(accessToken, repoFullName, since) {
    const response = await fetch(
      `https://api.github.com/repos/${repoFullName}/pulls?state=all&sort=updated&direction=desc&per_page=20`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28'
        }
      }
    );

    if (!response.ok) {
      throw new Error('Failed to fetch PRs');
    }

    const prs = await response.json();
    
    // Filter by date and format
    return prs
      .filter(pr => new Date(pr.updated_at) >= new Date(since))
      .map(pr => ({
        id: pr.id,
        number: pr.number,
        title: pr.title,
        body: pr.body,
        state: pr.state,
        merged: pr.merged_at !== null,
        author: pr.user?.login,
        createdAt: pr.created_at,
        updatedAt: pr.updated_at,
        mergedAt: pr.merged_at,
        url: pr.html_url,
        repository: repoFullName,
        jiraKeys: this._extractJiraKeys(pr.title + ' ' + (pr.body || ''))
      }));
  }

  /**
   * Get commits from a repository
   */
  async _getRepoCommits(accessToken, repoFullName, since) {
    const response = await fetch(
      `https://api.github.com/repos/${repoFullName}/commits?since=${since}&per_page=50`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28'
        }
      }
    );

    if (!response.ok) {
      throw new Error('Failed to fetch commits');
    }

    const commits = await response.json();
    
    return commits.map(commit => ({
      sha: commit.sha,
      message: commit.commit.message,
      author: commit.commit.author.name,
      authorEmail: commit.commit.author.email,
      date: commit.commit.author.date,
      url: commit.html_url,
      repository: repoFullName
    }));
  }

  /**
   * Extract JIRA keys from text (e.g., PROJ-123, ABC-456)
   */
  _extractJiraKeys(text) {
    if (!text) return [];
    
    const jiraKeyRegex = /\b([A-Z][A-Z0-9]+-\d+)\b/g;
    const matches = text.match(jiraKeyRegex);
    
    return matches ? [...new Set(matches)] : [];
  }
}

module.exports = GitHubServiceWrapper;
