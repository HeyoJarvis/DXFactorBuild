/**
 * Engineering Intelligence - List Accessible GitHub Repositories
 *
 * Allows the UI to fetch a list of repositories available to the configured
 * GitHub token so users can select which repo to query at runtime.
 */

const { authenticate, rateLimit } = require('../middleware/auth');
// Octokit is ESM only; use dynamic import
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

// Create octokit client with GitHub App or Token
async function getOctokit() {
  const fs = require('fs');

  // Try GitHub App first (preferred)
  if (process.env.GITHUB_APP_ID &&
      process.env.GITHUB_APP_INSTALLATION_ID &&
      (process.env.GITHUB_APP_PRIVATE_KEY_PATH || process.env.GITHUB_APP_PRIVATE_KEY)) {

    try {
      const { createAppAuth } = await import('@octokit/auth-app');
      const privateKey = process.env.GITHUB_APP_PRIVATE_KEY ||
                        fs.readFileSync(process.env.GITHUB_APP_PRIVATE_KEY_PATH, 'utf8');

      const mod = await import('@octokit/rest');
      return new mod.Octokit({
        authStrategy: createAppAuth,
        auth: {
          appId: process.env.GITHUB_APP_ID,
          privateKey: privateKey,
          installationId: process.env.GITHUB_APP_INSTALLATION_ID,
        }
      });
    } catch (error) {
      logger.error('GitHub App auth failed, trying token fallback', { error: error.message });
    }
  }

  // Fallback to personal token
  if (process.env.GITHUB_TOKEN) {
    const mod = await import('@octokit/rest');
    return new mod.Octokit({ auth: process.env.GITHUB_TOKEN });
  }

  throw new Error('GitHub not configured - need either GitHub App credentials or GITHUB_TOKEN');
}

// Normalize repository fields for UI
function mapRepo(repo) {
  return {
    owner: repo.owner?.login,
    name: repo.name,
    full_name: repo.full_name,
    private: repo.private,
    default_branch: repo.default_branch,
    html_url: repo.html_url,
    description: repo.description,
    visibility: repo.visibility,
    permissions: repo.permissions,
    updated_at: repo.updated_at,
    pushed_at: repo.pushed_at,
    language: repo.language
  };
}

module.exports = async (req, res) => {
  try {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') return res.status(200).end();

    // Only allow GET
    if (req.method !== 'GET') {
      return res.status(405).json({ error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' });
    }

    // Auth - Skip for local desktop app (localhost requests)
    const isLocalhost = req.headers.origin?.includes('localhost') ||
                       req.headers.host?.includes('localhost') ||
                       req.headers.referer?.includes('localhost') ||
                       !req.headers.authorization; // Desktop app doesn't send auth headers

    if (!isLocalhost) {
      await new Promise((resolve, reject) => {
        authenticate(req, res, (err) => (err ? reject(err) : resolve()));
      });
    } else {
      // For local desktop app, create a mock user
      req.userId = 'desktop-user';
      req.user = { id: 'desktop-user', email: 'desktop@local', fallback: true };
    }

    // Rate limit (30 per 15m)
    await new Promise((resolve, reject) => {
      const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 30, message: 'Too many repo list requests' });
      limiter(req, res, (err) => (err ? reject(err) : resolve()));
    });

    const octokit = await getOctokit();

    // Query params
    const org = (req.query.org || '').trim();
    const affiliation = (req.query.affiliation || 'owner,collaborator,organization_member').trim();
    const per_page = Math.min(parseInt(req.query.per_page || '50', 10), 100);
    const page = Math.max(parseInt(req.query.page || '1', 10), 1);
    const q = (req.query.q || '').trim().toLowerCase();

    logger.info('Listing GitHub repositories', { userId: req.userId, org, affiliation, per_page, page });

    let repos = [];

    // Check if we're using GitHub App authentication
    const isGithubApp = !!(process.env.GITHUB_APP_ID && process.env.GITHUB_APP_INSTALLATION_ID);

    if (org) {
      // List repos for a specific organization
      const { data } = await octokit.repos.listForOrg({ org, per_page, page, type: 'all' });
      repos = data;
    } else if (isGithubApp) {
      // For GitHub Apps, use installation repos endpoint
      logger.info('Using GitHub App installation repos endpoint');
      const { data } = await octokit.apps.listReposAccessibleToInstallation({ per_page, page });
      repos = data.repositories || data; // Handle response format
    } else {
      // For personal tokens, use authenticated user endpoint
      const { data } = await octokit.repos.listForAuthenticatedUser({ affiliation, per_page, page });
      repos = data;
    }

    // Optional client-side search filter
    if (q) {
      repos = repos.filter((r) =>
        (r.full_name && r.full_name.toLowerCase().includes(q)) ||
        (r.name && r.name.toLowerCase().includes(q)) ||
        (r.owner?.login && r.owner.login.toLowerCase().includes(q))
      );
    }

    const normalized = repos.map(mapRepo);

    res.json({
      success: true,
      count: normalized.length,
      page,
      per_page,
      repositories: normalized
    });
  } catch (error) {
    logger.error('Failed to list GitHub repositories', { error: error.message, stack: error.stack });

    if (String(error.message).includes('not configured')) {
      return res.status(503).json({ error: 'Engineering Intelligence is not configured', code: 'SERVICE_NOT_CONFIGURED' });
    }

    res.status(500).json({ error: 'Failed to list repositories', code: 'REPO_LIST_ERROR', message: error.message });
  }
};


