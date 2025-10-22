/**
 * JIRA Semantic Translator
 *
 * Translates technical JIRA updates into audience-specific business language
 * Bridges the gap between dev-speak and business-speak
 *
 * Features:
 * - Multi-audience translation (sales, executive, support, technical)
 * - Demo readiness assessment
 * - Customer impact analysis
 * - Original context linking
 */

const AIAnalyzer = require('../signals/enrichment/ai-analyzer');
const winston = require('winston');

class JIRASemanticTranslator {
  constructor(options = {}) {
    this.options = {
      model: 'claude-3-5-sonnet-20241022',
      temperature: 0.3, // Lower for consistent translations
      confidenceThreshold: 0.75,
      maxTranslationLength: 500,
      ...options
    };

    this.logger = winston.createLogger({
      level: options.logLevel || 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      defaultMeta: { service: 'jira-semantic-translator' }
    });

    this.aiAnalyzer = new AIAnalyzer();

    // Translation cache to avoid re-translating same content
    this.translationCache = new Map();
  }

  /**
   * Translate a JIRA issue update for multiple audiences
   */
  async translateIssueUpdate(issue, options = {}) {
    try {
      const audiences = options.audiences || ['sales', 'technical'];
      const originalContext = options.originalContext || null;

      this.logger.info('Translating JIRA issue', {
        issue_key: issue.key,
        audiences,
        has_context: !!originalContext
      });

      // Check cache first
      const cacheKey = this._getCacheKey(issue, audiences);
      if (this.translationCache.has(cacheKey)) {
        this.logger.debug('Using cached translation', { issue_key: issue.key });
        return this.translationCache.get(cacheKey);
      }

      // Generate translations for each audience
      const translations = {};
      for (const audience of audiences) {
        translations[audience] = await this._translateForAudience(
          issue,
          audience,
          originalContext
        );
      }

      // Assess additional metadata
      const demoReadiness = await this._assessDemoReadiness(issue);
      const customerImpact = await this._analyzeCustomerImpact(issue);

      const result = {
        issue_key: issue.key,
        issue_url: this._buildIssueUrl(issue),
        technical_summary: issue.summary || issue.fields?.summary,
        technical_status: issue.status || issue.fields?.status?.name,
        translations,
        demo_ready: demoReadiness,
        customer_impact: customerImpact,
        original_context: originalContext ? {
          source: originalContext.source,
          requestor: originalContext.requestor,
          timestamp: originalContext.timestamp
        } : null,
        translated_at: new Date().toISOString(),
        confidence: this._calculateConfidence(translations)
      };

      // Cache the result
      this.translationCache.set(cacheKey, result);

      this.logger.info('Translation completed', {
        issue_key: issue.key,
        audiences_translated: Object.keys(translations).length,
        confidence: result.confidence
      });

      return result;

    } catch (error) {
      this.logger.error('Translation failed', {
        issue_key: issue.key,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Translate for a specific audience
   */
  async _translateForAudience(issue, audience, originalContext) {
    const summary = issue.summary || issue.fields?.summary || 'No summary';
    const status = issue.status || issue.fields?.status?.name || 'Unknown';
    const description = issue.description || issue.fields?.description || '';
    const issueType = issue.type || issue.fields?.issuetype?.name || 'Task';

    // Build audience-specific prompt
    const prompts = {
      sales: `You are translating a technical JIRA update for a sales team. They need to know what they can demo and sell.

JIRA Issue: ${issue.key}
Type: ${issueType}
Technical Summary: ${summary}
Status: ${status}
${originalContext ? `Original Request: "${originalContext.original_message}" from ${originalContext.requestor}` : ''}

Provide a sales-friendly translation in this EXACT JSON format:
{
  "summary": "One sentence: What can we demo/sell now?",
  "demo_points": ["Bullet 1: Specific demo capability", "Bullet 2: Another capability"],
  "customer_benefit": "One sentence: Why customers care",
  "deals_unlocked": "Which types of deals this enables (enterprise/SMB/etc)",
  "timeline": "When fully ready (e.g., 'Ready today', '2 days', '1 week')"
}

Be specific, actionable, and focused on what sales can USE today.`,

      executive: `You are translating a technical JIRA update for executive leadership. They need business impact and risk assessment.

JIRA Issue: ${issue.key}
Type: ${issueType}
Technical Summary: ${summary}
Status: ${status}

Provide an executive summary in this EXACT JSON format:
{
  "summary": "One sentence: Business impact",
  "customer_value": "One sentence: How this helps customers",
  "revenue_impact": "High/Medium/Low - Explain in 5 words",
  "risk_level": "High/Medium/Low",
  "timeline": "Completion estimate (e.g., 'Complete', '3 days', '1 week')"
}

Focus on business outcomes, not technical details.`,

      support: `You are translating a technical JIRA update for customer support team. They need to know how to communicate with customers.

JIRA Issue: ${issue.key}
Type: ${issueType}
Technical Summary: ${summary}
Status: ${status}

Provide a support-friendly translation in this EXACT JSON format:
{
  "summary": "One sentence: What changed for customers",
  "customer_explanation": "How to explain this to a customer (2-3 sentences, non-technical)",
  "benefits": ["Benefit 1", "Benefit 2"],
  "caveats": "Any limitations or known issues (or 'None')",
  "talking_points": ["Point 1 for customer calls", "Point 2"]
}

Use simple, customer-friendly language.`,

      technical: `You are summarizing a technical JIRA update for other developers.

JIRA Issue: ${issue.key}
Type: ${issueType}
Summary: ${summary}
Status: ${status}
Description: ${description.substring(0, 500)}

Provide a technical summary in this EXACT JSON format:
{
  "summary": "One sentence technical summary",
  "implementation": "Key technical details (2-3 sentences)",
  "dependencies": "Related systems or tickets affected",
  "next_steps": "What's next technically"
}

Keep it technical and precise.`
    };

    const prompt = prompts[audience] || prompts.sales;

    try {
      const response = await this.aiAnalyzer.anthropic.messages.create({
        model: this.options.model,
        max_tokens: this.options.maxTranslationLength,
        temperature: this.options.temperature,
        messages: [{
          role: 'user',
          content: prompt
        }]
      });

      const translationText = response.content[0].text;

      // Parse JSON response
      const translation = this._parseTranslation(translationText);

      return {
        ...translation,
        audience,
        generated_at: new Date().toISOString()
      };

    } catch (error) {
      this.logger.error('Audience translation failed', {
        issue_key: issue.key,
        audience,
        error: error.message
      });

      // Fallback to simple translation
      return this._fallbackTranslation(issue, audience);
    }
  }

  /**
   * Assess if feature is demo-ready
   */
  async _assessDemoReadiness(issue) {
    const status = issue.status || issue.fields?.status?.name || '';
    const summary = issue.summary || issue.fields?.summary || '';

    // Quick heuristics
    const doneStatuses = ['done', 'closed', 'resolved', 'complete'];
    const isDone = doneStatuses.some(s => status.toLowerCase().includes(s));

    if (!isDone) {
      return {
        ready: false,
        reason: 'Not yet complete',
        estimated_ready_date: null
      };
    }

    // Check if it's a customer-facing feature
    const customerFacingKeywords = ['feature', 'enhancement', 'ui', 'ux', 'user', 'customer'];
    const isCustomerFacing = customerFacingKeywords.some(k =>
      summary.toLowerCase().includes(k)
    );

    return {
      ready: isDone && isCustomerFacing,
      reason: isDone ? 'Feature complete and testable' : 'In progress',
      demo_confidence: isDone && isCustomerFacing ? 'high' : 'medium',
      recommended_demo_environment: 'staging'
    };
  }

  /**
   * Analyze customer impact
   */
  async _analyzeCustomerImpact(issue) {
    const summary = issue.summary || issue.fields?.summary || '';
    const priority = issue.priority || issue.fields?.priority?.name || 'Medium';

    // Impact heuristics based on type and priority
    const impactMap = {
      'Highest': 'critical',
      'High': 'high',
      'Medium': 'medium',
      'Low': 'low',
      'Lowest': 'minimal'
    };

    const impactLevel = impactMap[priority] || 'medium';

    // Identify customer benefit keywords
    const benefitKeywords = {
      performance: ['faster', 'speed', 'optimize', 'performance'],
      reliability: ['fix', 'bug', 'stable', 'reliable', 'crash'],
      security: ['security', 'auth', 'encryption', 'safe'],
      usability: ['easier', 'simple', 'intuitive', 'ux', 'ui'],
      feature: ['new', 'feature', 'capability', 'enable']
    };

    const categories = [];
    for (const [category, keywords] of Object.entries(benefitKeywords)) {
      if (keywords.some(k => summary.toLowerCase().includes(k))) {
        categories.push(category);
      }
    }

    return {
      level: impactLevel,
      categories: categories.length > 0 ? categories : ['general'],
      affects_existing_customers: priority !== 'Lowest',
      customer_facing: categories.some(c => ['usability', 'feature'].includes(c))
    };
  }

  /**
   * Parse AI translation response
   */
  _parseTranslation(text) {
    try {
      // Try to extract JSON
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }

      // Fallback: return as raw text
      return { summary: text.trim() };
    } catch (error) {
      this.logger.warn('Failed to parse translation JSON', { error: error.message });
      return { summary: text.trim() };
    }
  }

  /**
   * Fallback translation when AI fails
   */
  _fallbackTranslation(issue, audience) {
    const summary = issue.summary || issue.fields?.summary || 'No summary';
    const status = issue.status || issue.fields?.status?.name || 'Unknown';

    return {
      summary: `${issue.key}: ${summary} (Status: ${status})`,
      audience,
      fallback: true,
      note: 'AI translation unavailable - showing raw data'
    };
  }

  /**
   * Calculate overall translation confidence
   */
  _calculateConfidence(translations) {
    // Simple heuristic: if all translations succeeded, high confidence
    const allSucceeded = Object.values(translations).every(t => !t.fallback);
    return allSucceeded ? 0.9 : 0.6;
  }

  /**
   * Build JIRA issue URL
   */
  _buildIssueUrl(issue) {
    // Assume JIRA Cloud format
    const baseUrl = process.env.JIRA_BASE_URL || 'https://your-domain.atlassian.net';
    return `${baseUrl}/browse/${issue.key}`;
  }

  /**
   * Generate cache key
   */
  _getCacheKey(issue, audiences) {
    const key = issue.key || issue.id;
    const updated = issue.updated || issue.fields?.updated || Date.now();
    return `${key}-${audiences.join(',')}-${updated}`;
  }

  /**
   * Clear translation cache (call periodically or on demand)
   */
  clearCache() {
    const size = this.translationCache.size;
    this.translationCache.clear();
    this.logger.info('Translation cache cleared', { entries_cleared: size });
  }

  /**
   * Determine if an issue is customer-facing (should be translated)
   */
  isCustomerFacing(issue) {
    const customerLabels = ['customer-facing', 'feature', 'enhancement', 'user-story'];
    const labels = issue.labels || issue.fields?.labels || [];
    const hasLabel = labels.some(l => customerLabels.includes(l.toLowerCase()));

    const customerTypes = ['Story', 'Feature', 'Epic', 'Enhancement'];
    const issueType = issue.type || issue.fields?.issuetype?.name;
    const isType = customerTypes.includes(issueType);

    const priority = issue.priority || issue.fields?.priority?.name;
    const isHighPriority = ['Highest', 'High'].includes(priority);

    // Customer-facing if: has label OR is feature type OR is high priority
    return hasLabel || isType || isHighPriority;
  }
}

module.exports = JIRASemanticTranslator;
