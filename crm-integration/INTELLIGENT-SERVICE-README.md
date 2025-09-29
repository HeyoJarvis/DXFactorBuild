# 🧠 Intelligent Background Service

A modern, AI-powered background service that provides intelligent CRM analysis with company intelligence integration.

## 🚀 Features

### Core Capabilities
- **🤖 AI-Powered Analysis**: Uses Claude AI for advanced workflow pattern detection
- **🏢 Company Intelligence**: Extracts company context from websites for personalized insights
- **💡 Smart Recommendations**: Generates contextual tool recommendations with ROI projections
- **📊 Real-time Monitoring**: Monitors CRM changes via HubSpot webhooks
- **🔔 Intelligent Alerts**: Smart alerting system with rate limiting (max 5/day)
- **📈 Performance Tracking**: Tracks workflow health scores and conversion rates

### API Endpoints
- `GET /health` - Service health check
- `POST /webhooks/hubspot` - HubSpot webhook receiver
- `POST /analysis/trigger` - Manual analysis trigger
- `GET /analysis/latest/:organizationId` - Get latest analysis results
- `GET /recommendations/:organizationId` - Get recommendations
- `GET /intelligence/:organizationId` - Get company intelligence

## 🛠️ Setup & Installation

### Prerequisites
- Node.js 18+
- HubSpot API Key
- Anthropic API Key
- Company website URL

### Environment Variables
```bash
HUBSPOT_API_KEY=pat-na1-your-hubspot-key
ANTHROPIC_API_KEY=sk-ant-api03-your-anthropic-key
COMPANY_WEBSITE=https://your-company.com
LOG_LEVEL=info
```

### Quick Start
```bash
# Set environment variables
export HUBSPOT_API_KEY="your-hubspot-key"
export ANTHROPIC_API_KEY="your-anthropic-key"
export COMPANY_WEBSITE="https://your-company.com"

# Start the service
./start-intelligent-service.sh
```

Or run directly:
```bash
node intelligent-background-service.js
```

## 📡 Service Details

### Port Configuration
- **Default Port**: 3002
- **Legacy Service Port**: 3001 (background-service.js)
- **Enhanced Service Port**: 3000 (enhanced-background-service.js)

### Webhook Configuration
Configure HubSpot webhooks to point to:
```
http://your-domain:3002/webhooks/hubspot
```

### Analysis Schedule
- **Periodic Analysis**: Every 30 minutes
- **Webhook Triggers**: Real-time on deal/contact changes
- **Manual Triggers**: Via API endpoint

## 🎯 Usage Examples

### Manual Analysis Trigger
```bash
curl -X POST http://localhost:3002/analysis/trigger \
  -H "Content-Type: application/json" \
  -d '{
    "website": "https://example.com",
    "organization_id": "example_org"
  }'
```

### Get Latest Recommendations
```bash
curl http://localhost:3002/recommendations/default_org
```

### Health Check
```bash
curl http://localhost:3002/health
```

## 📊 Analysis Output

### Analysis Results Structure
```json
{
  "analysis_id": "analysis_1234567890",
  "timestamp": "2025-09-26T03:19:47.019Z",
  "company_name": "Example Company",
  "workflows": [...],
  "patterns": [...],
  "recommendations": [
    {
      "tool_name": "Calendly",
      "category": "scheduling_automation",
      "recommendation": "Eliminate manual scheduling...",
      "business_impact": "Save 10+ hours per week",
      "estimated_cost": 600,
      "projected_savings": 12000,
      "priority": "high"
    }
  ],
  "summary": {
    "workflow_health_score": 45,
    "total_workflows": 20,
    "conversion_rate": 0.15,
    "avg_cycle_time": 185
  }
}
```

### Company Intelligence Structure
```json
{
  "company": {
    "name": "Example Company",
    "industry": "Technology",
    "description": "AI platform for..."
  },
  "organization_context": {
    "company_size": "smb",
    "business_model": "B2B SaaS",
    "tech_sophistication": "high"
  },
  "workflow_intelligence": {
    "automation_gaps": ["staff onboarding", "payment collections"],
    "integration_needs": ["ABC", "Ignite", "Glofox"],
    "manual_processes": ["training", "scheduling"]
  }
}
```

## 🔔 Alert Types

### Critical Health Alert
- Triggered when workflow health score < 30%
- Includes immediate action recommendations
- Urgency: Critical

### High-Value Opportunity Alert
- Triggered for recommendations with >$10k savings potential
- Shows ROI projections and implementation timeline
- Urgency: Medium

### Pattern Discovery Alert
- Triggered when AI discovers high-confidence patterns (>80%)
- Highlights workflow issues and bottlenecks
- Urgency: Medium

## 🔧 Integration with Frontend

### Event Emitters
The service emits events that can be consumed by frontend applications:

```javascript
service.on('analysis_completed', (data) => {
  // Handle completed analysis
  console.log('Analysis completed:', data.analysisId);
});

service.on('alert_generated', (data) => {
  // Handle new alerts
  console.log('New alert:', data.alert.type);
});
```

### Frontend API Integration
```javascript
// Get latest analysis
const response = await fetch('/analysis/latest/default_org');
const analysis = await response.json();

// Get recommendations
const recommendations = await fetch('/recommendations/default_org');
const recs = await recommendations.json();

// Trigger manual analysis
await fetch('/analysis/trigger', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    website: 'https://company.com',
    organization_id: 'org_id'
  })
});
```

## 🆚 Comparison with Legacy Services

| Feature | Intelligent Service | Legacy Service | Enhanced Service |
|---------|-------------------|----------------|------------------|
| **AI Analysis** | ✅ Claude AI | ❌ Rule-based | ✅ Limited |
| **Company Intelligence** | ✅ Full integration | ❌ None | ✅ Basic |
| **Recommendations** | ✅ Contextual + ROI | ❌ Hardcoded | ✅ Basic |
| **Port** | 3002 | 3001 | 3000 |
| **Dependencies** | New analyzer only | Legacy + compatibility | Mixed |
| **Performance** | High | Medium | Medium |

## 🚀 Production Deployment

### Docker Support
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3002
CMD ["node", "intelligent-background-service.js"]
```

### Environment Configuration
```bash
# Production environment
NODE_ENV=production
LOG_LEVEL=warn
COMPANY_WEBSITE=https://your-production-domain.com
HUBSPOT_API_KEY=your-production-key
ANTHROPIC_API_KEY=your-production-key
```

### Health Monitoring
Monitor the service health endpoint:
```bash
# Health check script
#!/bin/bash
response=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3002/health)
if [ $response != "200" ]; then
    echo "Service unhealthy: $response"
    exit 1
fi
```

## 🔍 Troubleshooting

### Common Issues

**Service won't start:**
- Check environment variables are set
- Verify API keys are valid
- Ensure port 3002 is available

**Analysis fails:**
- Check HubSpot API key permissions
- Verify Anthropic API key is valid
- Check company website is accessible

**No recommendations generated:**
- Ensure company intelligence extraction succeeded
- Check workflow data quality
- Verify recommendation engine configuration

### Logs
Service logs are written to:
- Console (formatted)
- `logs/intelligent-service.log` (JSON format)

### Debug Mode
```bash
export LOG_LEVEL=debug
node intelligent-background-service.js
```

## 📈 Performance Metrics

### Typical Analysis Times
- **Company Intelligence Extraction**: 15-25 seconds
- **CRM Workflow Analysis**: 2-5 minutes (20-50 workflows)
- **AI Pattern Detection**: 30-60 seconds per pattern cluster
- **Recommendation Generation**: 5-10 seconds

### Resource Usage
- **Memory**: ~200-400MB during analysis
- **CPU**: Moderate during AI processing
- **Network**: API calls to HubSpot, Anthropic, and company websites

## 🤝 Contributing

### Development Setup
```bash
git clone <repository>
cd crm-integration
npm install
cp .env.example .env  # Configure your API keys
npm run dev
```

### Testing
```bash
# Test the service
node test-intelligent-bg-service.js

# Manual testing
./start-intelligent-service.sh
```

---

**🎯 Ready to revolutionize your CRM analysis with AI-powered insights!**
