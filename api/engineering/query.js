/**
 * Engineering Intelligence Query API
 * 
 * This endpoint provides centralized access to codebase intelligence
 * without requiring individual users to manage GitHub tokens.
 * 
 * Features:
 * - Authenticated access only
 * - Rate limiting to protect API quotas
 * - Audit logging for compliance
 * - Business-friendly response formatting
 */

const { authenticate, rateLimit } = require('../middleware/auth');
const EngineeringIntelligenceService = require('../../core/intelligence/engineering-intelligence-service');
const winston = require('winston');

// Initialize logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({
      filename: 'logs/engineering-api.log',
      maxsize: 5242880, // 5MB
      maxFiles: 5
    })
  ],
  defaultMeta: { service: 'engineering-api' }
});

// Initialize Engineering Intelligence Service (singleton)
let engineeringService = null;

function getEngineeringService() {
  if (!engineeringService) {
    // Use centralized GitHub token from environment
    engineeringService = new EngineeringIntelligenceService({
      githubToken: process.env.GITHUB_TOKEN,
      repository: {
        owner: process.env.GITHUB_REPO_OWNER,
        repo: process.env.GITHUB_REPO_NAME
      }
    });
  }
  return engineeringService;
}

/**
 * Audit log for engineering queries
 */
async function auditLog(userId, userEmail, query, success, error = null) {
  try {
    logger.info('Engineering query audit', {
      userId,
      userEmail,
      query: query.substring(0, 200), // Truncate for logging
      success,
      error: error ? error.message : null,
      timestamp: new Date().toISOString()
    });

    // TODO: Store in Supabase audit table for compliance
    // await supabase.from('engineering_query_audit').insert({
    //   user_id: userId,
    //   query,
    //   success,
    //   error: error ? error.message : null
    // });

  } catch (auditError) {
    logger.error('Audit logging failed', { error: auditError });
    // Don't fail the request if audit logging fails
  }
}

/**
 * Main API handler
 */
module.exports = async (req, res) => {
  try {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    // Handle preflight
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    // Only allow POST requests
    if (req.method !== 'POST') {
      return res.status(405).json({
        error: 'Method not allowed',
        code: 'METHOD_NOT_ALLOWED'
      });
    }

    // Apply authentication middleware
    await new Promise((resolve, reject) => {
      authenticate(req, res, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    // Apply rate limiting (10 queries per 15 minutes per user)
    await new Promise((resolve, reject) => {
      const rateLimiter = rateLimit({
        windowMs: 15 * 60 * 1000,
        max: 10,
        message: 'Too many engineering queries. Please try again later.'
      });
      rateLimiter(req, res, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    // Extract query and optional repository override from request body
    const { query, context, owner, repo, repository } = req.body;

    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return res.status(400).json({
        error: 'Query is required',
        code: 'INVALID_QUERY'
      });
    }

    logger.info('Processing engineering query', {
      userId: req.userId,
      userEmail: req.user?.email,
      queryLength: query.length
    });

    // Determine repository to use (allow runtime override)
    const overrideOwner = repository?.owner || owner;
    const overrideRepo = repository?.repo || repository?.name || repo;

    // Validate override if partially provided
    if ((overrideOwner && !overrideRepo) || (!overrideOwner && overrideRepo)) {
      return res.status(400).json({
        error: 'Both owner and repo must be provided when overriding repository',
        code: 'INVALID_REPOSITORY_OVERRIDE'
      });
    }

    // Get engineering service (singleton by default)
    let service = getEngineeringService();

    // If override is provided, create a scoped service instance for this request
    if (overrideOwner && overrideRepo) {
      service = new EngineeringIntelligenceService({
        githubToken: process.env.GITHUB_TOKEN,
        repository: { owner: overrideOwner, repo: overrideRepo }
      });
      logger.info('Using repository override for engineering query', {
        repository: `${overrideOwner}/${overrideRepo}`
      });
    }

    // Check if service is available (token configured)
    if (!process.env.GITHUB_TOKEN) {
      logger.error('Engineering Intelligence not configured');
      await auditLog(req.userId, req.user?.email, query, false, new Error('Service not configured'));
      
      return res.status(503).json({
        error: 'Engineering Intelligence is not configured. Please contact your administrator.',
        code: 'SERVICE_NOT_CONFIGURED'
      });
    }

    // Execute query
    const result = await service.queryCodebase(query, {
      userId: req.userId,
      userEmail: req.user?.email,
      userRole: req.user?.context?.role,
      ...context
    });

    // Audit log success
    await auditLog(req.userId, req.user?.email, query, true);

    // Return formatted response
    res.json({
      success: true,
      query,
      result: {
        summary: result.summary,
        businessImpact: result.businessImpact,
        actionItems: result.actionItems,
        technicalDetails: result.technicalDetails,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('Engineering query error', {
      error: error.message,
      stack: error.stack,
      userId: req.userId
    });

    // Audit log failure
    if (req.userId) {
      await auditLog(req.userId, req.user?.email, req.body?.query || '', false, error);
    }

    // Handle specific error types
    if (error.message.includes('rate limit')) {
      return res.status(429).json({
        error: 'GitHub API rate limit exceeded. Please try again later.',
        code: 'GITHUB_RATE_LIMIT'
      });
    }

    if (error.message.includes('not configured')) {
      return res.status(503).json({
        error: 'Engineering Intelligence is not configured.',
        code: 'SERVICE_NOT_CONFIGURED'
      });
    }

    // Generic error response
    res.status(500).json({
      error: 'Failed to process engineering query',
      code: 'QUERY_ERROR',
      message: error.message
    });
  }
};
