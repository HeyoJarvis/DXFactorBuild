/**
 * Team Context Engine
 * 
 * AI-powered Q&A system using meeting summaries, JIRA, and GitHub data
 */

const winston = require('winston');
const EventEmitter = require('events');

class TeamContextEngine extends EventEmitter {
  constructor({ supabaseAdapter, logger }) {
    super();
    
    this.supabaseAdapter = supabaseAdapter;
    this.logger = logger || this._createLogger();
    this.apiKey = process.env.ANTHROPIC_API_KEY;
    this.conversationHistories = new Map();
    
    this.logger.info('Team Context Engine initialized');
  }

  _createLogger() {
    return winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [new winston.transports.Console()],
      defaultMeta: { service: 'team-context-engine' }
    });
  }

  async askQuestion(userId, question, options = {}) {
    try {
      if (!this.apiKey) {
        throw new Error('ANTHROPIC_API_KEY not configured');
      }

      let meetings = [];
      let updates = [];

      // 🎯 Use filtered context if provided (ONLY selected items)
      if (options.filteredContext) {
        meetings = options.filteredContext.meetings || [];
        updates = options.filteredContext.tasks || [];
        
        this.logger.info('Using filtered context', {
          meetings: meetings.length,
          tasks: updates.length
        });
      } 
      // Fallback: Query database for ALL context (backward compatibility)
      else {
        const [meetingsResult, updatesResult] = await Promise.all([
          this.supabaseAdapter.supabase
            .from('team_meetings')
            .select('*')
            .eq('user_id', userId)
            .order('start_time', { ascending: false })
            .limit(10),
          this.supabaseAdapter.supabase
            .from('team_updates')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(20)
        ]);

        meetings = meetingsResult.data || [];
        updates = updatesResult.data || [];
        
        this.logger.info('Using all context (no filter)', {
          meetings: meetings.length,
          updates: updates.length
        });
      }

      // Generate AI response
      const context = this._buildContext(meetings, updates, options.codeContext);
      const answer = await this._generateAnswer(question, context);

      // Build context_used object
      const contextUsed = {
        meetings: meetings.length,
        jira: updates.filter(u => u.update_type === 'jira_issue').length,
        github: updates.filter(u => u.update_type.startsWith('github_')).length
      };

      // Add code chunks count if available
      if (options.codeContext && options.codeContext.sources) {
        contextUsed.codeChunks = options.codeContext.sources.length;
      }

      return {
        success: true,
        answer: answer,
        context_used: contextUsed
      };

    } catch (error) {
      this.logger.error('Failed to answer question', { error: error.message });
      return {
        success: false,
        error: error.message
      };
    }
  }

  _buildContext(meetings, updates, codeContext = null) {
    let context = 'Team Context:\n\n';
    
    if (meetings.length > 0) {
      context += 'Recent Meetings:\n';
      meetings.forEach(m => {
        context += `- ${m.title} (${new Date(m.start_time).toLocaleString()})\n`;
        
        // Include AI summary if available (preferred)
        if (m.ai_summary) {
          context += `  Summary: ${m.ai_summary}\n`;
        }
        
        // Include key decisions if available
        if (m.key_decisions && Array.isArray(m.key_decisions) && m.key_decisions.length > 0) {
          context += `  Key Decisions: ${m.key_decisions.join(', ')}\n`;
        }
        
        // Include action items if available
        if (m.action_items && Array.isArray(m.action_items) && m.action_items.length > 0) {
          context += `  Action Items: ${m.action_items.join(', ')}\n`;
        }
        
        // Include topics if available
        if (m.topics && Array.isArray(m.topics) && m.topics.length > 0) {
          context += `  Topics: ${m.topics.join(', ')}\n`;
        }
        
        // Include attendees if available
        if (m.attendees && Array.isArray(m.attendees) && m.attendees.length > 0) {
          context += `  Attendees: ${m.attendees.map(a => a.name || a.email).join(', ')}\n`;
        }
        
        // Fallback: include copilot or manual notes if no summary
        if (!m.ai_summary) {
          if (m.copilot_notes) {
            context += `  Notes: ${m.copilot_notes}\n`;
          } else if (m.manual_notes) {
            context += `  Notes: ${m.manual_notes}\n`;
          }
        }
      });
      context += '\n';
    }

    if (updates.length > 0) {
      context += 'JIRA Tasks & Updates:\n';
      updates.forEach(u => {
        context += `\n- [${u.update_type}] ${u.title}\n`;
        
        // Add JIRA-specific details
        if (u.update_type && u.update_type.startsWith('jira_')) {
          if (u.description) {
            context += `  Description: ${u.description}\n`;
          }
          
          if (u.metadata) {
            if (u.metadata.status) {
              context += `  Status: ${u.metadata.status}\n`;
            }
            if (u.metadata.priority) {
              context += `  Priority: ${u.metadata.priority}\n`;
            }
            if (u.metadata.assignee) {
              const assigneeName = typeof u.metadata.assignee === 'object' 
                ? (u.metadata.assignee.displayName || u.metadata.assignee.email)
                : u.metadata.assignee;
              context += `  Assignee: ${assigneeName}\n`;
            }
            if (u.metadata.project) {
              const projectName = typeof u.metadata.project === 'object'
                ? (u.metadata.project.name || u.metadata.project.key)
                : u.metadata.project;
              context += `  Project: ${projectName}\n`;
            }
            if (u.metadata.labels && Array.isArray(u.metadata.labels) && u.metadata.labels.length > 0) {
              context += `  Labels: ${u.metadata.labels.join(', ')}\n`;
            }
          }
          
          if (u.link) {
            context += `  Link: ${u.link}\n`;
          }
        }
        
        // Add GitHub-specific details
        if (u.update_type && u.update_type.startsWith('github_')) {
          if (u.description) {
            context += `  Details: ${u.description}\n`;
          }
          if (u.metadata) {
            if (u.metadata.author) {
              context += `  Author: ${u.metadata.author}\n`;
            }
            if (u.metadata.repository) {
              context += `  Repository: ${u.metadata.repository}\n`;
            }
          }
        }
      });
      context += '\n';
    }

    // Add code context if available
    if (codeContext && codeContext.answer) {
      context += 'Codebase Information:\n';
      context += codeContext.answer + '\n\n';
      
      if (codeContext.sources && codeContext.sources.length > 0) {
        context += 'Code References:\n';
        codeContext.sources.forEach(source => {
          context += `- ${source.repository}/${source.file}\n`;
        });
        context += '\n';
      }
    }

    return context || 'No team data available yet.';
  }

  async _generateAnswer(question, context) {
    const systemPrompt = `You are an intelligent team assistant with access to comprehensive team information including:
- Meeting summaries, decisions, and action items
- JIRA tasks with descriptions, status, and assignments
- GitHub code activity and repository information (actual codebase content)

🚨 CRITICAL DISTINCTIONS - READ CAREFULLY:

1. **JIRA Integration vs. JIRA Task Feature**
   - JIRA Integration = System capability to sync with JIRA (meta-level)
   - JIRA Task Feature = The specific feature/functionality described IN a JIRA task
   - DON'T confuse these! If user asks "is my JIRA task implemented?", they mean the FEATURE in the task, NOT the integration system.

2. **JIRA Tasks = PLANNED work** (not implemented unless proven by code)
   - Tasks describe features to build
   - Tasks existing ≠ features existing

3. **Codebase Information = ACTUAL implementation** (what really exists)
   - Only trust this section for "what's implemented"
   - Code files about "jira integration" ≠ features from jira tasks being implemented

🎯 WHEN USER ASKS ABOUT "JIRA TASK" OR "THE TASK":

Step 1: Look at JIRA Tasks section → What feature does the task describe?
Step 2: Look at Codebase Information → Do you see that SPECIFIC feature implemented?
Step 3: Answer clearly:
   - If feature code exists → "Yes, [feature] is implemented in [files]"
   - If feature code missing → "No, [feature] is NOT implemented yet. There's a JIRA task for it, but no code exists yet."

❌ WRONG ANSWER: "Yes, there's JIRA integration code" (when asked about a task feature)
✅ RIGHT ANSWER: "No, the feature described in your JIRA task is not implemented yet"

Examples:
- "Is my JIRA task in the code?" → Look for the FEATURE described in the task, NOT jira integration files
- "Is [feature] implemented?" → Check Codebase Information ONLY
- "What JIRA tasks do I have?" → Just list the tasks`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 2048,
        temperature: 0.7,
        system: systemPrompt,
        messages: [{
          role: 'user',
          content: `You have access to the following team context:

${context}

User's question: ${question}

🚨 CRITICAL INSTRUCTIONS:

1. If the question mentions "JIRA task" or "the task":
   → Look at what FEATURE the task describes
   → Check if THAT FEATURE is in "Codebase Information" section
   → Don't confuse "JIRA integration code" with "task feature code"

2. Files like "jira-adapter.js" or "jira-service.js" are JIRA INTEGRATION (the system), NOT the features described in tasks.

3. Only say "Yes, [feature] is implemented" if you see actual code for THAT SPECIFIC FEATURE.

4. If you only see the feature in JIRA tasks but NOT in codebase, say: "No, this feature is not implemented yet. There's a JIRA task for it, but no code exists."`
        }]
      })
    });

    const data = await response.json();
    return data.content[0].text;
  }

  clearHistory(userId) {
    this.conversationHistories.delete(userId);
  }

  getHistory(userId) {
    return this.conversationHistories.get(userId) || [];
  }

  // ==================== TEAM-AWARE QUERIES ====================

  /**
   * Ask question with team-scoped context
   * @param {string} teamId - Team ID
   * @param {string} question - Question to ask
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Answer with context used
   */
  async askQuestionForTeam(teamId, question, options = {}) {
    try {
      if (!this.apiKey) {
        throw new Error('ANTHROPIC_API_KEY not configured');
      }

      this.logger.info('Team-scoped query', { teamId, question: question.substring(0, 50) });

      // 1. Fetch team context (meetings, tasks, repos)
      const contextResult = await this.supabaseAdapter.getTeamContext(teamId, options);
      
      if (!contextResult.success) {
        throw new Error('Failed to fetch team context: ' + contextResult.error);
      }

      const meetings = contextResult.meetings || [];
      const tasks = contextResult.tasks || [];
      const repositories = contextResult.repositories || [];

      this.logger.info('Team context loaded', {
        teamId,
        meetings: meetings.length,
        tasks: tasks.length,
        repositories: repositories.length
      });

      // 2. Include code context from team's repositories (always try if repos are assigned)
      let codeContext = null;
      if (this.codeIndexer && repositories.length > 0) {
        this.logger.info('Fetching code context for team repositories', {
          teamId,
          repoCount: repositories.length,
          includeCodeOption: options.includeCode
        });
        
        codeContext = await this._fetchTeamCodeContext(teamId, question, repositories);
        
        if (codeContext && codeContext.count > 0) {
          this.logger.info('Code context included in team query', {
            teamId,
            codeChunks: codeContext.count
          });
        }
      }

      // 3. Generate answer with team-scoped context
      const answer = await this.askQuestion(null, question, {
        filteredContext: { meetings, tasks },
        codeContext
      });

      // Add team info to response
      answer.teamId = teamId;
      answer.repositories = repositories.length;

      return answer;

    } catch (error) {
      this.logger.error('Team-scoped query failed', {
        teamId,
        error: error.message,
        stack: error.stack
      });
      
      return {
        success: false,
        error: error.message,
        answer: 'Sorry, I encountered an error processing your question for this team.'
      };
    }
  }

  /**
   * Fetch code context from team's repositories
   * @param {string} teamId - Team ID
   * @param {string} query - Search query
   * @param {Array} repositories - Team's repositories
   * @returns {Promise<Object>} Code context with sources
   * @private
   */
  async _fetchTeamCodeContext(teamId, query, repositories) {
    try {
      if (!this.codeIndexer || !this.codeIndexer.queryEngine) {
        this.logger.warn('Code indexer not available');
        return null;
      }

      const allChunks = [];

      // Search across each team repository
      for (const repo of repositories) {
        try {
          this.logger.debug('Searching repository', {
            teamId,
            repo: `${repo.repository_owner}/${repo.repository_name}`
          });

          // Use the correct API: queryEngine.query()
          const result = await this.codeIndexer.queryEngine.query(query, {
            repositoryOwner: repo.repository_owner,
            repositoryName: repo.repository_name,
            limit: 5  // Limit per repo
          });

          // Extract chunks from result
          if (result && result.chunks && result.chunks.length > 0) {
            allChunks.push(...result.chunks);
          }
        } catch (error) {
          this.logger.warn('Failed to search repository', {
            teamId,
            repo: `${repo.repository_owner}/${repo.repository_name}`,
            error: error.message
          });
          // Continue with other repos
        }
      }

      if (allChunks.length === 0) {
        return null;
      }

      // Sort by similarity and take top 10
      allChunks.sort((a, b) => (b.similarity || 0) - (a.similarity || 0));
      const topChunks = allChunks.slice(0, 10);

      this.logger.info('Code context fetched for team', {
        teamId,
        totalChunks: topChunks.length,
        repositories: repositories.length
      });

      return {
        sources: topChunks,
        count: topChunks.length
      };

    } catch (error) {
      this.logger.error('Failed to fetch team code context', {
        teamId,
        error: error.message
      });
      return null;
    }
  }

  /**
   * Set code indexer for code context queries
   * @param {Object} codeIndexer - Code indexer instance
   */
  setCodeIndexer(codeIndexer) {
    this.codeIndexer = codeIndexer;
    this.logger.info('Code indexer attached to TeamContextEngine');
  }
}

module.exports = TeamContextEngine;

