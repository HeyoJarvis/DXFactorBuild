# CRM Workflow Analyzer

AI-powered CRM workflow analysis and optimization system that extracts, analyzes, and provides actionable insights from your sales processes.

## 🎯 Overview

The CRM Workflow Analyzer transforms your CRM data into intelligent insights by:

1. **Extracting Workflows**: Automatically discovers actual sales processes from CRM data
2. **AI Pattern Detection**: Uses Claude AI to identify workflow patterns and bottlenecks  
3. **Tool Recommendations**: Provides ROI-justified tool recommendations to optimize workflows
4. **Real-time Alerts**: Sends intelligent Slack notifications for workflow issues and opportunities
5. **Continuous Monitoring**: Tracks workflow performance and identifies optimization opportunities

## 🚀 Quick Start

### Installation

```bash
cd crm-integration
npm install
```

### Basic Usage

```javascript
const CRMWorkflowAnalyzer = require('./index');

// Initialize the analyzer
const analyzer = new CRMWorkflowAnalyzer({
  logLevel: 'info',
  enableSlackAlerts: true,
  enableRealTimeMonitoring: true
});

// Configure CRM connections
const crmConfigs = [{
  type: 'hubspot',
  organization_id: 'org_123',
  access_token: process.env.HUBSPOT_ACCESS_TOKEN
}];

// Initialize with Slack integration
await analyzer.initialize(crmConfigs, slackApp);

// Analyze workflows
const results = await analyzer.analyzeWorkflows('org_123');
console.log(`Found ${results.pattern_count} workflow patterns`);
console.log(`Generated ${results.recommendation_count} tool recommendations`);
```

## 📊 What It Analyzes

### Workflow Patterns Detected
- **Lead Conversion Workflows**: MQL → SQL → Opportunity → Customer
- **Deal Progression Workflows**: Discovery → Demo → Proposal → Negotiation → Close
- **Customer Expansion Workflows**: Onboarding → Adoption → Upsell → Renewal
- **Performance Patterns**: Individual rep and team performance workflows

### Bottlenecks Identified
- **Stage Stagnation**: Deals stuck in stages longer than average
- **Activity Gaps**: Long periods without prospect engagement
- **Conversion Drops**: Stages with declining conversion rates
- **Resource Constraints**: Process delays due to resource availability

### Success Factors Discovered
- **High-Performer Patterns**: What top reps do differently
- **Optimal Sequences**: Most effective activity sequences
- **Timing Insights**: Best times for engagement and follow-up
- **Multi-threading**: Stakeholder engagement patterns that drive success

## 🛠️ Tool Recommendations

The system provides AI-powered tool recommendations with comprehensive ROI analysis:

### Example Recommendation Output

```json
{
  "recommended_tool": "Calendly + Zapier + PandaDoc",
  "addresses_issue": "Demo-to-Proposal Stage Bottleneck",
  "roi_analysis": {
    "roi_percentage": 347,
    "payback_period_months": 2.2,
    "annual_revenue_increase": 1340000,
    "implementation_cost": 24800
  },
  "implementation_plan": {
    "phase_1": "Setup and configuration (2 weeks)",
    "phase_2": "Team training and rollout (3 weeks)",
    "phase_3": "Optimization and measurement (2 weeks)"
  },
  "confidence_score": 0.89
}
```

## 🚨 Slack Alerts

Real-time workflow intelligence delivered to your team:

### Alert Types
- **🚨 Deal Stagnation**: Deals stuck beyond normal stage duration
- **⚠️ Bottleneck Detected**: Systematic workflow slowdowns identified
- **📉 Conversion Drop**: Stage conversion rates declining
- **💰 High Value at Risk**: Large deals showing risk signals
- **🎯 Success Pattern**: High-performing patterns identified
- **🚀 ROI Opportunity**: High-impact tool recommendations

### Interactive Actions
- **📅 Schedule Check-ins**: One-click meeting scheduling
- **📊 View Analysis**: Deep-dive into workflow data
- **💰 ROI Details**: Detailed tool recommendation analysis
- **✅ Approve Implementation**: Workflow approval processes

## 📈 Analysis Output

### Workflow Health Score
Overall score (0-100) based on:
- Conversion rates vs. benchmarks
- Cycle time efficiency
- Bottleneck severity
- Process consistency

### Pattern Analysis
```javascript
{
  "pattern_name": "Enterprise Consultative Sale",
  "workflow_count": 47,
  "success_rate": 0.67,
  "avg_cycle_time": 89,
  "key_characteristics": [
    "Executive sponsor engagement within 2 weeks",
    "Technical validation before proposal",
    "Multi-stakeholder involvement"
  ],
  "bottlenecks": [
    {
      "location": "Demo → Proposal",
      "issue": "18-day average delay",
      "impact": "28% conversion drop",
      "severity": "high"
    }
  ],
  "success_factors": [
    {
      "factor": "Executive Engagement",
      "correlation": 0.73,
      "actionable_insight": "Identify C-level sponsor within first 2 weeks"
    }
  ]
}
```

## 🔧 Configuration

### Environment Variables

```bash
# CRM Configuration
HUBSPOT_ACCESS_TOKEN=your_hubspot_token

# AI Configuration  
ANTHROPIC_API_KEY=your_anthropic_key

# Slack Configuration
SLACK_BOT_TOKEN=xoxb-your-bot-token
SLACK_SIGNING_SECRET=your-signing-secret
SLACK_APP_TOKEN=xapp-your-app-token

# Dashboard URL
DASHBOARD_URL=https://your-dashboard.com
```

### Analysis Options

```javascript
const options = {
  // Analysis configuration
  analysisInterval: 3600000, // 1 hour
  confidenceThreshold: 0.6,
  minPatternSize: 3,
  
  // Alert configuration
  enableSlackAlerts: true,
  enableRealTimeMonitoring: true,
  
  // ROI calculation
  roiTimeframe: 12, // months
  maxRecommendations: 5
};
```

## 📋 API Reference

### Core Methods

#### `analyzeWorkflows(organizationId, options)`
Analyzes workflows for an organization and returns comprehensive insights.

**Parameters:**
- `organizationId` (string): Organization identifier
- `options` (object): Analysis options
  - `dateRange` (object): Start and end dates for analysis
  - `includeArchived` (boolean): Include archived deals
  - `pipeline` (string): Specific pipeline to analyze

**Returns:** Analysis results with workflows, patterns, and recommendations

#### `addCRMAdapter(crmConfig)`
Adds a new CRM integration.

**Parameters:**
- `crmConfig` (object): CRM configuration
  - `type` (string): CRM type ('hubspot', 'salesforce', etc.)
  - `organization_id` (string): Organization identifier
  - `access_token` (string): CRM API token

#### `getAnalysisResults(organizationId)`
Retrieves cached analysis results for an organization.

### Event Emitters

```javascript
analyzer.on('analysis_completed', (results) => {
  console.log(`Analysis completed for ${results.organization_id}`);
});

analyzer.on('analysis_error', ({ organizationId, error }) => {
  console.error(`Analysis failed for ${organizationId}: ${error.message}`);
});
```

## 🧪 Testing

```bash
# Run tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test suite
npm test -- --grep "HubSpot Adapter"
```

## 🚀 Deployment

### Production Setup

1. **Environment Configuration**
   ```bash
   cp .env.example .env
   # Configure your environment variables
   ```

2. **Database Setup**
   ```bash
   # Run migrations (if using database storage)
   npm run migrate
   ```

3. **Start the Service**
   ```bash
   npm start
   ```

### Docker Deployment

```bash
# Build image
docker build -t crm-workflow-analyzer .

# Run container
docker run -d \
  --name crm-analyzer \
  --env-file .env \
  -p 3000:3000 \
  crm-workflow-analyzer
```

## 🔍 Monitoring & Debugging

### Logging Levels
- `error`: Critical errors only
- `warn`: Warnings and errors
- `info`: General information (default)
- `debug`: Detailed debugging information

### Health Checks
```javascript
// Check analyzer health
const health = await analyzer.getHealthStatus();
console.log(health);
// {
//   status: 'healthy',
//   crm_connections: 2,
//   last_analysis: '2024-12-23T10:30:00Z',
//   alerts_sent_24h: 15
// }
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

- **Documentation**: [Internal Wiki](https://wiki.company.com/crm-analyzer)
- **Issues**: Create GitHub issues for bugs and feature requests
- **Slack**: #sales-ops channel for questions and support
