/**
 * Semantic Parser Service
 * Bridge between Electron and Python semantic parser
 */

const { spawn } = require('child_process');
const path = require('path');

class SemanticParserService {
  constructor(logger) {
    this.logger = logger;
    this.pythonScript = path.join(__dirname, 'semantic-parser', 'code_intent_service.py');
    this.useMock = process.env.NODE_ENV === 'development' || !process.env.ANTHROPIC_API_KEY;
  }

  /**
   * Parse code intent from user query
   * @param {Object} params - Query parameters
   * @param {string} params.query - User's natural language query
   * @param {string} params.repository - Repository name (owner/repo)
   * @param {string} [params.ticketKey] - JIRA ticket key
   * @param {string} [params.ticketSummary] - JIRA ticket summary
   * @param {string} [params.ticketDescription] - JIRA ticket description
   * @param {string} [params.branch='main'] - Git branch
   * @param {string} [params.language] - Programming language
   * @param {string[]} [params.recentFiles] - Recently viewed files
   * @returns {Promise<Object>} - Parsed intent with operations
   */
  async parseIntent(params) {
    try {
      const {
        query,
        repository,
        ticketKey,
        ticketSummary,
        ticketDescription,
        branch = 'main',
        language,
        recentFiles
      } = params;

      if (!query || !repository) {
        throw new Error('Query and repository are required');
      }

      this.logger.info('🧠 Parsing code intent', {
        query: query.substring(0, 100),
        repository,
        ticketKey,
        useMock: this.useMock
      });

      // Prepare input for Python script
      const input = {
        query,
        repository,
        ticket_key: ticketKey,
        ticket_summary: ticketSummary,
        ticket_description: ticketDescription,
        branch,
        language,
        recent_files: recentFiles
      };

      // Call Python script
      const result = await this._callPythonScript(input);

      if (!result.success) {
        throw new Error(result.error || 'Failed to parse intent');
      }

      this.logger.info('✅ Intent parsed successfully', {
        capabilities: result.understanding.code_capabilities,
        confidence: result.understanding.confidence_score,
        operations: result.understanding.operations.length
      });

      return {
        success: true,
        understanding: result.understanding,
        searchTerms: result.search_terms,
        engine: result.engine
      };

    } catch (error) {
      this.logger.error('❌ Failed to parse intent', {
        error: error.message,
        stack: error.stack
      });

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Call Python script via spawn
   * @private
   */
  _callPythonScript(input) {
    return new Promise((resolve, reject) => {
      const args = [this.pythonScript];
      if (this.useMock) {
        args.push('--mock');
      }

      const python = spawn('python3', args);

      let stdout = '';
      let stderr = '';

      // Collect stdout
      python.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      // Collect stderr (for warnings/errors)
      python.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      // Handle completion
      python.on('close', (code) => {
        if (stderr) {
          this.logger.warn('Python stderr:', stderr);
        }

        if (code !== 0) {
          reject(new Error(`Python script exited with code ${code}: ${stderr}`));
          return;
        }

        try {
          const result = JSON.parse(stdout);
          resolve(result);
        } catch (error) {
          reject(new Error(`Failed to parse Python output: ${error.message}\nOutput: ${stdout}`));
        }
      });

      // Handle errors
      python.on('error', (error) => {
        reject(new Error(`Failed to spawn Python: ${error.message}`));
      });

      // Send input to stdin
      python.stdin.write(JSON.stringify(input));
      python.stdin.end();
    });
  }

  /**
   * Check if semantic parser is available
   */
  async checkAvailability() {
    try {
      // Try a simple parse to check if Python and dependencies are available
      const result = await this.parseIntent({
        query: 'test',
        repository: 'test/test'
      });

      return {
        available: result.success,
        engine: this.useMock ? 'mock' : 'anthropic',
        message: result.success ? 'Semantic parser ready' : 'Semantic parser unavailable'
      };
    } catch (error) {
      return {
        available: false,
        engine: null,
        message: `Semantic parser error: ${error.message}`
      };
    }
  }

  /**
   * Enrich code-indexer query with semantic understanding
   * This is the main integration point
   */
  async enrichQuery(query, repository, context = {}) {
    const understanding = await this.parseIntent({
      query,
      repository,
      ticketKey: context.ticket?.key,
      ticketSummary: context.ticket?.summary,
      ticketDescription: context.ticket?.description,
      language: context.language,
      recentFiles: context.recentFiles
    });

    if (!understanding.success) {
      // Return original query if parsing fails
      return {
        query,
        repository,
        context,
        semanticUnderstanding: null
      };
    }

    // Return enriched query with semantic understanding
    return {
      query,
      repository,
      context: {
        ...context,
        businessGoal: understanding.understanding.business_goal,
        capabilities: understanding.understanding.code_capabilities,
        filePatterns: understanding.understanding.code_context.file_patterns,
        searchTerms: understanding.searchTerms,
        operations: understanding.understanding.operations,
        confidence: understanding.understanding.confidence_score,
        clarificationNeeded: understanding.understanding.clarification_needed
      },
      semanticUnderstanding: understanding.understanding
    };
  }
}

module.exports = SemanticParserService;
