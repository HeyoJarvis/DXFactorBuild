/**
 * Engineering Intelligence Service
 * 
 * Enables non-technical executives to query and understand engineering codebases
 * through natural language using GitHub Copilot API.
 * 
 * Features:
 * 1. Natural language codebase queries
 * 2. Executive-friendly response formatting
 * 3. Feature status tracking
 * 4. Demo-ability detection
 * 5. Sales talking points generation
 */

// Octokit (@octokit/rest) is ESM-only; use dynamic import from CommonJS context
const winston = require('winston');
const EventEmitter = require('events');
const fs = require('fs');

class EngineeringIntelligenceService extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.options = {
      githubToken: options.githubToken || process.env.GITHUB_TOKEN,
      // Repository is now OPTIONAL - can be specified per-query for multi-repo support
      repository: options.repository || (
        process.env.GITHUB_REPO_OWNER && process.env.GITHUB_REPO_NAME ? {
          owner: process.env.GITHUB_REPO_OWNER,
          repo: process.env.GITHUB_REPO_NAME
        } : null
      ),
      copilotModel: options.copilotModel || 'gpt-4',
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
          filename: 'logs/engineering-intelligence.log',
          maxsize: 5242880,
          maxFiles: 5
        })
      ],
      defaultMeta: { service: 'engineering-intelligence' }
    });

    // Lazy GitHub client initialization (ESM dynamic import)
    this._octokit = null;

    const repoInfo = this.options.repository 
      ? `${this.options.repository.owner}/${this.options.repository.repo}`
      : 'multi-repo mode';
    
    this.logger.info('Engineering Intelligence Service initialized', {
      repository: repoInfo
    });
  }

  /**
   * Lazy-load Octokit client (ESM) and cache instance
   * Supports both GitHub App authentication (production) and Personal Access Token (development)
   * @private
   */
  async _getOctokit() {
    if (this._octokit) return this._octokit;
    
    // Option 1: Try GitHub App authentication first (PRODUCTION - Recommended)
    if (process.env.GITHUB_APP_ID && process.env.GITHUB_APP_INSTALLATION_ID) {
      try {
        // Dynamic import for ESM modules
        const { createAppAuth } = await import('@octokit/auth-app');
        
        // Load private key from file or environment variable
        let privateKey;
        if (process.env.GITHUB_APP_PRIVATE_KEY) {
          privateKey = process.env.GITHUB_APP_PRIVATE_KEY;
        } else if (process.env.GITHUB_APP_PRIVATE_KEY_PATH) {
          privateKey = fs.readFileSync(process.env.GITHUB_APP_PRIVATE_KEY_PATH, 'utf8');
        } else {
          throw new Error('GitHub App private key not found. Set GITHUB_APP_PRIVATE_KEY or GITHUB_APP_PRIVATE_KEY_PATH');
        }
        
        const mod = await import('@octokit/rest');
        this._octokit = new mod.Octokit({
          authStrategy: createAppAuth,
          auth: {
            appId: process.env.GITHUB_APP_ID,
            privateKey: privateKey,
            installationId: process.env.GITHUB_APP_INSTALLATION_ID,
          },
        });
        
        this.logger.info('GitHub App authentication successful', {
          appId: process.env.GITHUB_APP_ID,
          installationId: process.env.GITHUB_APP_INSTALLATION_ID,
          authType: 'github-app'
        });
        
        return this._octokit;
      } catch (error) {
        this.logger.error('GitHub App authentication failed, trying fallback', {
          error: error.message,
          stack: error.stack
        });
        // Don't throw, continue to fallback
      }
    }
    
    // Option 2: Fallback to Personal Access Token (DEVELOPMENT)
    if (this.options.githubToken || process.env.GITHUB_TOKEN) {
      const token = this.options.githubToken || process.env.GITHUB_TOKEN;
      this.logger.warn('Using Personal Access Token authentication (development mode)', {
        authType: 'personal-token'
      });
      
      const mod = await import('@octokit/rest');
      this._octokit = new mod.Octokit({ auth: token });
      return this._octokit;
    }
    
    // No authentication configured
    throw new Error('GitHub authentication not configured. Set GITHUB_APP_ID + GITHUB_APP_INSTALLATION_ID + private key, or GITHUB_TOKEN');
  }

  /**
   * Query the codebase with natural language
   * @param {string} question - The question to ask
   * @param {Object} context - Additional context (user role, etc.)
   * @returns {Promise<Object>} Formatted response
   */
  async queryCodebase(question, context = {}) {
    try {
      // Allow repository to be specified per-query or use default
      const repository = context.repository || this.options.repository;
      const repoInfo = repository ? `${repository.owner}/${repository.repo}` : 'all accessible repos';
      
      this.logger.info('Querying codebase', {
        question: question.substring(0, 100),
        role: context.role,
        repository: repoInfo
      });

      // 🆕 STEP 1: Fetch REAL GitHub data based on query type
      const githubData = await this._fetchRealGitHubData(question, repository);
      
      // 🆕 STEP 2: Try to use AI (Copilot or Claude) to analyze the real data
      let aiResponse;
      try {
        const systemPrompt = this._buildSystemPrompt(context.role);
        const enhancedQuestion = this._buildEnhancedQuestion(question, githubData);
        
        aiResponse = await this._queryCopilot(enhancedQuestion, systemPrompt, context);
      } catch (aiError) {
        // 🆕 STEP 3: If AI fails, format the real data directly
        this.logger.warn('AI analysis unavailable, formatting raw data', { error: aiError.message });
        aiResponse = this._formatRealDataDirectly(githubData, question);
      }

      // Format response for executives
      const formattedResponse = await this._formatForExecutive(
        aiResponse,
        question,
        context
      );

      this.logger.info('Codebase query completed', {
        question: question.substring(0, 100),
        responseLength: formattedResponse.summary.length,
        dataSource: githubData ? githubData.type : 'none'
      });

      this.emit('query_completed', {
        question,
        role: context.role,
        timestamp: new Date().toISOString()
      });

      return formattedResponse;

    } catch (error) {
      this.logger.error('Failed to query codebase', {
        error: error.message,
        question: question.substring(0, 100)
      });

      throw new Error(`Failed to query codebase: ${error.message}`);
    }
  }

  /**
   * Fetch REAL GitHub data based on query type
   * @private
   */
  async _fetchRealGitHubData(question, repository) {
    if (!repository) {
      this.logger.warn('No repository specified, cannot fetch real data');
      return null;
    }

    const lowerQuestion = question.toLowerCase();
    const octokit = await this._getOctokit();
    
    try {
      // Detect query type and fetch appropriate data
      if (lowerQuestion.includes('issue') || lowerQuestion.includes('bug') || lowerQuestion.includes('problem')) {
        this.logger.info('Fetching real issues from GitHub', { repository: `${repository.owner}/${repository.repo}` });
        
        const { data } = await octokit.issues.listForRepo({
          owner: repository.owner,
          repo: repository.repo,
          state: 'all',
          sort: 'updated',
          direction: 'desc',
          per_page: 50
        });
        
        return { type: 'issues', data, count: data.length };
        
      } else if (lowerQuestion.includes('pr') || lowerQuestion.includes('pull request') || lowerQuestion.includes('merge')) {
        this.logger.info('Fetching real PRs from GitHub', { repository: `${repository.owner}/${repository.repo}` });
        
        const { data } = await octokit.pulls.list({
          owner: repository.owner,
          repo: repository.repo,
          state: 'all',
          sort: 'updated',
          direction: 'desc',
          per_page: 50
        });
        
        return { type: 'prs', data, count: data.length };
        
      } else if (lowerQuestion.includes('commit') || lowerQuestion.includes('change') || lowerQuestion.includes('recent')) {
        this.logger.info('Fetching real commits from GitHub', { repository: `${repository.owner}/${repository.repo}` });
        
        const { data } = await octokit.repos.listCommits({
          owner: repository.owner,
          repo: repository.repo,
          per_page: 50
        });
        
        return { type: 'commits', data, count: data.length };
        
      } else if (lowerQuestion.includes('feature') || lowerQuestion.includes('built') || lowerQuestion.includes('developed')) {
        this.logger.info('Fetching combined data (PRs + issues) from GitHub', { repository: `${repository.owner}/${repository.repo}` });
        
        // Fetch both PRs and issues for feature queries
        const [prsResponse, issuesResponse] = await Promise.all([
          octokit.pulls.list({
            owner: repository.owner,
            repo: repository.repo,
            state: 'closed',
            sort: 'updated',
            direction: 'desc',
            per_page: 30
          }),
          octokit.issues.listForRepo({
            owner: repository.owner,
            repo: repository.repo,
            state: 'closed',
            sort: 'updated',
            direction: 'desc',
            per_page: 30
          })
        ]);
        
        return {
          type: 'features',
          prs: prsResponse.data,
          issues: issuesResponse.data,
          count: prsResponse.data.length + issuesResponse.data.length
        };
      }
      
      // Default: fetch recent activity (commits)
      this.logger.info('Fetching recent commits as default', { repository: `${repository.owner}/${repository.repo}` });
      
      const { data } = await octokit.repos.listCommits({
        owner: repository.owner,
        repo: repository.repo,
        per_page: 30
      });
      
      return { type: 'commits', data, count: data.length };
      
    } catch (error) {
      this.logger.error('Failed to fetch real GitHub data', { error: error.message });
      return null;
    }
  }

  /**
   * Build enhanced question with real GitHub data
   * @private
   */
  _buildEnhancedQuestion(question, githubData) {
    if (!githubData) {
      return question;
    }

    let dataContext = `\n\n=== REAL GITHUB DATA (${githubData.type.toUpperCase()}) ===\n`;
    
    if (githubData.type === 'issues') {
      dataContext += `Found ${githubData.count} issues:\n\n`;
      githubData.data.slice(0, 10).forEach((issue, i) => {
        dataContext += `${i + 1}. #${issue.number} - ${issue.title}\n`;
        dataContext += `   State: ${issue.state} | Labels: ${issue.labels.map(l => l.name).join(', ') || 'none'}\n`;
        dataContext += `   Assignee: ${issue.assignee?.login || 'Unassigned'}\n`;
        dataContext += `   Created: ${new Date(issue.created_at).toLocaleDateString()}\n`;
        if (issue.closed_at) {
          dataContext += `   Closed: ${new Date(issue.closed_at).toLocaleDateString()}\n`;
        }
        dataContext += `\n`;
      });
    } else if (githubData.type === 'prs') {
      dataContext += `Found ${githubData.count} pull requests:\n\n`;
      githubData.data.slice(0, 10).forEach((pr, i) => {
        dataContext += `${i + 1}. #${pr.number} - ${pr.title}\n`;
        dataContext += `   State: ${pr.state} | Merged: ${pr.merged_at ? 'Yes' : 'No'}\n`;
        dataContext += `   Author: ${pr.user.login}\n`;
        dataContext += `   Created: ${new Date(pr.created_at).toLocaleDateString()}\n`;
        if (pr.merged_at) {
          dataContext += `   Merged: ${new Date(pr.merged_at).toLocaleDateString()}\n`;
        }
        dataContext += `\n`;
      });
    } else if (githubData.type === 'commits') {
      dataContext += `Found ${githubData.count} commits:\n\n`;
      githubData.data.slice(0, 15).forEach((commit, i) => {
        dataContext += `${i + 1}. ${commit.commit.message.split('\n')[0]}\n`;
        dataContext += `   Author: ${commit.commit.author.name}\n`;
        dataContext += `   Date: ${new Date(commit.commit.author.date).toLocaleDateString()}\n`;
        dataContext += `\n`;
      });
    } else if (githubData.type === 'features') {
      dataContext += `Found ${githubData.prs.length} merged PRs and ${githubData.issues.length} closed issues:\n\n`;
      dataContext += `Recent Merged PRs:\n`;
      githubData.prs.slice(0, 5).forEach((pr, i) => {
        dataContext += `${i + 1}. #${pr.number} - ${pr.title} (merged ${new Date(pr.merged_at).toLocaleDateString()})\n`;
      });
      dataContext += `\nRecent Closed Issues:\n`;
      githubData.issues.slice(0, 5).forEach((issue, i) => {
        dataContext += `${i + 1}. #${issue.number} - ${issue.title} (closed ${new Date(issue.closed_at).toLocaleDateString()})\n`;
      });
    }
    
    dataContext += `\n=== END REAL DATA ===\n\n`;
    dataContext += `Based on the REAL GitHub data above, please answer: ${question}`;
    
    return dataContext;
  }

  /**
   * Format real GitHub data directly (when AI unavailable)
   * @private
   */
  _formatRealDataDirectly(githubData, question) {
    if (!githubData) {
      return {
        content: `Unable to fetch real GitHub data. Please check repository access.`
      };
    }

    let content = `Based on real GitHub data:\n\n`;
    
    if (githubData.type === 'issues') {
      content += `**Issues Found:** ${githubData.count} total\n\n`;
      
      const openIssues = githubData.data.filter(i => i.state === 'open');
      const closedIssues = githubData.data.filter(i => i.state === 'closed');
      
      content += `📊 **Summary:**\n`;
      content += `- Open: ${openIssues.length}\n`;
      content += `- Closed: ${closedIssues.length}\n\n`;
      
      content += `**Recent Issues:**\n`;
      githubData.data.slice(0, 10).forEach((issue, i) => {
        const stateIcon = issue.state === 'open' ? '🔴' : '✅';
        content += `${i + 1}. ${stateIcon} #${issue.number} "${issue.title}"\n`;
        content += `   - Priority: ${issue.labels.find(l => l.name.toLowerCase().includes('priority'))?.name || 'Not set'}\n`;
        content += `   - Labels: ${issue.labels.map(l => l.name).join(', ') || 'none'}\n`;
        content += `   - Assigned: ${issue.assignee?.login || 'Unassigned'}\n`;
        content += `   - Created: ${new Date(issue.created_at).toLocaleDateString()}\n`;
        if (issue.closed_at) {
          content += `   - Closed: ${new Date(issue.closed_at).toLocaleDateString()}\n`;
        }
        content += `\n`;
      });
      
    } else if (githubData.type === 'prs') {
      content += `**Pull Requests Found:** ${githubData.count} total\n\n`;
      
      const merged = githubData.data.filter(pr => pr.merged_at);
      const open = githubData.data.filter(pr => pr.state === 'open');
      const closed = githubData.data.filter(pr => pr.state === 'closed' && !pr.merged_at);
      
      content += `📊 **Summary:**\n`;
      content += `- Merged: ${merged.length}\n`;
      content += `- Open: ${open.length}\n`;
      content += `- Closed (not merged): ${closed.length}\n\n`;
      
      content += `**Recent Pull Requests:**\n`;
      githubData.data.slice(0, 10).forEach((pr, i) => {
        const stateIcon = pr.merged_at ? '✅' : (pr.state === 'open' ? '🔵' : '⚪');
        content += `${i + 1}. ${stateIcon} #${pr.number} "${pr.title}"\n`;
        content += `   - Author: ${pr.user.login}\n`;
        content += `   - Status: ${pr.merged_at ? 'Merged' : pr.state}\n`;
        content += `   - Created: ${new Date(pr.created_at).toLocaleDateString()}\n`;
        if (pr.merged_at) {
          content += `   - Merged: ${new Date(pr.merged_at).toLocaleDateString()}\n`;
        }
        content += `\n`;
      });
      
    } else if (githubData.type === 'commits') {
      content += `**Commits Found:** ${githubData.count} recent commits\n\n`;
      
      content += `**Recent Activity:**\n`;
      githubData.data.slice(0, 15).forEach((commit, i) => {
        content += `${i + 1}. ${commit.commit.message.split('\n')[0]}\n`;
        content += `   - Author: ${commit.commit.author.name}\n`;
        content += `   - Date: ${new Date(commit.commit.author.date).toLocaleDateString()}\n`;
        content += `\n`;
      });
      
    } else if (githubData.type === 'features') {
      content += `**Features & Development Activity:**\n\n`;
      content += `📊 **Summary:**\n`;
      content += `- Merged PRs: ${githubData.prs.length}\n`;
      content += `- Closed Issues: ${githubData.issues.length}\n\n`;
      
      content += `**Recent Features (Merged PRs):**\n`;
      githubData.prs.slice(0, 8).forEach((pr, i) => {
        content += `${i + 1}. ✅ #${pr.number} "${pr.title}"\n`;
        content += `   - Author: ${pr.user.login}\n`;
        content += `   - Merged: ${new Date(pr.merged_at).toLocaleDateString()}\n`;
        content += `\n`;
      });
      
      if (githubData.issues.length > 0) {
        content += `\n**Recently Closed Issues:**\n`;
        githubData.issues.slice(0, 5).forEach((issue, i) => {
          content += `${i + 1}. ✅ #${issue.number} "${issue.title}"\n`;
          content += `   - Closed: ${new Date(issue.closed_at).toLocaleDateString()}\n`;
          content += `\n`;
        });
      }
    }
    
    return { content };
  }

  /**
   * Query GitHub Copilot API
   * @private
   */
  async _queryCopilot(question, systemPrompt, context = {}) {
    try {
      // Use repository from context or default
      const repository = context.repository || this.options.repository;
      
      // Build request body
      const requestBody = {
        messages: [
          {
            role: 'system',
            content: systemPrompt
          },
          {
            role: 'user',
            content: question
          }
        ],
        model: this.options.copilotModel,
        temperature: 0.7,
        max_tokens: 2000
      };
      
      // Only include repository if specified
      if (repository) {
        requestBody.repository = {
          owner: repository.owner,
          name: repository.repo
        };
      }
      
      // GitHub Copilot Chat API endpoint
      const response = await fetch('https://api.github.com/copilot/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.options.githubToken}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorText = await response.text();
        
        // Throw error so queryCodebase can use real data formatter
        this.logger.warn('GitHub Copilot API not available', {
          status: response.status,
          error: errorText
        });
        
        throw new Error(`GitHub Copilot API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      
      return {
        content: data.choices[0].message.content,
        model: data.model,
        usage: data.usage
      };

    } catch (error) {
      this.logger.warn('Copilot API not available', {
        error: error.message,
        statusCode: error.response?.status || 'unknown'
      });
      
      // Throw error so queryCodebase can use real data formatter
      throw new Error(`Copilot API unavailable: ${error.message}`);
    }
  }
  
  /**
   * Get mock response for common queries (fallback when Copilot API unavailable)
   * @private
   */
  _getMockResponse(question) {
    const lowerQuestion = question.toLowerCase();
    
    const mockResponses = {
      sso: {
        content: `Based on the codebase analysis:

**SSO Integration Status:**
The SSO integration is production-ready and fully functional. The implementation uses OAuth 2.0 and OpenID Connect standards, supporting Azure AD, Okta, and Google Workspace.

**Key Features:**
- Secure authentication flow with PKCE
- Multi-provider support (Azure AD, Okta, Google)
- Session management and token refresh
- Role-based access control

**Demo Readiness:** ✅ Fully demo-able
**Production Status:** ✅ Live and tested
**Security Audit:** ✅ Passed`
      },
      meeting: {
        content: `Based on the codebase analysis:

**Meeting Scheduling Feature Status:**
The Microsoft 365 meeting scheduling integration is fully implemented and production-ready.

**Key Capabilities:**
- Direct Teams meeting creation from HeyJarvis
- Calendar integration with Microsoft Graph API
- Approval workflow to prevent accidental invites
- Time zone handling and attendee management

**Demo Readiness:** ✅ Fully functional
**User Experience:** Seamless integration with AI chat
**Integration Status:** ✅ Microsoft 365 connected`
      },
      default: {
        content: `Based on recent codebase activity:

**Engineering Status:**
The team is actively working on ${question}. Recent commits show progress across multiple areas including AI integration, Microsoft 365 connectivity, and user experience improvements.

**Current Focus:**
- Enhanced automation capabilities
- Integration improvements
- User interface refinements

**Recommendation:** Check with the engineering team for specific timelines and demo availability.`
      }
    };
    
    let responseKey = 'default';
    if (lowerQuestion.includes('sso') || lowerQuestion.includes('authentication') || lowerQuestion.includes('login')) {
      responseKey = 'sso';
    } else if (lowerQuestion.includes('meeting') || lowerQuestion.includes('calendar') || lowerQuestion.includes('microsoft') || lowerQuestion.includes('schedule')) {
      responseKey = 'meeting';
    }
    
    return {
      content: mockResponses[responseKey].content,
      model: 'mock-response',
      usage: { total_tokens: 0 }
    };
  }

  /**
   * Build system prompt based on user role
   * @private
   */
  _buildSystemPrompt(role = 'executive') {
    const rolePrompts = {
      sales: `You are helping a sales executive understand engineering work to close deals.
Focus on:
- Customer-facing features and capabilities
- Demo-ability and readiness
- Competitive advantages
- Technical requirements for deals
- Implementation timelines

Translate technical details into business value and sales talking points.`,

      marketing: `You are helping a marketing professional understand engineering work for announcements.
Focus on:
- New features and improvements
- User benefits and value propositions
- Competitive differentiators
- Technical innovations worth highlighting
- Launch readiness

Translate technical details into marketing messages and customer benefits.`,

      product: `You are helping a product manager understand engineering implementation.
Focus on:
- Feature completeness and quality
- Technical dependencies and blockers
- Implementation complexity
- Technical debt and risks
- Development velocity

Balance technical accuracy with product planning needs.`,

      executive: `You are helping a business executive understand engineering efforts.
Focus on:
- High-level progress and status
- Business impact and value
- Resource allocation
- Risks and opportunities
- Strategic technical decisions

Keep explanations clear and business-focused.`
    };

    const basePrompt = rolePrompts[role] || rolePrompts.executive;

    return `${basePrompt}

IMPORTANT GUIDELINES:
- Use clear, non-technical language
- Focus on business outcomes, not implementation details
- Provide specific examples when possible
- Highlight customer impact
- Be concise but comprehensive
- Use bullet points for clarity
- Include timelines when relevant

When discussing features:
- Status (complete, in progress, planned)
- Demo-ability (can it be shown to customers?)
- Customer benefit (why does it matter?)
- Competitive advantage (how does it differentiate us?)`;
  }

  /**
   * Format Copilot response for executives
   * @private
   */
  async _formatForExecutive(copilotResponse, question, context) {
    const content = copilotResponse.content;

    // Extract key information
    const summary = this._extractSummary(content);
    const businessImpact = this._extractBusinessImpact(content);
    const actionItems = this._extractActionItems(content);
    const technicalDetails = this._extractTechnicalDetails(content);

    // Get repository from context or default
    const repository = context.repository || this.options.repository;
    const repoInfo = repository ? `${repository.owner}/${repository.repo}` : 'multi-repo';
    
    return {
      summary,
      businessImpact,
      actionItems,
      technicalDetails,
      metadata: {
        question,
        role: context.role,
        timestamp: new Date().toISOString(),
        model: copilotResponse.model,
        repository: repoInfo
      }
    };
  }

  /**
   * Extract summary from response
   * @private
   */
  _extractSummary(content) {
    // If content is already formatted real GitHub data, return it all
    if (content.includes('Based on real GitHub data:') || content.includes('Issues Found:') || content.includes('Pull Requests Found:')) {
      return content;
    }
    
    // Look for summary section or use first paragraph
    const summaryMatch = content.match(/(?:Summary|Overview|TL;DR):?\s*\n?(.*?)(?:\n\n|\n#|$)/is);
    if (summaryMatch) {
      return summaryMatch[1].trim();
    }
    
    // Return first paragraph as summary
    const firstParagraph = content.split('\n\n')[0];
    return firstParagraph.trim();
  }

  /**
   * Extract business impact
   * @private
   */
  _extractBusinessImpact(content) {
    const impactMatch = content.match(/(?:Business Impact|Customer Impact|Value):?\s*\n?(.*?)(?:\n\n|\n#|$)/is);
    if (impactMatch) {
      return impactMatch[1].trim();
    }
    return null;
  }

  /**
   * Extract action items
   * @private
   */
  _extractActionItems(content) {
    const items = [];
    const actionMatch = content.match(/(?:Action Items|Next Steps|Recommendations):?\s*\n((?:[-*]\s.*\n?)+)/is);
    
    if (actionMatch) {
      const lines = actionMatch[1].split('\n').filter(l => l.trim());
      lines.forEach(line => {
        const cleaned = line.replace(/^[-*]\s*/, '').trim();
        if (cleaned) items.push(cleaned);
      });
    }
    
    return items.length > 0 ? items : null;
  }

  /**
   * Extract technical details
   * @private
   */
  _extractTechnicalDetails(content) {
    const techMatch = content.match(/(?:Technical Details|Implementation):?\s*\n?(.*?)(?:\n\n|\n#|$)/is);
    if (techMatch) {
      return techMatch[1].trim();
    }
    return null;
  }

  /**
   * Get feature status with enriched GitHub data
   */
  async getFeatureStatus(featureName, context = {}) {
    try {
      this.logger.info('Getting feature status', { feature: featureName });

      // 1. Query Copilot for code understanding
      const codeInsight = await this.queryCodebase(
        `What is the implementation status of the ${featureName} feature? Include: completion percentage, what's working, what's pending, and if it's ready to demo.`,
        context
      );

      // 2. Get related PRs from GitHub
      const repository = context.repository || this.options.repository;
      const prs = await this._searchPRs(featureName, repository);

      // 3. Get related issues
      const issues = await this._searchIssues(featureName, repository);

      // 4. Combine into comprehensive status
      return {
        feature: featureName,
        status: this._determineStatus(codeInsight, prs, issues),
        codeInsight: codeInsight.summary,
        businessImpact: codeInsight.businessImpact,
        completionEstimate: this._estimateCompletion(prs, issues),
        lastUpdated: prs[0]?.updated_at || new Date().toISOString(),
        relatedPRs: prs.slice(0, 5).map(pr => ({
          title: pr.title,
          state: pr.state,
          url: pr.html_url,
          author: pr.user.login,
          updated: pr.updated_at
        })),
        relatedIssues: issues.slice(0, 5).map(issue => ({
          title: issue.title,
          state: issue.state,
          url: issue.html_url,
          labels: issue.labels.map(l => l.name)
        })),
        demoable: this._isDemoable(codeInsight, prs),
        keyContributors: this._extractContributors(prs)
      };

    } catch (error) {
      this.logger.error('Failed to get feature status', {
        error: error.message,
        feature: featureName
      });
      throw error;
    }
  }

  /**
   * Search GitHub PRs
   * @private
   */
  async _searchPRs(query, repository = null) {
    try {
      if (!repository) {
        this.logger.warn('No repository specified for PR search');
        return [];
      }
      
      const octokit = await this._getOctokit();
      const { data } = await octokit.search.issuesAndPullRequests({
        q: `${query} repo:${repository.owner}/${repository.repo} is:pr`,
        sort: 'updated',
        order: 'desc',
        per_page: 10
      });
      return data.items;
    } catch (error) {
      this.logger.warn('Failed to search PRs', { error: error.message });
      return [];
    }
  }

  /**
   * Search GitHub issues
   * @private
   */
  async _searchIssues(query, repository = null) {
    try {
      if (!repository) {
        this.logger.warn('No repository specified for issue search');
        return [];
      }
      
      const octokit = await this._getOctokit();
      const { data } = await octokit.search.issuesAndPullRequests({
        q: `${query} repo:${repository.owner}/${repository.repo} is:issue`,
        sort: 'updated',
        order: 'desc',
        per_page: 10
      });
      return data.items;
    } catch (error) {
      this.logger.warn('Failed to search issues', { error: error.message });
      return [];
    }
  }

  /**
   * Determine feature status
   * @private
   */
  _determineStatus(codeInsight, prs, issues) {
    const openPRs = prs.filter(pr => pr.state === 'open').length;
    const mergedPRs = prs.filter(pr => pr.state === 'closed' && pr.pull_request?.merged_at).length;
    const openIssues = issues.filter(issue => issue.state === 'open').length;

    if (mergedPRs > 0 && openPRs === 0 && openIssues === 0) {
      return 'complete';
    } else if (openPRs > 0 || mergedPRs > 0) {
      return 'in_progress';
    } else {
      return 'planned';
    }
  }

  /**
   * Estimate completion percentage
   * @private
   */
  _estimateCompletion(prs, issues) {
    const totalPRs = prs.length;
    const mergedPRs = prs.filter(pr => pr.state === 'closed' && pr.pull_request?.merged_at).length;
    const closedIssues = issues.filter(issue => issue.state === 'closed').length;
    const totalIssues = issues.length;

    if (totalPRs === 0 && totalIssues === 0) return 0;

    const prCompletion = totalPRs > 0 ? (mergedPRs / totalPRs) : 0;
    const issueCompletion = totalIssues > 0 ? (closedIssues / totalIssues) : 0;

    return Math.round(((prCompletion + issueCompletion) / 2) * 100);
  }

  /**
   * Check if feature is demo-able
   * @private
   */
  _isDemoable(codeInsight, prs) {
    const summary = codeInsight.summary.toLowerCase();
    const hasMergedPRs = prs.some(pr => pr.state === 'closed' && pr.pull_request?.merged_at);
    
    const demoKeywords = ['demo', 'ready', 'complete', 'working', 'functional', 'production'];
    const hasDemoKeywords = demoKeywords.some(keyword => summary.includes(keyword));

    return hasMergedPRs && hasDemoKeywords;
  }

  /**
   * Extract key contributors
   * @private
   */
  _extractContributors(prs) {
    const contributors = new Map();
    
    prs.forEach(pr => {
      const author = pr.user.login;
      contributors.set(author, (contributors.get(author) || 0) + 1);
    });

    return Array.from(contributors.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([name, count]) => ({ name, contributions: count }));
  }

  /**
   * Get sprint summary
   */
  async getSprintSummary(sprintNumber, context = {}) {
    try {
      this.logger.info('Getting sprint summary', { sprint: sprintNumber });

      const question = `Summarize the features and improvements completed in sprint ${sprintNumber}. 
      For each feature, include:
      - What was built
      - Customer benefit
      - Demo-ability
      - Any notable technical achievements`;

      const response = await this.queryCodebase(question, {
        ...context,
        role: context.role || 'executive'
      });

      return {
        sprint: sprintNumber,
        summary: response.summary,
        businessImpact: response.businessImpact,
        actionItems: response.actionItems,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      this.logger.error('Failed to get sprint summary', {
        error: error.message,
        sprint: sprintNumber
      });
      throw error;
    }
  }

  /**
   * Health check - Verifies GitHub App is installed and authenticated
   */
  async healthCheck() {
    try {
      // Simply verify we can get an authenticated Octokit client
      const octokit = await this._getOctokit();
      
      // Test authentication by checking rate limit (works for both PAT and GitHub App)
      const { data } = await octokit.rateLimit.get();
      
      // Determine auth type based on what's configured
      let authType = 'none';
      let appId = null;
      let installationId = null;
      let repoCount = null;
      
      if (process.env.GITHUB_APP_ID && process.env.GITHUB_APP_INSTALLATION_ID) {
        authType = 'GitHub App';
        appId = process.env.GITHUB_APP_ID;
        installationId = process.env.GITHUB_APP_INSTALLATION_ID;
        
        // Get accessible repo count for GitHub App
        try {
          const { data: repos } = await octokit.apps.listReposAccessibleToInstallation();
          repoCount = repos.total_count;
        } catch (e) {
          // If this fails, it's okay - we're still connected
        }
      } else if (this.options.githubToken) {
        authType = 'Personal Access Token';
      }

      this.logger.info('GitHub health check passed', {
        authType,
        rateLimit: data.rate.limit,
        remaining: data.rate.remaining
      });

      return {
        status: 'healthy',
        github: 'connected',
        authType,
        appId,
        installationId,
        repoCount,
        rateLimit: {
          limit: data.rate.limit,
          remaining: data.rate.remaining,
          reset: new Date(data.rate.reset * 1000).toISOString()
        }
      };

    } catch (error) {
      this.logger.error('GitHub health check failed', { error: error.message });
      return {
        status: 'unhealthy',
        github: 'disconnected',
        error: error.message
      };
    }
  }
}

module.exports = EngineeringIntelligenceService;
