/**
 * Email Query Engine
 *
 * Handles natural language queries about emails using semantic search and Claude AI.
 * Synthesizes information from multiple emails to answer user questions.
 *
 * Features:
 * 1. Natural language email search
 * 2. Semantic similarity matching
 * 3. Multi-email synthesis with Claude
 * 4. Email citations and references
 * 5. Context-aware summaries
 */

const winston = require('winston');
const EmbeddingService = require('./embedding-service');
const EmailVectorStore = require('../../data/storage/email-vector-store');

class EmailQueryEngine {
  constructor(options = {}) {
    this.options = {
      anthropicApiKey: options.anthropicApiKey || process.env.ANTHROPIC_API_KEY,
      model: options.model || 'claude-3-haiku-20240307',
      maxTokens: options.maxTokens || 4096,
      temperature: options.temperature || 0.3,
      searchThreshold: options.searchThreshold || 0.3,
      searchLimit: options.searchLimit || 15,
      logLevel: options.logLevel || 'info',
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
        new winston.transports.File({ filename: 'logs/email-query-engine.log' })
      ],
      defaultMeta: { service: 'email-query-engine' }
    });

    this.embeddingService = new EmbeddingService({
      logLevel: this.options.logLevel
    });

    this.vectorStore = new EmailVectorStore({
      logLevel: this.options.logLevel
    });

    if (!this.options.anthropicApiKey) {
      throw new Error('Anthropic API key is required for email query engine');
    }

    this.logger.info('Email Query Engine initialized', {
      model: this.options.model
    });
  }

  /**
   * Call Claude API for answer generation
   * @private
   */
  async _callClaude(prompt, systemPrompt) {
    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': this.options.anthropicApiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          model: this.options.model,
          max_tokens: this.options.maxTokens,
          temperature: this.options.temperature,
          system: systemPrompt,
          messages: [
            {
              role: 'user',
              content: prompt
            }
          ]
        })
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Claude API error: ${error}`);
      }

      const data = await response.json();
      return data.content[0].text;

    } catch (error) {
      this.logger.error('Claude API call failed', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Query emails with natural language
   * @param {string} query - User's natural language query
   * @param {string} userId - User ID
   * @param {Object} filters - Optional filters (provider, category, dateFrom, dateTo)
   * @returns {Promise<Object>} Query result with answer and email citations
   */
  async query(query, userId, filters = {}) {
    const startTime = Date.now();

    try {
      this.logger.info('Email query started', {
        userId,
        query,
        filters
      });

      // Step 1: Generate query embedding
      const queryEmbedding = await this.embeddingService.embed(query);

      this.logger.debug('Query embedding generated');

      // Step 2: Search for relevant emails
      const relevantEmails = await this.vectorStore.searchEmails(
        queryEmbedding,
        userId,
        {
          ...filters,
          threshold: this.options.searchThreshold,
          limit: this.options.searchLimit
        }
      );

      if (relevantEmails.length === 0) {
        return {
          success: true,
          answer: "I couldn't find any emails relevant to your question. Try rephrasing your query or adjusting the date filters.",
          emails: [],
          confidence: 'none',
          processingTime: Date.now() - startTime
        };
      }

      this.logger.info('Relevant emails found', {
        count: relevantEmails.length,
        avgSimilarity: this.calculateAverageSimilarity(relevantEmails)
      });

      // Step 3: Format email context for Claude
      const emailContext = this.formatEmailContext(relevantEmails);

      // Step 4: Generate answer with Claude
      const systemPrompt = this.buildSystemPrompt();
      const userPrompt = this.buildUserPrompt(query, emailContext);

      const answer = await this._callClaude(userPrompt, systemPrompt);

      // Step 5: Calculate confidence
      const confidence = this.calculateConfidence(relevantEmails);

      // Step 6: Format email citations
      const citations = relevantEmails.map(email => ({
        messageId: email.message_id,
        from: email.from_name || email.from_address,
        subject: email.subject,
        preview: email.body_preview,
        date: email.sent_at,
        provider: email.provider,
        similarity: email.similarity,
        category: email.category,
        tags: email.tags
      }));

      const result = {
        success: true,
        answer: answer.trim(),
        emails: citations,
        confidence: confidence,
        totalEmails: relevantEmails.length,
        query: query,
        processingTime: Date.now() - startTime,
        metadata: {
          avgSimilarity: this.calculateAverageSimilarity(relevantEmails),
          searchThreshold: this.options.searchThreshold,
          filters: filters
        }
      };

      this.logger.info('Query completed successfully', {
        userId,
        emailCount: citations.length,
        confidence,
        duration: result.processingTime
      });

      return result;

    } catch (error) {
      this.logger.error('Query failed', {
        userId,
        query,
        error: error.message
      });

      return {
        success: false,
        error: error.message,
        processingTime: Date.now() - startTime
      };
    }
  }

  /**
   * Build system prompt for Claude
   * @private
   */
  buildSystemPrompt() {
    return `You are an intelligent email analysis assistant. Your role is to help users understand and synthesize information from their emails.

Your capabilities:
- Analyze email content and extract key information
- Synthesize information across multiple emails
- Identify patterns, trends, and important details
- Provide clear, concise summaries
- Answer specific questions about email content

Guidelines:
- Be direct and factual
- Always cite which email(s) your information comes from
- If information is unclear or missing, say so
- Focus on answering the user's specific question
- Use bullet points for clarity when appropriate
- Maintain professional tone

When synthesizing information:
- Combine relevant details from multiple emails
- Note any contradictions or changes over time
- Highlight the most important or recent information
- Provide context when useful`;
  }

  /**
   * Build user prompt with email context
   * @private
   */
  buildUserPrompt(query, emailContext) {
    return `User Query: ${query}

Here are the most relevant emails from the user's inbox:

${emailContext}

Based on these emails, please answer the user's query. Be specific and cite which email(s) contain the information. If multiple emails discuss the same topic, synthesize the information.`;
  }

  /**
   * Format emails into context for Claude
   * @private
   */
  formatEmailContext(emails) {
    return emails.map((email, index) => {
      const date = new Date(email.sent_at).toLocaleDateString();
      const from = email.from_name || email.from_address;

      return `
Email #${index + 1}:
From: ${from}
Subject: ${email.subject}
Date: ${date}
${email.category ? `Category: ${email.category}` : ''}
${email.tags && email.tags.length > 0 ? `Tags: ${email.tags.join(', ')}` : ''}

Content:
${email.body_preview || 'No preview available'}

Relevance Score: ${(email.similarity * 100).toFixed(1)}%
---`;
    }).join('\n\n');
  }

  /**
   * Calculate average similarity across results
   * @private
   */
  calculateAverageSimilarity(emails) {
    if (emails.length === 0) return 0;
    const sum = emails.reduce((acc, email) => acc + email.similarity, 0);
    return sum / emails.length;
  }

  /**
   * Calculate confidence based on similarity scores
   * @private
   */
  calculateConfidence(emails) {
    if (emails.length === 0) return 'none';

    const avgSimilarity = this.calculateAverageSimilarity(emails);
    const topSimilarity = emails[0]?.similarity || 0;

    if (topSimilarity >= 0.7 && avgSimilarity >= 0.5) {
      return 'high';
    } else if (topSimilarity >= 0.5 && avgSimilarity >= 0.35) {
      return 'medium';
    } else {
      return 'low';
    }
  }

  /**
   * Find emails by date range
   * @param {string} userId - User ID
   * @param {Date} dateFrom - Start date
   * @param {Date} dateTo - End date
   * @param {Object} filters - Additional filters
   * @returns {Promise<Array>} Emails in date range
   */
  async findEmailsByDateRange(userId, dateFrom, dateTo, filters = {}) {
    // For date range queries, we use a generic embedding to find all emails
    const genericQuery = "email communication correspondence message";
    const queryEmbedding = await this.embeddingService.embed(genericQuery);

    return await this.vectorStore.searchEmails(
      queryEmbedding,
      userId,
      {
        ...filters,
        dateFrom: dateFrom.toISOString(),
        dateTo: dateTo.toISOString(),
        threshold: 0.1, // Very low threshold to get all emails in range
        limit: 100
      }
    );
  }

  /**
   * Get email statistics and insights
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Statistics
   */
  async getStats(userId) {
    return await this.vectorStore.getUserEmailStats(userId);
  }
}

module.exports = EmailQueryEngine;
