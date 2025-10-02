# 🔌 Supabase Integration Guide

## ✅ What's Integrated

Your Supabase database is **fully set up** with:
- ✅ Complete schema (12 tables)
- ✅ Sample data (companies, teams, sources)
- ✅ All indexes and constraints
- ✅ Row Level Security

## 🔗 Integration Status

### **Slack Bot** - Ready to Integrate ⚡
**Location:** `delivery/slack/`

**Adapter Created:** `delivery/slack/supabase-adapter.js`

**What it provides:**
- User management (get/create users from Slack)
- Signal delivery tracking
- Feedback collection
- Conversation storage
- Digest management
- User preferences

**Integration Steps:**

1. **Add adapter to Slack app:**

```javascript
// In delivery/slack/app.js
const SlackSupabaseAdapter = require('./supabase-adapter');

class HeyJarvisSlackApp {
  constructor(options = {}) {
    // ... existing code ...
    
    // Add Supabase adapter
    this.dbAdapter = new SlackSupabaseAdapter({
      logger: this.logger
    });
  }
  
  // Replace in-memory user lookups with database
  async getUserFromSlack(slackUserId) {
    // Get Slack user info
    const slackUser = await this.slackApp.client.users.info({
      user: slackUserId
    });
    
    // Get or create in database
    return await this.dbAdapter.getOrCreateUser(slackUser.user);
  }
  
  // Track deliveries
  async deliverSignal(signal, userId, channel) {
    const result = await this.slackApp.client.chat.postMessage({
      channel: channel,
      blocks: this.createSignalBlocks(signal)
    });
    
    // Track in database
    await this.dbAdapter.trackDelivery({
      signal_id: signal.id,
      user_id: userId,
      channel: channel,
      message_ts: result.ts,
      urgency: signal.priority
    });
    
    return result;
  }
  
  // Record feedback
  async handleFeedback(signalId, userId, feedbackType, value) {
    return await this.dbAdapter.recordFeedback({
      signal_id: signalId,
      user_id: userId,
      feedback_type: feedbackType,
      value: value,
      context: {
        timestamp: Date.now(),
        source: 'slack_button'
      }
    });
  }
}
```

---

### **CRM Integration** - Ready to Integrate ⚡
**Location:** `crm-integration/`

**Adapter Created:** `crm-integration/supabase-adapter.js`

**What it provides:**
- Analysis history persistence
- Alert tracking
- Company intelligence storage
- Recommendation tracking
- Effectiveness metrics

**Integration Steps:**

1. **Add adapter to background service:**

```javascript
// In crm-integration/intelligent-background-service.js
const CRMSupabaseAdapter = require('./supabase-adapter');

class IntelligentBackgroundService {
  constructor(options = {}) {
    // ... existing code ...
    
    // Add Supabase adapter
    this.dbAdapter = new CRMSupabaseAdapter({
      logger: this.logger
    });
    
    // Replace in-memory maps
    // this.analysisHistory = new Map(); // ❌ Remove
    // this.alertHistory = new Map();    // ❌ Remove
  }
  
  async storeAnalysisResults(organizationId, analysis) {
    // Store in database instead of memory
    const signal = await this.dbAdapter.storeAnalysis(organizationId, analysis);
    
    this.logger.info('Analysis stored in database', {
      organization_id: organizationId,
      signal_id: signal.id
    });
    
    return signal;
  }
  
  async getOrganizationHistory(organizationId) {
    // Get from database instead of memory
    return await this.dbAdapter.getAnalysisHistory(organizationId);
  }
  
  async sendAlert(organizationId, alertData) {
    // Store alert in database
    const signal = await this.dbAdapter.storeAlert(organizationId, alertData);
    
    // Send to Slack/notifications
    await this.notificationService.send(alertData);
    
    return signal;
  }
  
  async trackRecommendation(organizationId, recommendation) {
    // Track in database for effectiveness metrics
    return await this.dbAdapter.trackRecommendation(
      organizationId,
      recommendation
    );
  }
}
```

---

## 🧪 Testing the Integration

I've created test scripts to verify everything works:

### **Test Slack Integration:**

```bash
node test-slack-integration.js
```

This will test:
- ✅ User creation/lookup
- ✅ Signal delivery tracking
- ✅ Feedback recording
- ✅ Conversation storage

### **Test CRM Integration:**

```bash
node test-crm-integration.js
```

This will test:
- ✅ Analysis storage
- ✅ Alert tracking
- ✅ Company intelligence
- ✅ Recommendation tracking

---

## 📊 Benefits You Get

### **With Database Integration:**

✅ **Persistent Data**
- No data loss on restart
- Historical tracking
- Analytics and reporting

✅ **Cross-System Intelligence**
- Slack bot sees CRM insights
- CRM sees Slack engagement
- Unified user profiles

✅ **Advanced Features**
- Real-time subscriptions
- Full-text search
- Team collaboration
- Audit trails

✅ **Scalability**
- Handle thousands of signals
- Multiple users and teams
- Production-ready

---

## 🚀 Quick Start

### **Option 1: Auto-Integration (Recommended)**

Run this to automatically integrate both systems:

```bash
node scripts/integrate-systems.js
```

This will:
1. Add adapters to both systems
2. Update configurations
3. Test connections
4. Verify everything works

### **Option 2: Manual Integration**

Follow the integration steps above for each system individually.

---

## 📁 Files Created

1. **`delivery/slack/supabase-adapter.js`** - Slack database adapter
2. **`crm-integration/supabase-adapter.js`** - CRM database adapter
3. **`test-slack-integration.js`** - Slack integration tests
4. **`test-crm-integration.js`** - CRM integration tests
5. **`scripts/integrate-systems.js`** - Auto-integration script

---

## 🔍 Verify Integration

After integration, check:

1. **Database has data:**
   - Go to Supabase dashboard
   - Check `signals`, `signal_deliveries`, `feedback` tables
   - Should see new records

2. **Logs show database operations:**
   ```
   ✅ Stored signal in database
   ✅ Tracked delivery
   ✅ Recorded feedback
   ```

3. **No errors on startup:**
   ```bash
   npm run dev:delivery  # Should connect to DB
   node crm-integration/intelligent-background-service.js  # Should use DB
   ```

---

## ⚠️ Important Notes

1. **Service Role Key:** The adapters use your `SUPABASE_SERVICE_ROLE_KEY` for admin operations
2. **Row Level Security:** When integrating user-facing features, use the `SUPABASE_ANON_KEY` instead
3. **Real-time Updates:** You can subscribe to database changes for live updates
4. **Migrations:** Future schema changes should use migration scripts

---

## 🆘 Troubleshooting

### Error: "Connection refused"
- Check `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in `.env`
- Verify Supabase project is active

### Error: "Row level security policy violated"
- Use service role key for background operations
- Use anon key for user-facing operations

### Error: "Table does not exist"
- Re-run schema installation
- Check Supabase dashboard for tables

---

## 💡 Next Steps

After integration:

1. **Test end-to-end:** Send a signal through Slack bot
2. **Check database:** Verify it's stored in Supabase
3. **View analytics:** Use Supabase dashboard to see data
4. **Enable real-time:** Subscribe to signal updates
5. **Add more sources:** Expand your intelligence gathering

---

**Ready to integrate? Run:**
```bash
node scripts/integrate-systems.js
```

Or integrate manually following the steps above! 🚀

