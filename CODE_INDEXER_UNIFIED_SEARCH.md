# Code Indexer - Unified Search Implementation

## 🎯 Overview

Successfully implemented a **unified search interface** for the Code Indexer that:
- ✅ Automatically links JIRA tickets to GitHub repositories
- ✅ Provides a single, streamlined search experience
- ✅ Integrates with the real GitHub Engineering Intelligence API
- ✅ Displays business-friendly AI-powered code analysis results

---

## 📋 What Changed

### 1. **UI Simplification**

**Before:**
- Duplicate "Search By" dropdown (Repository vs Feature mode)
- Two separate query input sections
- No automatic linking between JIRA and GitHub

**After:**
- Single unified search interface
- Repository selector + optional JIRA ticket selector
- Visual "OR" separator between selectors
- Automatic ticket-to-repo mapping with visual feedback

### 2. **Smart Auto-Linking**

**File:** `desktop2/renderer2/src/pages/Indexer.jsx` (lines 115-149)

```javascript
const linkTicketsToRepos = () => {
  const mapping = new Map();
  
  jiraIssues.forEach(issue => {
    const ticketKey = issue.key;
    const searchText = `${issue.description} ${issue.summary}`.toLowerCase();
    
    // Find matching repository by searching ticket text
    const matchedRepo = repositories.find(repo => {
      const repoName = repo.name.toLowerCase();
      const fullName = repo.full_name.toLowerCase();
      return searchText.includes(repoName) || searchText.includes(fullName);
    });
    
    if (matchedRepo) {
      mapping.set(ticketKey, matchedRepo.full_name);
    } else {
      // Fallback to first repo
      if (repositories.length > 0) {
        mapping.set(ticketKey, repositories[0].full_name);
      }
    }
  });
  
  setTicketRepoMapping(mapping);
};
```

**Triggers:**
- Automatically runs when both JIRA tickets and GitHub repos are loaded
- Re-runs if either list changes

**Mapping Logic:**
1. Scans JIRA ticket description + summary for repo name mentions
2. Matches against available GitHub repositories
3. Creates `Map<ticketKey, repoFullName>` for fast lookups
4. Falls back to first repository if no match found

### 3. **Enhanced Query Function**

**File:** `desktop2/renderer2/src/pages/Indexer.jsx` (lines 151-278)

```javascript
const askQuestion = async () => {
  // Parse owner/repo from selected repo
  const [owner, repo] = selectedRepo.split('/');
  
  // Build context including JIRA ticket info
  const context = {
    ticket: selectedTicket ? {
      key: selectedTicket.key,
      summary: selectedTicket.summary,
      description: selectedTicket.description,
      status: selectedTicket.status?.name,
      priority: selectedTicket.priority?.name
    } : null
  };
  
  // Call Engineering Intelligence API
  const result = await window.electronAPI.codeIndexer.query({
    query,
    repository: { owner, repo },
    context
  });
  
  // Format response with business-friendly sections
  const formattedAnswer = {
    summary: result.data.answer,
    businessImpact: extractBusinessImpact(result.data.answer),
    actionItems: extractActionItems(result.data.answer),
    technicalDetails: {
      repository: `${owner}/${repo}`,
      searchResults: result.data.sources?.length || 0,
      processingTimeMs: result.data.processingTime
    }
  };
};
```

**Key Features:**
- ✅ Includes JIRA ticket context in query (when selected)
- ✅ Calls real Engineering Intelligence API via IPC
- ✅ Extracts business impact from AI responses
- ✅ Parses action items from responses
- ✅ Provides rich technical metadata

### 4. **IPC Integration**

**File:** `desktop2/main/ipc/code-indexer-handlers.js` (lines 19-66)

```javascript
ipcMain.handle('codeIndexer:query', async (event, params) => {
  const { query, repository, context } = params;
  
  // Call Engineering Intelligence API
  const response = await fetch(`${this.API_BASE_URL}/api/engineering/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, repository, context })
  });
  
  const data = await response.json();
  
  return {
    success: true,
    data: data.result
  };
});
```

**API Endpoint:** `http://localhost:3000/api/engineering/query`

**Authentication:** Uses centralized GitHub token from environment
**Rate Limiting:** 10 queries per 15 minutes per user

### 5. **Engineering Intelligence Service**

**File:** `core/intelligence/engineering-intelligence-service.js`

The backend service uses:
- **Code Indexer** - Indexes repository files and creates embeddings
- **Code Query Engine** - Semantic search + Claude AI for answers
- **Repository File Fetcher** - Fetches code from GitHub
- **Vector Store** - Supabase pgvector for semantic search

**Query Flow:**
1. User asks question → Frontend
2. IPC call → Main process
3. HTTP POST → Engineering Intelligence API
4. Query Engine → Vector search + Claude AI
5. Response → Format and display

---

## 🎨 UI Components

### Search Section

**File:** `desktop2/renderer2/src/pages/Indexer.jsx` (lines 385-475)

```jsx
<div className="unified-search-section">
  {/* Repository Selector */}
  <div className="repo-selector-inline">
    <select className="repo-select-compact" value={selectedRepo}>
      <option value="">Select a repository...</option>
      {repositories.map(repo => (
        <option value={repo.full_name}>
          {repo.full_name} {repo.private && '🔒'}
        </option>
      ))}
    </select>
  </div>
  
  {/* OR Separator */}
  <div className="or-separator">
    <div className="or-line"></div>
    <span className="or-text">OR</span>
    <div className="or-line"></div>
  </div>
  
  {/* JIRA Ticket Selector */}
  <div className="ticket-selector-inline">
    <select className="ticket-select-compact" value={selectedFeature}>
      <option value="">None (Search all code)</option>
      {jiraIssues.map(issue => (
        <option value={issue.id}>
          {issue.key} - {issue.summary}
        </option>
      ))}
    </select>
  </div>
  
  {/* Auto-Link Hint */}
  {selectedTicket && ticketRepoMapping.has(selectedTicket.key) && (
    <div className="auto-link-hint">
      Auto-linked to <strong>{ticketRepoMapping.get(selectedTicket.key)}</strong>
    </div>
  )}
</div>
```

### CSS Styling

**File:** `desktop2/renderer2/src/pages/Indexer.css` (lines 272-407)

```css
/* Unified Search Section */
.unified-search-section {
  background: white;
  border-radius: 12px;
  padding: 20px;
  border: 1px solid #e5e7eb;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

/* OR Separator */
.or-separator {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 4px 0;
}

.or-line {
  flex: 1;
  height: 1px;
  background: linear-gradient(90deg, transparent 0%, #e5e7eb 50%, transparent 100%);
}

.or-text {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.1em;
  color: #9ca3af;
}

/* Auto-Link Hint */
.auto-link-hint {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  background: linear-gradient(135deg, #667eea15 0%, #764ba215 100%);
  border-radius: 8px;
  border: 1px solid #667eea30;
}
```

---

## 🔄 User Workflow

### Scenario 1: Search by Repository Only

1. User opens Code Indexer
2. Selects repository from dropdown (e.g., `anthropics/heyjarvis`)
3. Types question: "How does authentication work?"
4. Clicks "Analyze"
5. AI analyzes entire codebase and returns answer

### Scenario 2: Search by JIRA Ticket

1. User opens Code Indexer
2. Sees JIRA tickets listed (if JIRA connected)
3. Selects ticket from dropdown (e.g., `PROJ-123 - Add OAuth support`)
4. System auto-selects linked repository
5. Query is pre-filled: "Explain the implementation of Add OAuth support in detail"
6. User clicks "Analyze" or modifies query
7. AI analyzes codebase with JIRA context

### Scenario 3: Manual Override

1. User selects JIRA ticket (auto-links to Repo A)
2. User manually changes repository to Repo B
3. AI analyzes Repo B for the JIRA ticket's feature
4. Useful when ticket spans multiple repositories

---

## 📊 Benefits

### For Developers
- ✅ **Faster onboarding** - Ask questions about unfamiliar codebases
- ✅ **JIRA integration** - Understand code related to your tickets
- ✅ **Smart defaults** - Auto-linked repos save time
- ✅ **Rich results** - Business impact + action items + technical details

### For Sales
- ✅ **Business-friendly answers** - No need to read code
- ✅ **Feature discovery** - "What integrations do we support?"
- ✅ **Customer questions** - "Can we do X?" answered from code

### For Product
- ✅ **Feature inventory** - Know what exists in codebase
- ✅ **Tech debt visibility** - Ask about patterns and complexity
- ✅ **Impact analysis** - Understand code implications

---

## 🛠️ Technical Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend (React)                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │ Repo Selector│  │ JIRA Selector│  │ Query Input  │     │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘     │
│         │                  │                  │             │
│         └──────────────────┴──────────────────┘             │
│                            │                                │
│                      askQuestion()                          │
│                            │                                │
└────────────────────────────┼────────────────────────────────┘
                             │ window.electronAPI.codeIndexer.query()
                             ▼
┌─────────────────────────────────────────────────────────────┐
│              Main Process (Electron IPC)                    │
│  ┌──────────────────────────────────────────────────────┐  │
│  │         code-indexer-handlers.js                     │  │
│  │  ipcMain.handle('codeIndexer:query', ...)           │  │
│  └────────────────────────┬─────────────────────────────┘  │
└────────────────────────────┼────────────────────────────────┘
                             │ HTTP POST
                             ▼
┌─────────────────────────────────────────────────────────────┐
│        Engineering Intelligence API (Express)               │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  /api/engineering/query                              │  │
│  │  - Authentication                                    │  │
│  │  - Rate limiting (10/15min)                          │  │
│  │  - Audit logging                                     │  │
│  └────────────────────────┬─────────────────────────────┘  │
└────────────────────────────┼────────────────────────────────┘
                             │ service.queryCodebase()
                             ▼
┌─────────────────────────────────────────────────────────────┐
│       Engineering Intelligence Service (Core)               │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Code Query Engine                                   │  │
│  │  ├─ Vector Search (Supabase pgvector)               │  │
│  │  ├─ Semantic Embeddings (OpenAI)                    │  │
│  │  └─ AI Analysis (Claude 3.5 Sonnet)                 │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔐 Security & Performance

### Authentication
- ✅ **Centralized GitHub token** - Users don't manage tokens
- ✅ **User authentication** - Must be logged in to use
- ✅ **Audit logging** - All queries are logged

### Rate Limiting
- **10 queries per 15 minutes** per user
- Prevents API quota exhaustion
- Protects against abuse

### Performance
- **Vector search** - Fast semantic search via pgvector
- **Caching** - Repository embeddings cached in Supabase
- **Progressive loading** - UI stays responsive during queries

---

## 🚀 Setup Requirements

### Environment Variables

```bash
# GitHub Access
GITHUB_TOKEN=ghp_xxxxxxxxxxxxx

# Engineering Intelligence API
API_BASE_URL=http://localhost:3000

# OpenAI (for embeddings)
OPENAI_API_KEY=sk-xxxxxxxxxxxxx

# Anthropic (for AI analysis)
ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxxx

# Supabase (for vector storage)
SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
SUPABASE_ANON_KEY=xxxxxxxxxxxxx
```

### Database Setup

**Table:** `code_chunks` (in Supabase)

```sql
CREATE TABLE code_chunks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  repository_owner TEXT NOT NULL,
  repository_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  chunk_content TEXT NOT NULL,
  chunk_type TEXT,
  chunk_name TEXT,
  file_language TEXT,
  embedding VECTOR(1536),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Vector similarity index
CREATE INDEX ON code_chunks USING ivfflat (embedding vector_cosine_ops);
```

### Starting the Services

```bash
# 1. Start Engineering Intelligence API
cd /path/to/HeyJarvis
node api/server.js

# 2. Start Desktop App (in another terminal)
cd desktop2
npm run dev
```

---

## 📝 Testing Checklist

- ✅ Load repositories from GitHub
- ✅ Load JIRA tickets (if connected)
- ✅ Auto-link tickets to repos
- ✅ Visual "OR" separator displays
- ✅ Auto-link hint shows when ticket selected
- ✅ Query with repository only
- ✅ Query with JIRA ticket (auto-linked repo)
- ✅ Manual repository override works
- ✅ Business impact extracted from responses
- ✅ Action items parsed from responses
- ✅ Technical details displayed
- ✅ Error handling for failed queries
- ✅ Loading states display correctly

---

## 🎯 Next Steps

### Phase 1: Enhancements (Optional)
- [ ] **Repository indexing UI** - Show which repos are indexed
- [ ] **Search history** - Save and recall previous queries
- [ ] **Export results** - Download answers as markdown/PDF
- [ ] **Multi-repo search** - Search across multiple repos at once

### Phase 2: Advanced Features (Future)
- [ ] **Code-to-ticket matching** - Find commits related to JIRA ticket
- [ ] **PR analysis** - Analyze pull requests for complexity/risk
- [ ] **Estimation accuracy** - Compare story points vs actual time
- [ ] **Developer velocity** - Track velocity per developer/sprint

---

## 📚 Documentation Links

- **Engineering Intelligence Setup:** `ENGINEERING_INTELLIGENCE_SETUP.md`
- **Code Indexer Implementation:** `CODE_INDEXER_IMPLEMENTATION_SUMMARY.md`
- **JIRA Integration Guide:** `JIRA_INTEGRATION_SUMMARY.md`
- **API Documentation:** `api/engineering/README.md`

---

**Last Updated:** $(date +"%Y-%m-%d")
**Author:** Claude + Jarvis
**Version:** 1.0.0
