# Task Chat - JIRA & Confluence Only Integration

## 🎯 Overview

Updated the Task Chat system to **ONLY** pull context from JIRA and Confluence, removing all Slack and CRM integrations from the chat context.

---

## ✅ Changes Made

### File Modified
- **`desktop2/main/ipc/task-chat-handlers.js`**

### What Was Removed
1. ❌ **Slack Integration** (lines 247-276)
   - Removed `services.slack.getRecentMessages()`
   - Removed `services.slack.getUserMentions()`
   - Removed Slack context from AI prompts

2. ❌ **CRM Integration** (lines 278-288)
   - Removed `services.crm.getData()`
   - Removed CRM insights and recommendations
   - Removed CRM context from AI prompts

### What Was Added
1. ✅ **JIRA Integration** (lines 247-323)
   - Fetches specific JIRA issue details if task has a JIRA key
   - Gets user's recent JIRA issues if no specific key
   - Includes:
     - Issue summary, status, priority
     - Assignee and reporter
     - Story points and labels
     - Issue description
     - **Last 5 JIRA comments** (team discussions!)
   
2. ✅ **Confluence Integration** (lines 325-386)
   - Searches for relevant documentation based on task title
   - Returns up to 3 relevant Confluence pages
   - Includes:
     - Page title and excerpt
     - Page URL (clickable link)
     - Last modified date

---

## 🔄 Data Flow

### Before (Multi-Source)
```
Task Chat Request
  ↓
Fetch Slack Messages ❌
  ↓
Fetch CRM Data ❌
  ↓
Fetch GitHub Code (still enabled ✅)
  ↓
Build AI Context
  ↓
Generate Response
```

### After (JIRA/Confluence Only)
```
Task Chat Request
  ↓
Fetch JIRA Issue Details ✅
  ├─ Issue metadata
  ├─ Description
  └─ Last 5 comments
  ↓
Search Confluence Docs ✅
  └─ Up to 3 relevant pages
  ↓
Fetch GitHub Code (still enabled ✅)
  ↓
Build AI Context
  ↓
Generate Response
```

---

## 📋 Context Provided to AI

### JIRA Context
When a task has a JIRA key (e.g., `PROJ-123`):

```
🎫 JIRA ISSUE CONTEXT (PROJ-123):
- Summary: Implement user authentication
- Status: In Progress
- Priority: High
- Assignee: John Doe
- Reporter: Jane Smith
- Story Points: 8
- Labels: backend, security
- Description: We need to implement OAuth 2.0...

💬 Recent JIRA Comments (3):
- [John Doe] I've started working on the OAuth flow...
- [Jane Smith] Make sure to handle token refresh...
- [Tech Lead] Consider using PKCE for security...
```

When no JIRA key (shows recent issues):

```
🎫 YOUR RECENT JIRA ISSUES (5):
- [PROJ-123] Implement user authentication - In Progress (High)
- [PROJ-124] Fix login bug - To Do (Medium)
- [PROJ-125] Add password reset - Code Review (High)
...
```

### Confluence Context
```
📚 RELEVANT CONFLUENCE DOCUMENTATION (3 pages):

**Authentication Architecture**
This document describes our OAuth 2.0 implementation...
🔗 https://yourcompany.atlassian.net/wiki/spaces/ENG/pages/123456
📅 Last updated: 11/8/2025

**Security Best Practices**
Guidelines for implementing secure authentication...
🔗 https://yourcompany.atlassian.net/wiki/spaces/ENG/pages/789012
📅 Last updated: 11/1/2025

**API Integration Guide**
How to integrate with our authentication API...
🔗 https://yourcompany.atlassian.net/wiki/spaces/ENG/pages/345678
📅 Last updated: 10/15/2025

You can reference these Confluence pages when providing guidance.
```

---

## 🎨 Updated AI Instructions

### System Prompt Changes

**Before:**
```
- Offering relevant insights from live Slack/CRM data
- Mark 2-3 requirements as coming from "Slack"
- Include a mix of sources: Slack, JIRA, and Inferred
```

**After:**
```
- Offering relevant insights from JIRA issues and Confluence documentation
- Mark 2-3 requirements as coming from "JIRA Comments"
- Include a mix of sources: JIRA, Confluence, and Inferred
```

### Product Requirements Generation

When user asks to generate requirements, the AI now:
1. Creates structured table with columns: Requirement | Priority | Source | Status
2. Marks 2-3 requirements as **"JIRA Comments"** (highlighted in red)
3. Uses sources: **JIRA Comments**, **Confluence**, **Inferred**
4. References actual JIRA comments and Confluence docs in the context

---

## 🔑 Key Features

### 1. **Automatic JIRA Issue Detection**
- If task has `external_key` (e.g., "PROJ-123"), fetches full issue details
- If no key, shows user's 5 most recent issues
- Works with user's OAuth tokens (no additional auth needed)

### 2. **Smart Confluence Search**
- Uses task title to search relevant documentation
- Returns top 3 most relevant pages
- Provides excerpts and clickable links
- Shows last modified date for freshness

### 3. **JIRA Comments Integration**
- Fetches last 5 comments on the issue
- Shows author and comment body
- Provides team discussion context
- AI can reference these in responses

### 4. **GitHub Code Still Available**
- Code indexer integration unchanged
- Still queries repository when connected
- Provides code context alongside JIRA/Confluence

---

## 🚀 How It Works

### For JIRA Tasks

1. User opens a JIRA task (e.g., `PROJ-123`)
2. Task chat fetches:
   - Full issue details from JIRA API
   - Last 5 comments
   - Related Confluence pages
3. AI receives all context
4. User asks questions, AI responds with JIRA/Confluence-aware answers

**Example Conversation:**
```
User: "What are the requirements for this task?"

AI: Based on the JIRA issue PROJ-123 and related Confluence documentation:

Requirements:
1. Implement OAuth 2.0 flow (High priority) - from JIRA Comments
2. Add token refresh mechanism (High) - from JIRA Comments
3. Support PKCE for security (Medium) - from Confluence: "Security Best Practices"
4. Handle error cases (Medium) - Inferred
5. Write unit tests (Low) - from JIRA Comments

The team discussion in JIRA comments emphasizes security (PKCE) and 
token management. See the "Authentication Architecture" doc in Confluence
for implementation details.
```

### For Non-JIRA Tasks

1. User opens a generic task
2. Task chat fetches:
   - User's 5 recent JIRA issues (for context)
   - Confluence pages matching task title
3. AI provides general guidance with team context

---

## 🔧 Technical Implementation

### JIRA Service Integration

```javascript
// Initialize JIRA service with user's tokens
const JIRAService = require('../../../core/integrations/jira-service');
const jiraService = new JIRAService({ logger, supabaseAdapter: dbAdapter });

const initResult = await jiraService.initialize(userId);

if (initResult.connected) {
  // Get specific issue
  const issueResult = await jiraService.getIssueDetails(taskJiraKey);
  
  // Extract relevant data
  aiContext.jiraData = {
    connected: true,
    currentIssue: {
      key: issueResult.issue.key,
      summary: issueResult.issue.fields.summary,
      description: issueResult.issue.fields.description,
      status: issueResult.issue.fields.status.name,
      priority: issueResult.issue.fields.priority?.name,
      assignee: issueResult.issue.fields.assignee?.displayName,
      comments: issueResult.issue.fields.comment?.comments?.slice(-5) || []
    }
  };
}
```

### Confluence Service Integration

```javascript
// Initialize Confluence service (uses JIRA OAuth tokens)
const ConfluenceService = require('../../../core/integrations/confluence-service');
const confluenceService = new ConfluenceService({ logger });

// Get user's JIRA tokens from Supabase
const { data: userData } = await dbAdapter.supabase
  .from('users')
  .select('integration_settings')
  .eq('id', userId)
  .single();

const jiraSettings = userData?.integration_settings?.jira;

// Set tokens (Confluence uses same OAuth as JIRA)
confluenceService.setTokens({
  accessToken: jiraSettings.access_token,
  cloudId: jiraSettings.cloud_id,
  siteUrl: jiraSettings.site_url
});

// Search for relevant pages
const searchResult = await confluenceService.searchPages({
  query: task.title.substring(0, 50),
  limit: 3
});

// Extract page data
aiContext.confluenceData = {
  connected: true,
  relevantPages: searchResult.pages.map(page => ({
    id: page.id,
    title: page.title,
    excerpt: page.excerpt || page.body?.substring(0, 200),
    url: `${jiraSettings.site_url}${page._links.webui}`,
    lastModified: page.version?.when
  }))
};
```

---

## ✅ Benefits

### 1. **Simplified Architecture**
- Removed 2 integration dependencies (Slack, CRM)
- Single source of truth: Atlassian (JIRA + Confluence)
- Easier to maintain and debug

### 2. **Better Context**
- JIRA comments provide actual team discussions
- Confluence docs provide official documentation
- More relevant than generic Slack messages

### 3. **Unified Authentication**
- JIRA and Confluence use same OAuth tokens
- No additional authentication needed
- Seamless integration

### 4. **Focused Information**
- Task-specific JIRA issue details
- Relevant documentation only
- No noise from unrelated Slack channels

---

## 🧪 Testing

### Test Scenarios

1. **JIRA Task with Comments**
   - Open task with JIRA key (e.g., PROJ-123)
   - Verify JIRA issue details appear in context
   - Verify last 5 comments are included
   - Ask AI about requirements → should reference comments

2. **JIRA Task with Confluence Docs**
   - Open task with title matching Confluence pages
   - Verify relevant pages are found
   - Verify page excerpts and URLs are shown
   - Ask AI about implementation → should reference docs

3. **Generic Task (No JIRA Key)**
   - Open task without JIRA key
   - Verify user's recent JIRA issues are shown
   - Verify Confluence search still works
   - AI should provide general guidance

4. **No JIRA Connected**
   - User hasn't connected JIRA
   - Task chat should work without errors
   - AI provides guidance without JIRA/Confluence context

---

## 📊 Context Comparison

### Before (Slack + CRM)
```json
{
  "taskContext": { ... },
  "slackData": {
    "connected": true,
    "recentMessages": [ ... ],  // Last 10 Slack messages
    "mentions": [ ... ]          // User mentions
  },
  "crmData": {
    "insights": [ ... ],         // CRM insights
    "recommendations": [ ... ]   // CRM recommendations
  }
}
```

### After (JIRA + Confluence)
```json
{
  "taskContext": { ... },
  "jiraData": {
    "connected": true,
    "currentIssue": {
      "key": "PROJ-123",
      "summary": "...",
      "description": "...",
      "status": "In Progress",
      "priority": "High",
      "assignee": "John Doe",
      "reporter": "Jane Smith",
      "storyPoints": 8,
      "labels": ["backend", "security"],
      "comments": [
        { "author": "...", "body": "..." },
        { "author": "...", "body": "..." }
      ]
    }
  },
  "confluenceData": {
    "connected": true,
    "relevantPages": [
      {
        "title": "Authentication Architecture",
        "excerpt": "...",
        "url": "https://...",
        "lastModified": "2025-11-08"
      }
    ]
  }
}
```

---

## 🔮 Future Enhancements

### Potential Additions

1. **JIRA Issue Links**
   - Fetch linked issues (blocks, depends on)
   - Show dependency graph
   - Warn about blockers

2. **Confluence Page Hierarchy**
   - Show parent/child pages
   - Navigate documentation tree
   - Find related pages

3. **JIRA Sprint Context**
   - Show sprint goals
   - Display sprint burndown
   - Team velocity metrics

4. **Confluence Attachments**
   - Access diagrams and images
   - Download design files
   - Reference technical specs

5. **JIRA Worklog**
   - Show time spent on issue
   - Display work estimates
   - Track progress

---

## 📝 Migration Notes

### For Users

**No action required!** The change is transparent:
- Task chat continues to work the same way
- JIRA tasks get better context automatically
- Confluence docs are searched automatically

### For Developers

**What changed:**
- Removed `services.slack` calls in task chat
- Removed `services.crm` calls in task chat
- Added `JIRAService` initialization
- Added `ConfluenceService` initialization
- Updated AI system prompts

**What stayed the same:**
- GitHub code indexer integration
- Task chat UI/UX
- Message persistence
- Session management

---

## 🎯 Summary

✅ **Removed:** Slack and CRM integrations from task chat  
✅ **Added:** JIRA issue details and Confluence documentation  
✅ **Improved:** More relevant, focused context for AI  
✅ **Simplified:** Single authentication (Atlassian OAuth)  
✅ **Enhanced:** Team discussions via JIRA comments  

**Result:** Task chat now provides better, more relevant context from JIRA and Confluence instead of generic Slack/CRM data.

---

**Modified:** November 9, 2025  
**File:** `desktop2/main/ipc/task-chat-handlers.js`  
**Status:** ✅ Complete and ready to test

