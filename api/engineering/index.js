/**
 * Engineering Intelligence - Index Repository
 * 
 * Indexes a GitHub repository to enable code queries.
 * Creates embeddings and stores them in Supabase vector store.
 */

const { authenticate, rateLimit } = require('../middleware/auth');
const CodeIndexer = require('../../core/intelligence/code-indexer');
const winston = require('winston');

// Logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/engineering-api.log', maxsize: 5242880, maxFiles: 5 })
  ],
  defaultMeta: { service: 'engineering-api' }
});

// Singleton Code Indexer
let codeIndexer = null;
function getCodeIndexer() {
  if (!codeIndexer) {
    codeIndexer = new CodeIndexer({ logLevel: 'info' });
  }
  return codeIndexer;
}

module.exports = async (req, res) => {
  try {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') return res.status(200).end();

    // Only allow POST
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' });
    }

    // Auth - Skip for local desktop app
    const isLocalhost = req.headers.origin?.includes('localhost') ||
                       req.headers.host?.includes('localhost') ||
                       !req.headers.authorization;

    if (!isLocalhost) {
      await new Promise((resolve, reject) => {
        authenticate(req, res, (err) => (err ? reject(err) : resolve()));
      });
    } else {
      req.userId = 'desktop-user';
      req.user = { id: 'desktop-user', email: 'desktop@local', fallback: true };
    }

    // Extract params
    const { owner, repo, branch = 'main' } = req.body;

    if (!owner || !repo) {
      return res.status(400).json({
        error: 'Owner and repo are required',
        code: 'MISSING_PARAMS'
      });
    }

    logger.info('Starting repository indexing', { owner, repo, branch, userId: req.userId });

    // Get indexer
    const indexer = getCodeIndexer();

    // Check if already indexing
    if (indexer.isIndexing(owner, repo)) {
      return res.status(409).json({
        error: 'Repository is already being indexed',
        code: 'ALREADY_INDEXING',
        repository: `${owner}/${repo}`
      });
    }

    // Start indexing (async)
    indexer.indexRepository(owner, repo, branch)
      .then(result => {
        logger.info('Repository indexing completed', {
          owner,
          repo,
          branch,
          ...result
        });
      })
      .catch(error => {
        logger.error('Repository indexing failed', {
          owner,
          repo,
          branch,
          error: error.message
        });
      });

    // Return immediately with job started
    res.json({
      success: true,
      message: 'Repository indexing started',
      repository: `${owner}/${repo}`,
      branch,
      jobId: `${owner}/${repo}`
    });

  } catch (error) {
    logger.error('Failed to start repository indexing', {
      error: error.message,
      stack: error.stack
    });

    res.status(500).json({
      error: 'Failed to start indexing',
      code: 'INDEXING_ERROR',
      message: error.message
    });
  }
};
