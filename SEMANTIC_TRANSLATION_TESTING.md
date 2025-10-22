# Semantic Translation System - Testing Guide

## Overview
This guide shows you how to test the new JIRA Semantic Translator and Context Linker features.

## Prerequisites
1. ✅ JIRA OAuth configured and authenticated
2. ✅ Slack connected
3. ✅ At least one user authenticated in the system
4. ✅ Claude API key configured (for AI translation)

---

## Test Scenario 1: End-to-End Workflow (Slack → JIRA → Translation)

### Step 1: Create a Task from Slack
In any Slack channel where your bot is present, post:
```
@yourname can you add support for exporting reports to PDF?
```

**Expected Results:**
- ✅ Task auto-created in your system
- ✅ Console log: `🔗 Context linked for future JIRA translation`
- ✅ Context stored with original Slack message details

### Step 2: Update the JIRA Ticket
Go to JIRA and update the ticket:
- Add a comment: "Implemented PDF export with header/footer customization"
- Change status to "Done" or "Ready for Review"
- Add labels like "customer-facing" or "demo-ready"

**Expected Results:**
- ✅ Console log: `🔔 JIRA issue updated: PROJ-123`
- ✅ Console log: `✅ JIRA issue translated`
- ✅ If demo-ready: Slack notification sent to `#sales` channel
- ✅ Console log: `📤 Sent demo notification to #sales`

### Step 3: Verify the Translation
The `#sales` Slack channel should receive:
```
✅ Demo Ready: PDF Export Feature

What You Can Demo:
• Customizable headers and footers
• Export any report to professional PDF format
• Maintains all formatting and branding

Customer Benefit: Clients can now share reports with stakeholders in professional PDF format
Timeline: Ready today

View in JIRA: PROJ-123
```

---

## Test Scenario 2: Manual Translation Testing (Dev Tools)

### Option A: Using Browser Console
Open DevTools in your HeyJarvis app and run:

```javascript
// List all stored contexts
const result = await window.api.invoke('jira:listStoredContexts');
console.log('Stored contexts:', result.contexts);

// Get context for a specific issue
const context = await window.api.invoke('jira:getContext', 'PROJ-123');
console.log('Context for PROJ-123:', context);

// Manually trigger translation
const translation = await window.api.invoke('jira:translateIssue', 'PROJ-123');
console.log('Translation:', translation);
```

### Option B: Using Node Console (Backend)
If you need to test the services directly:

```bash
cd /Users/jarvis/Code/HeyJarvis
node
```

Then in the Node REPL:
```javascript
const JIRASemanticTranslator = require('./core/intelligence/jira-semantic-translator');
const translator = new JIRASemanticTranslator({ logLevel: 'debug' });

// Test translation with a mock issue
const mockIssue = {
  key: 'TEST-123',
  fields: {
    summary: 'Add PDF export feature',
    description: 'Implemented PDF export with custom headers',
    status: { name: 'Done' },
    labels: ['customer-facing', 'demo-ready']
  }
};

translator.translateIssueUpdate(mockIssue, {
  audiences: ['sales', 'executive']
}).then(result => {
  console.log('Sales translation:', result.translations.sales);
  console.log('Demo ready?', result.demo_ready);
});
```

---

## Test Scenario 3: Testing Context Linking

### Step 1: Create Multiple Tasks
In Slack, create several tasks:
```
1. @dev can you fix the login timeout issue?
2. @dev please add dark mode to the settings page
3. @dev urgent: payment gateway is returning errors
```

### Step 2: Check Stored Contexts
In your app's DevTools:
```javascript
const { contexts, count } = await window.api.invoke('jira:listStoredContexts');
console.log(`Found ${count} stored contexts`);
contexts.forEach(ctx => {
  console.log(`${ctx.issueKey}: "${ctx.message}" from ${ctx.user_name}`);
});
```

**Expected Output:**
```
Found 3 stored contexts
PROJ-124: "can you fix the login timeout issue?" from alice
PROJ-125: "please add dark mode to the settings page" from alice
PROJ-126: "urgent: payment gateway is returning errors" from alice
```

---

## Test Scenario 4: Testing Different Audiences

### Step 1: Create a Customer-Facing Feature
Create and complete a JIRA ticket for a customer-facing feature.

### Step 2: Trigger Translation
```javascript
const translation = await window.api.invoke('jira:translateIssue', 'PROJ-123');

// Check each audience translation
console.log('Sales:', translation.translation.translations.sales.summary);
console.log('Executive:', translation.translation.translations.executive.summary);
console.log('Support:', translation.translation.translations.support.summary);
console.log('Technical:', translation.translation.translations.technical.summary);
```

**Expected Differences:**
- **Sales:** "Now you can demo multi-currency checkout with live exchange rates"
- **Executive:** "Expanded TAM by supporting 15 new currencies, reducing payment friction"
- **Support:** "Customers can now pay in EUR, GBP, JPY with automatic conversion"
- **Technical:** "Implemented currency conversion API with Redis caching for exchange rates"

---

## Debugging Tips

### Enable Debug Logging
Set environment variable:
```bash
NODE_ENV=development npm start
```

### Check Console Logs
Look for these key log messages:
- `✅ JIRA Semantic Translator initialized`
- `✅ Context Linker initialized`
- `✅ JIRA semantic translation enabled`
- `🔗 Context linked for future JIRA translation`
- `🔔 JIRA issue updated: PROJ-123`
- `✅ JIRA issue translated`

### Common Issues

**Issue:** "Context linker not initialized"
**Fix:** Make sure JIRA OAuth is configured and initialized

**Issue:** "JIRA not connected"
**Fix:** Authenticate with JIRA first using the JIRA OAuth flow

**Issue:** "Issue not customer-facing, skipping translation"
**Fix:** Add labels like `customer-facing` or `demo-ready` to your JIRA ticket

**Issue:** No Slack notification sent
**Fix:**
1. Check that issue has `demo-ready` status or similar
2. Verify `#sales` channel exists in Slack
3. Check bot has permission to post in channel

---

## What to Look For

### ✅ Success Indicators
1. Tasks created from Slack have context stored
2. JIRA updates trigger translations
3. Demo-ready features send Slack notifications
4. Translations are audience-appropriate
5. Original Slack context is preserved and used in translations

### ❌ Error Indicators
1. No context stored after task creation
2. JIRA updates don't trigger translations
3. All translations look the same (not audience-specific)
4. Console errors about missing services
5. Slack notifications not sent

---

## Performance Testing

### Memory Usage
Check context storage doesn't grow unbounded:
```javascript
// Should show cleanup happening
const stats = contextLinker.getStats();
console.log('Context stats:', stats);
```

### Translation Speed
Time a translation:
```javascript
console.time('translation');
await window.api.invoke('jira:translateIssue', 'PROJ-123');
console.timeEnd('translation');
// Should be < 3 seconds
```

---

## Real-World Testing Workflow

1. **Morning:** Create 3-5 tasks from Slack messages
2. **Afternoon:** Work on them in JIRA, update status/comments
3. **Evening:** Check `#sales` channel for demo notifications
4. **Weekly:** Verify old contexts are cleaned up (30+ days)

---

## Expected ROI Validation

Track these metrics to validate the $18-20K/year value:

1. **Interruption Reduction**
   - Before: Count "what's the status of X?" Slack messages
   - After: Should drop 60-80% (auto-notifications replace questions)

2. **Demo Preparation Time**
   - Before: 15-30 min researching what's ready to demo
   - After: Instant notifications when features are demo-ready

3. **Translation Quality**
   - Sales should understand updates without asking devs for clarification
   - Executives should see business impact, not technical details

---

## Questions or Issues?

If you encounter problems:
1. Check console logs for error messages
2. Verify all services initialized successfully
3. Test each component independently (context linking, then translation)
4. Check the git status to see if any files were modified unexpectedly
