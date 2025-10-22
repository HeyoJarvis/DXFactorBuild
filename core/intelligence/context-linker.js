/**
 * Context Linker
 *
 * Links JIRA tickets back to their original source context (Slack messages, emails, etc.)
 * Enables semantic translator to provide richer, contextual translations
 *
 * Features:
 * - Store original request context when tasks are created
 * - Retrieve context when JIRA updates occur
 * - Extract JIRA references from messages
 * - Track request → task → completion lifecycle
 */

const winston = require('winston');

class ContextLinker {
  constructor(workflowAnalyzer, options = {}) {
    this.workflowAnalyzer = workflowAnalyzer;
    this.options = {
      maxContextAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      cleanupInterval: 24 * 60 * 60 * 1000, // Daily cleanup
      ...options
    };

    this.logger = winston.createLogger({
      level: options.logLevel || 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      defaultMeta: { service: 'context-linker' }
    });

    // In-memory storage: issueKey → context
    // For production, should use Redis or database
    this.issueContextMap = new Map();

    // Reverse index: slackMessageId → issueKeys[]
    this.messageToIssuesMap = new Map();

    // Start periodic cleanup
    this._startCleanup();
  }

  /**
   * Link a JIRA issue to its original source context
   */
  async linkIssueToContext(issueKey, context) {
    try {
      if (!issueKey || !context) {
        throw new Error('Issue key and context are required');
      }

      const enrichedContext = {
        issue_key: issueKey,
        source: context.source || 'unknown', // 'slack', 'email', 'manual', 'api'
        original_message: context.message || context.text,
        requestor: context.user || context.from,
        requestor_name: context.user_name || context.from_name,
        channel: context.channel || context.channel_id,
        channel_name: context.channel_name,
        timestamp: context.timestamp || new Date().toISOString(),
        message_id: context.message_id || context.ts,

        // Work request analysis (if available)
        work_analysis: context.work_analysis ? {
          work_type: context.work_analysis.workType,
          urgency: context.work_analysis.urgency,
          confidence: context.work_analysis.confidence,
          estimated_effort: context.work_analysis.estimatedEffort
        } : null,

        // Workflow intelligence data (if available)
        workflow_data: context.workflow_data ? {
          intent: context.workflow_data.intent,
          entities: context.workflow_data.entities,
          urgency: context.workflow_data.urgency
        } : null,

        // Metadata
        linked_at: new Date().toISOString(),
        context_version: '1.0'
      };

      // Store in primary index
      this.issueContextMap.set(issueKey, enrichedContext);

      // Store in reverse index (for finding issues from messages)
      if (enrichedContext.message_id) {
        const existingIssues = this.messageToIssuesMap.get(enrichedContext.message_id) || [];
        existingIssues.push(issueKey);
        this.messageToIssuesMap.set(enrichedContext.message_id, existingIssues);
      }

      this.logger.info('Context linked to JIRA issue', {
        issue_key: issueKey,
        source: enrichedContext.source,
        requestor: enrichedContext.requestor,
        has_work_analysis: !!enrichedContext.work_analysis
      });

      return { success: true, context: enrichedContext };

    } catch (error) {
      this.logger.error('Failed to link context', {
        issue_key: issueKey,
        error: error.message
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * Retrieve original context for a JIRA issue
   */
  async getOriginalContext(issueKey) {
    try {
      const context = this.issueContextMap.get(issueKey);

      if (!context) {
        this.logger.debug('No context found for issue', { issue_key: issueKey });
        return null;
      }

      // Check if context is too old
      const contextAge = Date.now() - new Date(context.linked_at).getTime();
      if (contextAge > this.options.maxContextAge) {
        this.logger.warn('Context expired', {
          issue_key: issueKey,
          age_days: Math.floor(contextAge / (24 * 60 * 60 * 1000))
        });
        return null;
      }

      this.logger.debug('Context retrieved', {
        issue_key: issueKey,
        source: context.source,
        age_hours: Math.floor(contextAge / (60 * 60 * 1000))
      });

      return context;

    } catch (error) {
      this.logger.error('Failed to retrieve context', {
        issue_key: issueKey,
        error: error.message
      });
      return null;
    }
  }

  /**
   * Find JIRA issues linked to a Slack message
   */
  async getIssuesForMessage(messageId) {
    const issueKeys = this.messageToIssuesMap.get(messageId) || [];

    this.logger.debug('Issues found for message', {
      message_id: messageId,
      issue_count: issueKeys.length
    });

    return issueKeys;
  }

  /**
   * Extract JIRA references from text (using existing workflow analyzer)
   */
  extractJIRAReferences(text) {
    if (!text) return [];

    try {
      // JIRA ticket pattern: PROJECT-123
      const jiraPattern = /\b([A-Z][A-Z0-9]+-\d+)\b/g;
      const matches = text.match(jiraPattern) || [];

      // Deduplicate
      const uniqueRefs = [...new Set(matches)];

      // Also use workflow analyzer's entity extraction if available
      if (this.workflowAnalyzer && this.workflowAnalyzer.extractEntities) {
        try {
          const entities = this.workflowAnalyzer.extractEntities(text);
          const conceptRefs = (entities.concepts || []).filter(c => /[A-Z]+-\d+/.test(c));
          uniqueRefs.push(...conceptRefs);
        } catch (error) {
          this.logger.warn('Workflow analyzer entity extraction failed', { error: error.message });
        }
      }

      return [...new Set(uniqueRefs)]; // Deduplicate again

    } catch (error) {
      this.logger.error('Failed to extract JIRA references', { error: error.message });
      return [];
    }
  }

  /**
   * Update context for an existing issue (e.g., add new information)
   */
  async updateContext(issueKey, updates) {
    try {
      const existingContext = this.issueContextMap.get(issueKey);

      if (!existingContext) {
        this.logger.warn('Cannot update - context not found', { issue_key: issueKey });
        return { success: false, error: 'Context not found' };
      }

      const updatedContext = {
        ...existingContext,
        ...updates,
        updated_at: new Date().toISOString()
      };

      this.issueContextMap.set(issueKey, updatedContext);

      this.logger.info('Context updated', {
        issue_key: issueKey,
        updated_fields: Object.keys(updates)
      });

      return { success: true, context: updatedContext };

    } catch (error) {
      this.logger.error('Failed to update context', {
        issue_key: issueKey,
        error: error.message
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * Delete context for an issue
   */
  async deleteContext(issueKey) {
    try {
      const context = this.issueContextMap.get(issueKey);

      if (!context) {
        return { success: true, message: 'Context not found' };
      }

      // Remove from primary index
      this.issueContextMap.delete(issueKey);

      // Remove from reverse index
      if (context.message_id) {
        const issues = this.messageToIssuesMap.get(context.message_id) || [];
        const filtered = issues.filter(k => k !== issueKey);
        if (filtered.length > 0) {
          this.messageToIssuesMap.set(context.message_id, filtered);
        } else {
          this.messageToIssuesMap.delete(context.message_id);
        }
      }

      this.logger.info('Context deleted', { issue_key: issueKey });

      return { success: true, message: 'Context deleted' };

    } catch (error) {
      this.logger.error('Failed to delete context', {
        issue_key: issueKey,
        error: error.message
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * Get statistics about stored contexts
   */
  getStats() {
    const now = Date.now();
    const contexts = Array.from(this.issueContextMap.values());

    const stats = {
      total_contexts: contexts.length,
      total_messages: this.messageToIssuesMap.size,
      sources: {},
      age_distribution: {
        last_hour: 0,
        last_day: 0,
        last_week: 0,
        older: 0
      }
    };

    // Calculate source distribution and age
    contexts.forEach(context => {
      // Source count
      stats.sources[context.source] = (stats.sources[context.source] || 0) + 1;

      // Age distribution
      const age = now - new Date(context.linked_at).getTime();
      const ageHours = age / (60 * 60 * 1000);
      if (ageHours < 1) {
        stats.age_distribution.last_hour++;
      } else if (ageHours < 24) {
        stats.age_distribution.last_day++;
      } else if (ageHours < 168) { // 7 days
        stats.age_distribution.last_week++;
      } else {
        stats.age_distribution.older++;
      }
    });

    return stats;
  }

  /**
   * Get all stored contexts (for testing/debugging)
   */
  getAllContexts() {
    const contexts = Array.from(this.issueContextMap.entries()).map(([issueKey, context]) => ({
      issueKey,
      ...context
    }));

    return contexts;
  }

  /**
   * Start periodic cleanup of old contexts
   */
  _startCleanup() {
    this.cleanupInterval = setInterval(() => {
      this._cleanupOldContexts();
    }, this.options.cleanupInterval);

    this.logger.info('Context cleanup started', {
      interval_hours: this.options.cleanupInterval / (60 * 60 * 1000),
      max_age_days: this.options.maxContextAge / (24 * 60 * 60 * 1000)
    });
  }

  /**
   * Clean up old contexts
   */
  _cleanupOldContexts() {
    try {
      const now = Date.now();
      let cleaned = 0;

      for (const [issueKey, context] of this.issueContextMap.entries()) {
        const contextAge = now - new Date(context.linked_at).getTime();

        if (contextAge > this.options.maxContextAge) {
          this.deleteContext(issueKey);
          cleaned++;
        }
      }

      if (cleaned > 0) {
        this.logger.info('Old contexts cleaned up', {
          cleaned_count: cleaned,
          remaining_count: this.issueContextMap.size
        });
      }

    } catch (error) {
      this.logger.error('Cleanup failed', { error: error.message });
    }
  }

  /**
   * Stop cleanup interval (for graceful shutdown)
   */
  stopCleanup() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.logger.info('Context cleanup stopped');
    }
  }

  /**
   * Export all contexts (for persistence or debugging)
   */
  exportContexts() {
    const contexts = [];
    for (const [issueKey, context] of this.issueContextMap.entries()) {
      contexts.push({ issue_key: issueKey, ...context });
    }
    return contexts;
  }

  /**
   * Import contexts (from persistence)
   */
  importContexts(contexts) {
    let imported = 0;
    for (const context of contexts) {
      if (context.issue_key) {
        this.issueContextMap.set(context.issue_key, context);

        // Rebuild reverse index
        if (context.message_id) {
          const existing = this.messageToIssuesMap.get(context.message_id) || [];
          existing.push(context.issue_key);
          this.messageToIssuesMap.set(context.message_id, existing);
        }

        imported++;
      }
    }

    this.logger.info('Contexts imported', { count: imported });
    return { success: true, imported_count: imported };
  }
}

module.exports = ContextLinker;
