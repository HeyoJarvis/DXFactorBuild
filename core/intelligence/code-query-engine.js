/**
 * Code Query Engine
 * 
 * Handles natural language queries about code using semantic search and Claude AI.
 * Translates technical code into business-friendly answers for sales users.
 * 
 * Features:
 * 1. Natural language query processing
 * 2. Semantic search in vector store
 * 3. Context-aware answer generation with Claude
 * 4. Code reference citations
 * 5. Business-friendly explanations
 */

const winston = require('winston');
const EmbeddingService = require('./embedding-service');
const CodeVectorStore = require('../../data/storage/code-vector-store');

class CodeQueryEngine {
  constructor(options = {}) {
    this.options = {
      anthropicApiKey: options.anthropicApiKey || process.env.ANTHROPIC_API_KEY,
      model: options.model || 'claude-3-5-sonnet-20241022',
      maxTokens: options.maxTokens || 4096,
      temperature: options.temperature || 0.3,
      searchThreshold: options.searchThreshold || 0.5,
      searchLimit: options.searchLimit || 10,
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
        new winston.transports.File({ filename: 'logs/query-engine.log' })
      ],
      defaultMeta: { service: 'query-engine' }
    });

    this.embeddingService = new EmbeddingService({
      logLevel: this.options.logLevel
    });

    this.vectorStore = new CodeVectorStore({
      logLevel: this.options.logLevel
    });

    if (!this.options.anthropicApiKey) {
      throw new Error('Anthropic API key is required for query engine');
    }

    this.logger.info('Code Query Engine initialized', {
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
        throw new Error(`Claude API error (${response.status}): ${error}`);
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
   * Format code chunks for Claude context
   * @private
   */
  _formatCodeContext(chunks) {
    return chunks.map((chunk, index) => {
      return `
[Code Reference ${index + 1}]
File: ${chunk.file_path}
Type: ${chunk.chunk_type}${chunk.chunk_name ? ` (${chunk.chunk_name})` : ''}
Language: ${chunk.file_language}
Similarity: ${(chunk.similarity * 100).toFixed(1)}%

\`\`\`${chunk.file_language}
${chunk.chunk_content}
\`\`\`
`;
    }).join('\n---\n');
  }

  /**
   * Query code repository with natural language
   * @param {string} question - Natural language question
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Answer with code references
   */
  async query(question, options = {}) {
    const {
      owner,
      repo,
      language = null,
      searchThreshold = this.options.searchThreshold,
      searchLimit = this.options.searchLimit
    } = options;

    this.logger.info('Processing query', {
      question,
      owner,
      repo,
      language
    });

    const startTime = Date.now();

    try {
      // Step 1: Generate query embedding
      this.logger.debug('Generating query embedding');
      const queryEmbedding = await this.embeddingService.generateEmbedding(question);

      // Step 2: Search for relevant code chunks
      this.logger.debug('Searching code chunks');
      const chunks = await this.vectorStore.searchChunks(queryEmbedding, {
        owner,
        repo,
        language,
        threshold: searchThreshold,
        limit: searchLimit
      });

      if (chunks.length === 0) {
        this.logger.warn('No relevant code chunks found', {
          question,
          owner,
          repo
        });
        
        return {
          answer: "I couldn't find any relevant code in the repository that matches your question. This could mean:\n\n1. The feature you're asking about doesn't exist yet\n2. The repository hasn't been indexed yet\n3. The question might need to be rephrased\n\nTry asking a more specific question or check if the repository has been indexed.",
          confidence: 'low',
          sources: [],
          processingTime: Date.now() - startTime
        };
      }

      // Step 3: Format context for Claude
      const codeContext = this._formatCodeContext(chunks);

      // Step 4: Generate answer with Claude
      this.logger.debug('Generating answer with Claude', {
        chunksFound: chunks.length
      });

      const systemPrompt = `You are an AI assistant helping sales executives understand technical codebases. Your role is to:

1. Translate technical code into business-friendly language
2. Explain features and capabilities in terms of customer value
3. Provide clear, concise answers focused on what the code enables
4. Cite specific code references when relevant
5. Be honest about limitations or uncertainties

Always answer from a business/sales perspective, not a technical implementation perspective.`;

      const userPrompt = `Based on the following code from the repository${repo ? ` "${owner}/${repo}"` : ''}, answer this question:

**Question:** ${question}

**Relevant Code:**
${codeContext}

**Instructions:**
- Answer in plain English suitable for sales conversations
- Focus on WHAT the code does, not HOW it works
- Highlight customer benefits and use cases
- If you see authentication, integrations, features, etc., explain their business value
- Cite file paths when referencing specific capabilities
- If the code doesn't fully answer the question, say so clearly

**Answer:**`;

      const answer = await this._callClaude(userPrompt, systemPrompt);

      // Step 5: Format response with sources
      const sources = chunks.map(chunk => ({
        filePath: chunk.file_path,
        chunkType: chunk.chunk_type,
        chunkName: chunk.chunk_name,
        language: chunk.file_language,
        startLine: chunk.start_line,
        similarity: chunk.similarity
      }));

      const processingTime = Date.now() - startTime;

      this.logger.info('Query completed', {
        question,
        owner,
        repo,
        chunksFound: chunks.length,
        processingTimeMs: processingTime
      });

      return {
        answer,
        confidence: chunks.length >= 5 ? 'high' : chunks.length >= 2 ? 'medium' : 'low',
        sources,
        processingTime,
        metadata: {
          searchResults: chunks.length,
          averageSimilarity: chunks.reduce((sum, c) => sum + c.similarity, 0) / chunks.length
        }
      };

    } catch (error) {
      this.logger.error('Query failed', {
        question,
        owner,
        repo,
        error: error.message,
        stack: error.stack
      });

      throw new Error(`Query failed: ${error.message}`);
    }
  }

  /**
   * Query with suggested follow-up questions
   * @param {string} question - Natural language question
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Answer with follow-ups
   */
  async queryWithFollowUps(question, options = {}) {
    const result = await this.query(question, options);

    // Generate follow-up questions based on sources
    const followUps = [];
    
    const hasAuth = result.sources.some(s => 
      s.filePath.includes('auth') || s.chunkName?.includes('auth')
    );
    if (hasAuth && !question.toLowerCase().includes('auth')) {
      followUps.push('What authentication methods are supported?');
    }

    const hasAPI = result.sources.some(s =>
      s.filePath.includes('api') || s.chunkName?.includes('api')
    );
    if (hasAPI && !question.toLowerCase().includes('api')) {
      followUps.push('What API endpoints are available?');
    }

    const hasIntegration = result.sources.some(s =>
      s.filePath.includes('integrat') || s.chunkName?.includes('integrat')
    );
    if (hasIntegration && !question.toLowerCase().includes('integrat')) {
      followUps.push('What third-party integrations are supported?');
    }

    return {
      ...result,
      followUpQuestions: followUps.slice(0, 3)
    };
  }

  /**
   * Batch query multiple questions
   * @param {Array<string>} questions - Array of questions
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Array of answers
   */
  async batchQuery(questions, options = {}) {
    this.logger.info('Processing batch query', {
      questionCount: questions.length
    });

    const results = [];

    for (const question of questions) {
      try {
        const result = await this.query(question, options);
        results.push({ question, ...result });
      } catch (error) {
        this.logger.error('Batch query item failed', {
          question,
          error: error.message
        });
        results.push({
          question,
          answer: `Error processing question: ${error.message}`,
          confidence: 'error',
          sources: []
        });
      }
    }

    return results;
  }

  /**
   * Get service statistics
   * @returns {Object} Statistics
   */
  getStats() {
    return this.embeddingService.getStats();
  }
}

module.exports = CodeQueryEngine;

