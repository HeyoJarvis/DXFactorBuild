/**
 * JIRA Command Parser
 * 
 * Parse natural language commands from chat into structured JIRA operations
 * Uses AI to extract intent, issue keys, fields, and values
 * 
 * Features:
 * 1. Parse create/update/comment/transition/delete commands
 * 2. Extract issue keys (PROJ-123 format)
 * 3. Intelligently map priorities, statuses, issue types
 * 4. Handle ambiguous or incomplete commands
 */

const winston = require('winston');
const Anthropic = require('@anthropic-ai/sdk');

class JIRACommandParser {
  constructor(options = {}) {
    this.options = {
      model: options.model || 'claude-3-5-sonnet-20241022',
      temperature: options.temperature || 0.2, // Lower for more deterministic parsing
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
          filename: 'logs/jira-command-parser.log',
          maxsize: 5242880, // 5MB
          maxFiles: 5
        })
      ],
      defaultMeta: { service: 'jira-command-parser' }
    });

    // Initialize Anthropic client
    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY
    });

    this.logger.info('JIRA Command Parser initialized', {
      model: this.options.model
    });
  }

  /**
   * Parse natural language command into structured JIRA operation
   * @param {string} query - Natural language query
   * @param {Object} context - Additional context (user, project)
   * @returns {Promise<Object>} Parsed command
   */
  async parse(query, context = {}) {
    try {
      this.logger.info('Parsing JIRA command', {
        query,
        context
      });

      // Quick regex check for issue keys
      const issueKeyMatch = query.match(/[A-Z]{2,10}-\d+/);
      const hasIssueKey = !!issueKeyMatch;

      const prompt = `You are a JIRA command parser. Parse this natural language query into a structured JIRA operation.

QUERY: "${query}"

CONTEXT:
- User: ${context.userName || 'unknown'}
- Default Project: ${context.defaultProject || 'none specified'}
- Available Actions: create, update, comment, transition (change status), delete

Parse the query and respond in JSON format:
{
  "action": "create|update|comment|transition|delete",
  "confidence": 0.0-1.0,
  "issueKey": "PROJ-123 or null for create",
  "projectKey": "PROJ (for create action)",
  "data": {
    "summary": "issue title",
    "description": "detailed description",
    "issueType": "Bug|Task|Story",
    "priority": "Highest|High|Medium|Low|Lowest",
    "assignee": "email or name",
    "labels": ["label1", "label2"],
    "status": "To Do|In Progress|Done|etc",
    "commentText": "comment content"
  }
}

PARSING GUIDELINES:
1. **CREATE** - Keywords: "create", "new", "add", "ticket", "issue"
   - Extract: summary, description, type, priority
   - Example: "Create a bug for login API failing" → action=create, issueType=Bug, summary="Login API failing"

2. **UPDATE** - Keywords: "update", "change", "modify", "set"
   - Requires: issueKey (PROJ-123)
   - Extract fields to update
   - Example: "Update PROJ-123 priority to High" → action=update, issueKey=PROJ-123, data.priority=High

3. **COMMENT** - Keywords: "add comment", "comment on", "note"
   - Requires: issueKey
   - Extract comment text
   - Example: "Add comment to PROJ-456: Deployed to staging" → action=comment, commentText="Deployed to staging"

4. **TRANSITION** - Keywords: "move to", "change status", "mark as", "set status"
   - Requires: issueKey
   - Extract target status
   - Example: "Move PROJ-789 to In Progress" → action=transition, status="In Progress"

5. **DELETE** - Keywords: "delete", "remove"
   - Requires: issueKey
   - Example: "Delete PROJ-100" → action=delete

FIELD MAPPINGS:
- Priority: map "urgent"→"Highest", "important"→"High", "normal"→"Medium", "minor"→"Low"
- Issue Type: infer from context (bug fixes→Bug, features→Story, general→Task)
- Status: common values are "To Do", "In Progress", "In Review", "Done"

EDGE CASES:
- If project is not specified for create, use defaultProject from context
- If action is ambiguous, choose most likely based on keywords
- If confidence < 0.6, include "needsClarification": true with "clarificationNeeded" field

Respond ONLY with valid JSON.`;

      const response = await this.anthropic.messages.create({
        model: this.options.model,
        max_tokens: 500,
        temperature: this.options.temperature,
        messages: [{
          role: 'user',
          content: prompt
        }]
      });

      const analysisText = response.content[0].text;
      
      // Parse JSON response
      const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        this.logger.error('AI response not JSON', { 
          query,
          response: analysisText 
        });
        return this.fallbackParse(query, hasIssueKey, issueKeyMatch);
      }

      const parsed = JSON.parse(jsonMatch[0]);
      
      // Validate parsed command
      const validatedCommand = this._validateCommand(parsed, query, context);

      this.logger.info('JIRA command parsed', {
        action: validatedCommand.action,
        issueKey: validatedCommand.issueKey,
        confidence: validatedCommand.confidence
      });

      return validatedCommand;

    } catch (error) {
      this.logger.error('Command parsing failed', {
        query,
        error: error.message,
        stack: error.stack
      });
      
      // Try fallback parsing
      const issueKeyMatch = query.match(/[A-Z]{2,10}-\d+/);
      return this.fallbackParse(query, !!issueKeyMatch, issueKeyMatch);
    }
  }

  /**
   * Validate and normalize parsed command
   * @param {Object} parsed - Parsed command from AI
   * @param {string} originalQuery - Original query
   * @param {Object} context - Context
   * @returns {Object} Validated command
   */
  _validateCommand(parsed, originalQuery, context) {
    const validActions = ['create', 'update', 'comment', 'transition', 'delete'];
    
    // Validate action
    if (!validActions.includes(parsed.action)) {
      parsed.action = 'create'; // Default to create
      parsed.confidence = Math.min(parsed.confidence || 0, 0.5);
    }

    // Ensure confidence is in valid range
    parsed.confidence = Math.min(Math.max(parsed.confidence || 0, 0), 1);

    // Normalize data object
    parsed.data = parsed.data || {};

    // For create action, ensure project key
    if (parsed.action === 'create' && !parsed.projectKey) {
      parsed.projectKey = context.defaultProject || null;
    }

    // For update/comment/transition/delete, ensure issue key
    if (['update', 'comment', 'transition', 'delete'].includes(parsed.action)) {
      if (!parsed.issueKey) {
        // Try to extract from query
        const issueKeyMatch = originalQuery.match(/[A-Z]{2,10}-\d+/);
        parsed.issueKey = issueKeyMatch ? issueKeyMatch[0] : null;
        
        if (!parsed.issueKey) {
          parsed.needsClarification = true;
          parsed.clarificationNeeded = 'issue_key';
        }
      }
    }

    // Normalize priority
    if (parsed.data.priority) {
      parsed.data.priority = this._normalizePriority(parsed.data.priority);
    }

    // Normalize issue type
    if (parsed.data.issueType) {
      parsed.data.issueType = this._normalizeIssueType(parsed.data.issueType);
    }

    // For comment action, ensure commentText
    if (parsed.action === 'comment' && !parsed.data.commentText) {
      // Try to extract comment from query
      const commentMatch = originalQuery.match(/comment[:\s]+(.+)/i);
      if (commentMatch) {
        parsed.data.commentText = commentMatch[1].trim();
      }
    }

    // For transition action, ensure status
    if (parsed.action === 'transition' && !parsed.data.status) {
      parsed.needsClarification = true;
      parsed.clarificationNeeded = 'target_status';
    }

    return {
      ...parsed,
      originalQuery,
      parsedAt: new Date().toISOString()
    };
  }

  /**
   * Normalize priority to JIRA standard values
   * @param {string} priority - Priority string
   * @returns {string} Normalized priority
   */
  _normalizePriority(priority) {
    const priorityMap = {
      'urgent': 'Highest',
      'critical': 'Highest',
      'highest': 'Highest',
      'important': 'High',
      'high': 'High',
      'normal': 'Medium',
      'medium': 'Medium',
      'low': 'Low',
      'minor': 'Low',
      'lowest': 'Lowest',
      'trivial': 'Lowest'
    };

    const normalized = priorityMap[priority.toLowerCase()];
    return normalized || 'Medium';
  }

  /**
   * Normalize issue type to JIRA standard values
   * @param {string} issueType - Issue type string
   * @returns {string} Normalized issue type
   */
  _normalizeIssueType(issueType) {
    const typeMap = {
      'bug': 'Bug',
      'defect': 'Bug',
      'issue': 'Bug',
      'task': 'Task',
      'todo': 'Task',
      'story': 'Story',
      'feature': 'Story',
      'user story': 'Story',
      'epic': 'Epic',
      'subtask': 'Sub-task'
    };

    const normalized = typeMap[issueType.toLowerCase()];
    return normalized || 'Task';
  }

  /**
   * Fallback parsing using simple regex patterns
   * @param {string} query - Query text
   * @param {boolean} hasIssueKey - Whether issue key was found
   * @param {Array} issueKeyMatch - Regex match for issue key
   * @returns {Object} Basic parsed command
   */
  fallbackParse(query, hasIssueKey, issueKeyMatch) {
    const queryLower = query.toLowerCase();

    let action = 'create'; // Default
    let issueKey = hasIssueKey && issueKeyMatch ? issueKeyMatch[0] : null;
    let data = {};

    // Detect action from keywords
    if (queryLower.includes('comment') || queryLower.includes('add note')) {
      action = 'comment';
      const commentMatch = query.match(/comment[:\s]+(.+)/i);
      if (commentMatch) {
        data.commentText = commentMatch[1].trim();
      }
    } else if (queryLower.includes('update') || queryLower.includes('change') || queryLower.includes('modify')) {
      action = 'update';
    } else if (queryLower.includes('move to') || queryLower.includes('status') || queryLower.includes('mark as')) {
      action = 'transition';
      const statusMatch = query.match(/(?:move to|status|mark as)\s+(.+)/i);
      if (statusMatch) {
        data.status = statusMatch[1].trim();
      }
    } else if (queryLower.includes('delete') || queryLower.includes('remove')) {
      action = 'delete';
    } else if (queryLower.includes('create') || queryLower.includes('new') || queryLower.includes('add')) {
      action = 'create';
      data.summary = query.replace(/create|new|add|ticket|issue|jira/gi, '').trim();
      
      // Detect issue type
      if (queryLower.includes('bug')) {
        data.issueType = 'Bug';
      } else if (queryLower.includes('story') || queryLower.includes('feature')) {
        data.issueType = 'Story';
      } else {
        data.issueType = 'Task';
      }
    }

    return {
      action,
      confidence: 0.4,
      issueKey,
      projectKey: null,
      data,
      originalQuery: query,
      parsedAt: new Date().toISOString(),
      fallback: true,
      needsClarification: true,
      clarificationNeeded: action === 'create' ? 'project_key' : 'details'
    };
  }

  /**
   * Validate if query is a JIRA command
   * @param {string} query - Query text
   * @returns {boolean} True if likely a JIRA command
   */
  isJIRACommand(query) {
    const queryLower = query.toLowerCase();
    
    // Check for JIRA keywords
    const jiraKeywords = [
      'jira', 'ticket', 'issue',
      'create ticket', 'new issue', 'create issue',
      'update', 'change status', 'move to',
      'comment on', 'add comment',
      'delete issue'
    ];

    const hasJIRAKeyword = jiraKeywords.some(keyword => queryLower.includes(keyword));
    
    // Check for issue key pattern (PROJ-123)
    const hasIssueKey = /[A-Z]{2,10}-\d+/.test(query);

    return hasJIRAKeyword || hasIssueKey;
  }

  /**
   * Extract all issue keys from text
   * @param {string} text - Text to search
   * @returns {Array<string>} Array of issue keys
   */
  extractIssueKeys(text) {
    const matches = text.match(/[A-Z]{2,10}-\d+/g);
    return matches || [];
  }
}

module.exports = JIRACommandParser;

