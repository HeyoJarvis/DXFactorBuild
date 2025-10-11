# HeyJarvis Mission Control for Developers - Implementation Guide

## 🎯 Overview

HeyJarvis Mission Control for Developers is a comprehensive AI-powered workspace that connects your codebase, task management, chat/collaboration channels, and deployment infrastructure.

## 📦 What's Been Implemented

### Phase 1: Core Integrations ✅

#### 1.1 JIRA Integration (Complete)
- **Files Created:**
  - `core/integrations/jira-service.js` - Full OAuth 2.0 JIRA API client
  - `oauth/jira-oauth-handler.js` - Desktop OAuth flow handler
  - `core/integrations/jira-adapter.js` - Data transformation layer
  - `api/jira/sync.js` - REST API endpoints
  - `data/models/user.schema.js` - Updated with JIRA integration fields

- **Features:**
  - ✅ OAuth 2.0 authentication with PKCE
  - ✅ Bidirectional sync (read and write)
  - ✅ Projects, boards, and sprints access
  - ✅ Issue CRUD operations
  - ✅ Sprint velocity calculation
  - ✅ Bottleneck detection
  - ✅ Story point tracking

#### 1.2 GitHub Actions CI/CD Integration (Complete)
- **Files Created:**
  - `core/integrations/github-actions-service.js` - Workflow run monitoring
  - `core/intelligence/deployment-analyzer.js` - DORA metrics calculator

- **Features:**
  - ✅ Workflow run tracking
  - ✅ Deployment event monitoring
  - ✅ DORA metrics (deployment frequency, lead time, MTTR, change failure rate)
  - ✅ Risky deployment detection
  - ✅ PR-to-deployment linking

#### 1.3 AI Model Router (Complete)
- **Files Created:**
  - `core/ai/model-router.js` - Intelligent model routing

- **Features:**
  - ✅ Config-driven routing rules
  - ✅ Anthropic Claude as primary provider
  - ✅ OpenAI GPT support (optional)
  - ✅ Fallback chain for reliability
  - ✅ Provider health monitoring

### Phase 2: Analytics Engine ✅

#### 2.1 Sprint Analytics (Complete)
- **Files Created:**
  - `core/intelligence/sprint-analyzer.js` - Sprint velocity and predictions
  - `core/intelligence/code-to-ticket-matcher.js` - Commit-to-ticket linking

- **Features:**
  - ✅ Sprint velocity calculation
  - ✅ Bottleneck identification
  - ✅ Completion prediction
  - ✅ AI-generated sprint reports
  - ✅ Estimation accuracy analysis
  - ✅ Developer velocity insights
  - ✅ Time tracking (first commit to PR merge)

#### 2.2 Natural Language Query Engine (Complete)
- **Files Created:**
  - `core/intelligence/dev-query-parser.js` - Developer query parser

- **Features:**
  - ✅ Intent detection (sprint, blockers, deploy, tickets, velocity, standup)
  - ✅ Entity extraction (sprint ID, ticket key, environment, priority)
  - ✅ Multi-service orchestration
  - ✅ Rich response formatting

### Phase 3: Collaboration Features ✅

#### 3.1 Slack Developer Commands (Complete)
- **Files Created:**
  - `delivery/slack/dev-commands.js` - Slash commands for developers

- **Commands:**
  - ✅ `/jarvis-sprint` - Current sprint status
  - ✅ `/jarvis-blockers` - Show blocked tickets
  - ✅ `/jarvis-deploy` - Deployment pipeline status
  - ✅ `/jarvis-velocity` - Team velocity trends
  - ✅ `/jarvis-standup` - Generate standup summary

## 🚀 Quick Start

### Prerequisites

```bash
# Environment variables required
JIRA_CLIENT_ID=your_jira_client_id
JIRA_CLIENT_SECRET=your_jira_client_secret
JIRA_REDIRECT_URI=http://localhost:8890/auth/jira/callback

GITHUB_TOKEN=your_github_token
GITHUB_REPO_OWNER=your_org
GITHUB_REPO_NAME=your_repo

ANTHROPIC_API_KEY=your_anthropic_key
```

### Installation

```bash
# Install dependencies (already done via npm run setup)
npm install

# Start services
npm run dev
```

### Connect JIRA

```javascript
// In your desktop app
const JIRAOAuthHandler = require('./oauth/jira-oauth-handler');

const jiraOAuth = new JIRAOAuthHandler();
const result = await jiraOAuth.startAuthFlow();

// Tokens are now available in result.access_token, result.refresh_token
```

### Use Sprint Analytics

```javascript
const SprintAnalyzer = require('./core/intelligence/sprint-analyzer');
const JIRAService = require('./core/integrations/jira-service');
const JIRAAdapter = require('./core/integrations/jira-adapter');
const ModelRouter = require('./core/ai/model-router');

// Initialize services
const jiraService = new JIRAService();
const jiraAdapter = new JIRAAdapter();
const modelRouter = new ModelRouter();

// Create analyzer
const sprintAnalyzer = new SprintAnalyzer(jiraService, jiraAdapter, modelRouter);

// Get sprint report
const report = await sprintAnalyzer.generateSprintReport('sprint-123');
console.log(report.summary); // AI-generated summary
console.log(report.metrics); // Velocity, bottlenecks, prediction
```

### Query with Natural Language

```javascript
const DevQueryParser = require('./core/intelligence/dev-query-parser');

const queryParser = new DevQueryParser({
  jiraService,
  githubActionsService,
  sprintAnalyzer,
  deploymentAnalyzer
});

// Ask questions
const result = await queryParser.parseAndExecute(
  "What's blocking production deploy?",
  { currentSprintId: 'sprint-123' }
);

console.log(result.response); // Natural language answer
console.log(result.data); // Structured data
```

### Use Slack Commands

```javascript
// In your Slack app setup
const DevCommands = require('./delivery/slack/dev-commands');

const devCommands = new DevCommands({
  jiraService,
  githubActionsService,
  sprintAnalyzer,
  deploymentAnalyzer
});

devCommands.register(slackApp);
```

## 📊 Sample Queries

### Sprint Status
```
User: "What's the current sprint status?"

Response:
📊 Sprint Status: Sprint 42

The sprint is progressing well with 65% completion rate. We have 2 blocked 
issues that need immediate attention. The team is on track to complete 23 
out of 30 story points by Friday. Key risk: API integration task is blocked 
waiting for security review.

Quick Stats:
• Completion: 65%
• Blocked: 2 issues
• Days Remaining: 3
• Risk: MEDIUM
```

### Blockers
```
User: "Show me what's blocking us"

Response:
🚨 Found 2 blocked issue(s):

• 2 issue(s) are currently blocked (high severity)
  - PROJ-123: API Integration blocked on security review
  - PROJ-456: Database migration blocked on DBA approval

• 3 issue(s) stuck in review (medium severity)
```

### Deployment Status
```
User: "What's deployed to production?"

Response:
✅ Latest production deployment: success

SHA: abc1234
Deployed: Today at 2:15 PM
Status: All systems operational
```

### Velocity
```
User: "Show team velocity"

Response:
📈 Sprint Velocity

Completion Rate: 75%
Velocity Rate: 80%
Story Points: 24/30
Issues Completed: 18/25

By Issue Type:
• Feature: 12 issues (18 points)
• Bug: 4 issues (4 points)
• Tech Debt: 2 issues (2 points)
```

## 🔧 Configuration

### Model Router Configuration

```javascript
const modelRouter = new ModelRouter({
  defaultProvider: 'anthropic',
  anthropicApiKey: process.env.ANTHROPIC_API_KEY
});

// Customize routing
modelRouter.setRouting('code_query', {
  provider: 'anthropic',
  model: 'claude-3-5-sonnet-20241022',
  fallback: []
});

modelRouter.setRouting('sprint_summary', {
  provider: 'anthropic',
  model: 'claude-3-5-sonnet-20241022',
  fallback: []
});
```

### JIRA Service Configuration

```javascript
const jiraService = new JIRAService({
  clientId: process.env.JIRA_CLIENT_ID,
  clientSecret: process.env.JIRA_CLIENT_SECRET,
  redirectUri: 'http://localhost:8890/auth/jira/callback',
  scopes: [
    'read:jira-work',
    'write:jira-work',
    'read:jira-user'
  ]
});
```

### GitHub Actions Configuration

```javascript
const githubActionsService = new GitHubActionsService({
  githubToken: process.env.GITHUB_TOKEN,
  repository: {
    owner: process.env.GITHUB_REPO_OWNER,
    repo: process.env.GITHUB_REPO_NAME
  }
});
```

## 🎯 Key Features by User Persona

### For Individual Developers
- ✅ Track personal velocity and ticket status
- ✅ Get blockers impacting your work
- ✅ See PR review queue
- ✅ Natural language queries ("What's my status?")
- ✅ Slack commands for quick access

### For Engineering Leads
- ✅ Sprint velocity vs plan comparison
- ✅ Bottleneck detection across team
- ✅ Predictive sprint completion analytics
- ✅ Team performance metrics
- ✅ AI-generated standup summaries

### For DevOps Engineers
- ✅ Deployment status monitoring
- ✅ DORA metrics dashboard
- ✅ Risky deployment detection
- ✅ CI/CD pipeline health
- ✅ Deployment frequency tracking

## 📈 DORA Metrics

The system automatically calculates industry-standard DORA metrics:

1. **Deployment Frequency**: How often code is deployed to production
2. **Lead Time for Changes**: Time from commit to production
3. **Mean Time to Recover (MTTR)**: Average time to recover from failures
4. **Change Failure Rate**: Percentage of deployments causing failures

Ratings: Elite, High, Medium, Low (based on DORA research standards)

## 🔐 Security & Privacy

- ✅ OAuth 2.0 with PKCE for JIRA
- ✅ GitHub Personal Access Token (PAT) authentication
- ✅ User-specific integration tokens stored in Supabase
- ✅ Rate limiting on all API endpoints (100 req/15min per user)
- ✅ Audit logging for all JIRA/GitHub operations

## 📝 API Endpoints

### JIRA Sync API
```
POST   /api/jira/sync              - Trigger manual sync
GET    /api/jira/issues            - Fetch issues with filters
POST   /api/jira/issues            - Create new issue
PATCH  /api/jira/issues/:id        - Update issue
GET    /api/jira/sprints/:boardId  - Get sprints for board
GET    /api/jira/velocity/:sprintId - Get sprint velocity
```

## 🚧 What's Not Implemented Yet

### Dashboard UI (Planned)
- Dev overview page
- Sprint board (Kanban view)
- Deployment timeline
- Team analytics dashboard

### Dev Workflow Automation (Planned)
- Auto-schedule standups
- Code review session scheduling
- Sprint retro automation

### Manager Reports (Planned)
- Exportable sprint reports (PDF/CSV)
- Historical trend analysis
- Customizable team goals

## 🎓 Architecture Patterns

### Service Layer Pattern
All integrations follow consistent patterns:
- OAuth handler for authentication
- Service class for API operations
- Adapter for data transformation
- Repository for data persistence

### Event-Driven Architecture
Services emit events for monitoring:
```javascript
sprintAnalyzer.on('velocity_calculated', (data) => {
  console.log('Velocity calculated:', data);
});

deploymentAnalyzer.on('metrics_calculated', (metrics) => {
  console.log('DORA metrics:', metrics);
});
```

### Error Handling
Consistent structured error handling:
```javascript
try {
  const result = await service.operation();
  logger.info('Operation succeeded', { result });
} catch (error) {
  logger.error('Operation failed', {
    error: error.message,
    stack: error.stack,
    context
  });
  throw error;
}
```

## 📚 Additional Resources

- JIRA REST API: https://developer.atlassian.com/cloud/jira/platform/rest/v3/
- GitHub Actions API: https://docs.github.com/en/rest/actions
- DORA Metrics: https://cloud.google.com/blog/products/devops-sre/using-the-four-keys-to-measure-your-devops-performance

## 🤝 Contributing

When adding new features:
1. Follow existing service patterns (see coding standards in rules)
2. Add comprehensive error handling and logging
3. Emit events for key operations
4. Write JSDoc comments for public methods
5. Update this documentation

## 📞 Support

For issues or questions:
- Check logs in `logs/` directory
- Review error messages in Winston logs
- Ensure all environment variables are set
- Verify OAuth tokens are valid

---

**Built with ❤️ for modern engineering teams**

