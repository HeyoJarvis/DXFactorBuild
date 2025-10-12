/**
 * JIRA Sync API
 * 
 * Express endpoints for JIRA integration
 * - Manual sync triggers
 * - Issue CRUD operations
 * - Sprint data access
 * 
 * Features:
 * 1. Rate limiting (100 req/15min per user)
 * 2. Authentication required
 * 3. Error handling and logging
 */

const express = require('express');
const winston = require('winston');
const JIRAService = require('../../core/integrations/jira-service');
const JIRAAdapter = require('../../core/integrations/jira-adapter');

const router = express.Router();

// Initialize logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/jira-api.log' })
  ],
  defaultMeta: { service: 'jira-api' }
});

// Rate limiting store (in-memory, use Redis for production)
const rateLimitStore = new Map();

/**
 * Rate limiting middleware
 */
function rateLimiter(req, res, next) {
  const userId = req.userId || req.ip;
  const now = Date.now();
  const windowMs = 15 * 60 * 1000; // 15 minutes
  const maxRequests = 100;

  if (!rateLimitStore.has(userId)) {
    rateLimitStore.set(userId, { count: 1, resetTime: now + windowMs });
    return next();
  }

  const userLimit = rateLimitStore.get(userId);

  if (now > userLimit.resetTime) {
    rateLimitStore.set(userId, { count: 1, resetTime: now + windowMs });
    return next();
  }

  if (userLimit.count >= maxRequests) {
    return res.status(429).json({
      error: 'Rate limit exceeded',
      resetTime: userLimit.resetTime
    });
  }

  userLimit.count++;
  next();
}

router.use(rateLimiter);

/**
 * Initialize JIRA service for user
 */
function getJIRAService(userTokens) {
  if (!userTokens || !userTokens.access_token) {
    throw new Error('JIRA not connected for this user');
  }

  const service = new JIRAService();
  service.accessToken = userTokens.access_token;
  service.refreshToken = userTokens.refresh_token;
  service.tokenExpiry = userTokens.token_expiry;
  service.cloudId = userTokens.cloud_id;
  service.siteUrl = userTokens.site_url;

  return service;
}

/**
 * POST /api/jira/sync
 * Trigger manual sync of JIRA data
 */
router.post('/sync', async (req, res) => {
  try {
    const userId = req.userId;
    const { projectKey, syncType = 'incremental' } = req.body;

    logger.info('Manual JIRA sync triggered', {
      userId,
      projectKey,
      syncType
    });

    // Get user's JIRA tokens from database
    // This would typically come from Supabase
    const userTokens = req.userIntegrations?.jira;
    
    const jiraService = getJIRAService(userTokens);
    const jiraAdapter = new JIRAAdapter();

    // Fetch projects
    const projects = await jiraService.getProjects();
    
    // Fetch issues for specified project or all projects
    const projectsToSync = projectKey ? 
      projects.filter(p => p.key === projectKey) : 
      projects;

    const syncResults = {
      projects_synced: projectsToSync.length,
      issues_synced: 0,
      sprints_synced: 0,
      errors: []
    };

    for (const project of projectsToSync) {
      try {
        // Get boards for project
        const boards = await jiraService.getBoards(project.key);
        
        for (const board of boards) {
          // Get active sprints
          const sprints = await jiraService.getSprints(board.id, 'active');
          syncResults.sprints_synced += sprints.length;
          
          // Get issues for each sprint
          for (const sprint of sprints) {
            const issues = await jiraService.getSprintIssues(sprint.id);
            syncResults.issues_synced += issues.length;
            
            // Transform issues to tasks
            const tasks = issues.map(issue => jiraAdapter.issueToTask(issue, userId));
            
            // Store tasks in database (implementation depends on your data layer)
            // await taskRepository.bulkUpsert(tasks);
          }
        }
      } catch (error) {
        logger.error('Failed to sync project', {
          projectKey: project.key,
          error: error.message
        });
        syncResults.errors.push({
          project: project.key,
          error: error.message
        });
      }
    }

    logger.info('JIRA sync completed', syncResults);

    res.json({
      success: true,
      ...syncResults
    });

  } catch (error) {
    logger.error('JIRA sync failed', {
      userId: req.userId,
      error: error.message
    });
    
    res.status(500).json({
      error: 'Sync failed',
      message: error.message
    });
  }
});

/**
 * GET /api/jira/issues
 * Fetch issues with filters
 */
router.get('/issues', async (req, res) => {
  try {
    const {
      jql,
      projectKey,
      status,
      assignee,
      startAt = 0,
      maxResults = 50
    } = req.query;

    logger.info('Fetching JIRA issues', {
      userId: req.userId,
      projectKey,
      status
    });

    const userTokens = req.userIntegrations?.jira;
    const jiraService = getJIRAService(userTokens);

    // Build JQL query
    let query = jql;
    if (!query) {
      const conditions = [];
      if (projectKey) conditions.push(`project = ${projectKey}`);
      if (status) conditions.push(`status = "${status}"`);
      if (assignee) conditions.push(`assignee = ${assignee}`);
      
      query = conditions.length > 0 ? conditions.join(' AND ') : 'ORDER BY updated DESC';
    }

    const result = await jiraService.getIssues(query, {
      startAt: parseInt(startAt),
      maxResults: parseInt(maxResults)
    });

    logger.info('Issues fetched', {
      userId: req.userId,
      total: result.total,
      returned: result.issues.length
    });

    res.json(result);

  } catch (error) {
    logger.error('Failed to fetch issues', {
      userId: req.userId,
      error: error.message
    });
    
    res.status(500).json({
      error: 'Failed to fetch issues',
      message: error.message
    });
  }
});

/**
 * POST /api/jira/issues
 * Create new issue
 */
router.post('/issues', async (req, res) => {
  try {
    const { project, summary, description, issuetype, priority, assignee } = req.body;

    if (!project || !summary || !issuetype) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['project', 'summary', 'issuetype']
      });
    }

    logger.info('Creating JIRA issue', {
      userId: req.userId,
      project,
      issuetype
    });

    const userTokens = req.userIntegrations?.jira;
    const jiraService = getJIRAService(userTokens);

    const issueData = {
      project: { key: project },
      summary,
      issuetype: { name: issuetype }
    };

    if (description) issueData.description = description;
    if (priority) issueData.priority = { name: priority };
    if (assignee) issueData.assignee = { accountId: assignee };

    const result = await jiraService.createIssue(issueData);

    logger.info('Issue created', {
      userId: req.userId,
      issueKey: result.key,
      issueId: result.id
    });

    res.status(201).json({
      success: true,
      issue: {
        id: result.id,
        key: result.key,
        url: `${jiraService.siteUrl}/browse/${result.key}`
      }
    });

  } catch (error) {
    logger.error('Failed to create issue', {
      userId: req.userId,
      error: error.message
    });
    
    res.status(500).json({
      error: 'Failed to create issue',
      message: error.message
    });
  }
});

/**
 * PATCH /api/jira/issues/:issueIdOrKey
 * Update existing issue
 */
router.patch('/issues/:issueIdOrKey', async (req, res) => {
  try {
    const { issueIdOrKey } = req.params;
    const updateData = req.body;

    logger.info('Updating JIRA issue', {
      userId: req.userId,
      issueIdOrKey
    });

    const userTokens = req.userIntegrations?.jira;
    const jiraService = getJIRAService(userTokens);

    await jiraService.updateIssue(issueIdOrKey, updateData);

    logger.info('Issue updated', {
      userId: req.userId,
      issueIdOrKey
    });

    res.json({
      success: true,
      message: 'Issue updated successfully'
    });

  } catch (error) {
    logger.error('Failed to update issue', {
      userId: req.userId,
      issueIdOrKey: req.params.issueIdOrKey,
      error: error.message
    });
    
    res.status(500).json({
      error: 'Failed to update issue',
      message: error.message
    });
  }
});

/**
 * GET /api/jira/sprints/:boardId
 * Get sprints for a board
 */
router.get('/sprints/:boardId', async (req, res) => {
  try {
    const { boardId } = req.params;
    const { state = 'active,future' } = req.query;

    logger.info('Fetching sprints', {
      userId: req.userId,
      boardId,
      state
    });

    const userTokens = req.userIntegrations?.jira;
    const jiraService = getJIRAService(userTokens);

    const sprints = await jiraService.getSprints(boardId, state);

    res.json({
      board_id: boardId,
      sprints
    });

  } catch (error) {
    logger.error('Failed to fetch sprints', {
      userId: req.userId,
      boardId: req.params.boardId,
      error: error.message
    });
    
    res.status(500).json({
      error: 'Failed to fetch sprints',
      message: error.message
    });
  }
});

/**
 * GET /api/jira/velocity/:sprintId
 * Get sprint velocity metrics
 */
router.get('/velocity/:sprintId', async (req, res) => {
  try {
    const { sprintId } = req.params;

    logger.info('Calculating sprint velocity', {
      userId: req.userId,
      sprintId
    });

    const userTokens = req.userIntegrations?.jira;
    const jiraService = getJIRAService(userTokens);

    const velocity = await jiraService.calculateSprintVelocity(sprintId);

    res.json(velocity);

  } catch (error) {
    logger.error('Failed to calculate velocity', {
      userId: req.userId,
      sprintId: req.params.sprintId,
      error: error.message
    });
    
    res.status(500).json({
      error: 'Failed to calculate velocity',
      message: error.message
    });
  }
});

module.exports = router;


