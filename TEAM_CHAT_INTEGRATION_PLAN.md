# Team Context Chat Integration Plan
## From extra_feature_desktop → desktop2

---

## 🎯 Executive Summary

**Goal:** Integrate the team context chat system from `extra_feature_desktop` into `desktop2` to enable AI-powered team collaboration with JIRA, Meetings, and Code context.

**Approach:** **Hybrid** - Port the frontend completely, but **adapt** backend to use desktop2's existing architecture (don't duplicate services).

**Complexity:** Medium (3-5 days)
- ✅ Frontend is standalone and can be copied
- ⚠️ Backend needs adaptation to desktop2 patterns
- ⚠️ Database schema needs migration

---

## 📊 Architecture Comparison

| Aspect | extra_feature_desktop | desktop2 | Integration Strategy |
|--------|----------------------|----------|---------------------|
| **Frontend** | React 18 + Vite | React 18 + Vite | ✅ Copy directly |
| **Chat Sessions** | localStorage | Supabase (conversation_sessions) | ✅ Use desktop2's DB approach |
| **Context Engine** | TeamContextEngine | AIService + context building | ⚠️ Port core logic, adapt to desktop2 services |
| **Team Management** | Full team CRUD | Basic team support exists | ⚠️ Enhance existing |
| **Database** | team_meetings, team_updates | conversation_sessions, conversation_messages | ⚠️ Add tables + enhance |
| **IPC Patterns** | Function exports | Module exports with services | ✅ Follow desktop2 pattern |

---

## 🏗️ Integration Plan (5 Phases)

### **Phase 1: Database Schema Migration** ⏱️ 2 hours

#### **What to Add:**

1. **New Tables** (from extra_feature_desktop):
```sql
-- Run these migrations in order:

-- 1. Team tables
CREATE TABLE app_teams (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE GENERATED ALWAYS AS (lower(regexp_replace(name, '[^a-zA-Z0-9]+', '-', 'g'))) STORED,
  description TEXT,
  timezone TEXT DEFAULT 'America/New_York',
  color TEXT DEFAULT '#3b82f6',
  working_hours_start TIME DEFAULT '09:00',
  working_hours_end TIME DEFAULT '17:00',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE app_team_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID NOT NULL REFERENCES app_teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member' CHECK (role IN ('lead', 'member', 'viewer')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(team_id, user_id)
);

CREATE TABLE app_team_repositories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID NOT NULL REFERENCES app_teams(id) ON DELETE CASCADE,
  repository_owner TEXT NOT NULL,
  repository_name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(team_id, repository_owner, repository_name)
);

-- 2. Team data tables (from extra_feature)
CREATE TABLE team_meetings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  meeting_id TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ,
  attendees JSONB DEFAULT '[]',
  is_important BOOLEAN DEFAULT false,
  copilot_notes TEXT,
  manual_notes TEXT,
  ai_summary TEXT,
  key_decisions JSONB DEFAULT '[]',
  action_items JSONB DEFAULT '[]',
  topics JSONB DEFAULT '[]',
  metadata JSONB DEFAULT '{}',
  app_team_id UUID REFERENCES app_teams(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE team_updates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  update_type TEXT NOT NULL CHECK (update_type IN ('jira_issue', 'github_pr', 'github_commit')),
  external_id TEXT UNIQUE NOT NULL,
  external_key TEXT,
  title TEXT NOT NULL,
  description TEXT,
  content_text TEXT,  -- For search indexing
  author TEXT,
  status TEXT,
  linked_meeting_id UUID REFERENCES team_meetings(id),
  linked_jira_key TEXT,
  metadata JSONB DEFAULT '{}',
  app_team_id UUID REFERENCES app_teams(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Indexes
CREATE INDEX idx_app_teams_name ON app_teams(name);
CREATE INDEX idx_app_teams_slug ON app_teams(slug);
CREATE INDEX idx_app_team_members_team_id ON app_team_members(team_id);
CREATE INDEX idx_app_team_members_user_id ON app_team_members(user_id);
CREATE INDEX idx_app_team_repositories_team_id ON app_team_repositories(team_id);
CREATE INDEX idx_team_meetings_user_id ON team_meetings(user_id);
CREATE INDEX idx_team_meetings_app_team_id ON team_meetings(app_team_id);
CREATE INDEX idx_team_meetings_start_time ON team_meetings(start_time);
CREATE INDEX idx_team_updates_user_id ON team_updates(user_id);
CREATE INDEX idx_team_updates_app_team_id ON team_updates(app_team_id);
CREATE INDEX idx_team_updates_type ON team_updates(update_type);
CREATE INDEX idx_team_updates_external_id ON team_updates(external_id);
```

2. **Enhance existing conversation_sessions** (already compatible):
```sql
-- No changes needed! The existing schema already supports team chat:
-- workflow_type: 'team_chat'
-- workflow_id: 'team_<teamId>'
-- workflow_metadata: { team_id, team_name, ... }
```

**Files to Create:**
- `/Users/jarvis/Code/HeyJarvis/data/storage/team-chat-schema.sql` (combined migration)

---

### **Phase 2: Backend Services** ⏱️ 4 hours

#### **2A. Adapt TeamContextEngine → TeamChatService**

**Don't copy verbatim** - adapt to desktop2 patterns:

**New File:** `/Users/jarvis/Code/HeyJarvis/desktop2/main/services/TeamChatService.js`

```javascript
/**
 * Team Chat Service
 * Provides team-context AI chat functionality
 * Adapted from extra_feature_desktop TeamContextEngine
 */

const Anthropic = require('@anthropic-ai/sdk');

class TeamChatService {
  constructor(options = {}) {
    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY
    });
    this.model = options.model || 'claude-3-5-sonnet-20241022';
    this.supabaseAdapter = options.supabaseAdapter;
    this.codeIndexer = options.codeIndexer; // Optional
    this.logger = options.logger || console;
  }

  /**
   * Ask a question with team context
   * @param {string} userId - User asking
   * @param {string} question - Question to ask
   * @param {object} options - { contextFilter?, teamId? }
   * @returns {Promise<{success, answer, context_used}>}
   */
  async askQuestion(userId, question, options = {}) {
    try {
      const { contextFilter, teamId, codeContext } = options;

      // 1. Fetch team meetings (filtered by IDs if provided)
      let meetings = [];
      if (contextFilter?.meetingIds && contextFilter.meetingIds.length > 0) {
        const { data } = await this.supabaseAdapter.supabase
          .from('team_meetings')
          .select('*')
          .in('id', contextFilter.meetingIds)
          .order('start_time', { ascending: false });
        meetings = data || [];
      }

      // 2. Fetch team updates (JIRA tasks, filtered if provided)
      let tasks = [];
      if (contextFilter?.taskIds && contextFilter.taskIds.length > 0) {
        const { data } = await this.supabaseAdapter.supabase
          .from('team_updates')
          .select('*')
          .in('id', contextFilter.taskIds)
          .eq('update_type', 'jira_issue')
          .order('created_at', { ascending: false });
        tasks = data || [];
      }

      // 3. Build context string
      const contextString = this._buildContext(meetings, tasks, codeContext);

      // 4. Generate answer with Claude
      const answer = await this._generateAnswer(question, contextString);

      // 5. Return result
      return {
        success: true,
        answer,
        context_used: {
          meetings: meetings.length,
          jira: tasks.length,
          github: 0,
          codeChunks: codeContext?.sources?.length || 0
        }
      };
    } catch (error) {
      this.logger.error('Team chat question failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Build context string from meetings and tasks
   */
  _buildContext(meetings, tasks, codeContext) {
    let context = '';

    // Add meetings
    if (meetings.length > 0) {
      context += '## Recent Meetings\n\n';
      meetings.forEach(m => {
        context += `### ${m.title} (${new Date(m.start_time).toLocaleDateString()})\n`;
        if (m.ai_summary) {
          context += `Summary: ${m.ai_summary}\n`;
        }
        if (m.key_decisions && m.key_decisions.length > 0) {
          context += `Decisions: ${m.key_decisions.join(', ')}\n`;
        }
        context += '\n';
      });
    }

    // Add JIRA tasks
    if (tasks.length > 0) {
      context += '## JIRA Tasks\n\n';
      tasks.forEach(t => {
        context += `### ${t.external_key || t.title}\n`;
        context += `Status: ${t.status}\n`;
        if (t.description) {
          context += `Description: ${t.description}\n`;
        }
        context += '\n';
      });
    }

    // Add code context
    if (codeContext?.answer) {
      context += '## Codebase Information\n\n';
      context += codeContext.answer + '\n\n';
    }

    return context || 'No context available.';
  }

  /**
   * Generate AI answer using Claude
   */
  async _generateAnswer(question, context) {
    const systemPrompt = `You are HeyJarvis, an AI assistant helping teams collaborate.
You have access to team context including meetings, JIRA tasks, and code.

IMPORTANT:
- Only answer based on the provided context
- If you don't have enough information, say so
- Cite specific meetings or tasks when referencing information
- Be concise but thorough

Context:
${context}`;

    const response = await this.anthropic.messages.create({
      model: this.model,
      max_tokens: 2048,
      temperature: 0.7,
      system: systemPrompt,
      messages: [{
        role: 'user',
        content: question
      }]
    });

    return response.content[0].text;
  }
}

module.exports = TeamChatService;
```

**Key Adaptations:**
- ✅ Uses desktop2's logger pattern
- ✅ Accepts supabaseAdapter instead of creating own
- ✅ Simplified to match desktop2 service style
- ✅ Returns standard `{success, data/error}` format
- ⚠️ Remove team-specific query (use teamId filtering in handler instead)

#### **2B. Enhance SupabaseAdapter**

**File:** `/Users/jarvis/Code/HeyJarvis/desktop2/main/services/SupabaseAdapter.js`

Add these methods:

```javascript
/**
 * Team Management Methods
 */

async createTeam(teamData) {
  try {
    const { data, error } = await this.supabase
      .from('app_teams')
      .insert([teamData])
      .select()
      .single();

    if (error) throw error;
    return { success: true, team: data };
  } catch (error) {
    this.logger.error('Failed to create team:', error);
    return { success: false, error: error.message };
  }
}

async getTeams(userId) {
  try {
    const { data, error } = await this.supabase
      .from('app_team_members')
      .select('team_id, role, app_teams(*)')
      .eq('user_id', userId);

    if (error) throw error;

    const teams = data.map(m => ({
      ...m.app_teams,
      user_role: m.role
    }));

    return { success: true, teams };
  } catch (error) {
    this.logger.error('Failed to get teams:', error);
    return { success: false, error: error.message };
  }
}

async getTeamContext(teamId) {
  try {
    // Get team meetings
    const { data: meetings } = await this.supabase
      .from('team_meetings')
      .select('*')
      .eq('app_team_id', teamId)
      .order('start_time', { ascending: false })
      .limit(50);

    // Get team tasks
    const { data: tasks } = await this.supabase
      .from('team_updates')
      .select('*')
      .eq('app_team_id', teamId)
      .eq('update_type', 'jira_issue')
      .order('created_at', { ascending: false })
      .limit(50);

    // Get team repositories
    const { data: repositories } = await this.supabase
      .from('app_team_repositories')
      .select('*')
      .eq('team_id', teamId);

    return {
      success: true,
      meetings: meetings || [],
      tasks: tasks || [],
      repositories: repositories || []
    };
  } catch (error) {
    this.logger.error('Failed to get team context:', error);
    return { success: false, error: error.message };
  }
}

// ... add more team methods as needed (assignMeeting, assignTask, etc.)
```

---

### **Phase 3: IPC Handlers** ⏱️ 3 hours

#### **3A. Create team-chat-handlers.js**

**File:** `/Users/jarvis/Code/HeyJarvis/desktop2/main/ipc/team-chat-handlers.js`

```javascript
const { ipcMain } = require('electron');

function registerTeamChatHandlers(services, logger) {
  const { dbAdapter, auth, teamChatService } = services;

  /**
   * Send message to team chat
   */
  ipcMain.handle('teamChat:send', async (event, teamId, message, options = {}) => {
    try {
      const userId = auth?.currentUser?.id;

      if (!userId) {
        return { success: false, error: 'User not authenticated' };
      }

      // Verify team membership
      const { data: membership } = await dbAdapter.supabase
        .from('app_team_members')
        .select('role')
        .eq('team_id', teamId)
        .eq('user_id', userId)
        .single();

      if (!membership) {
        return { success: false, error: 'Not a team member' };
      }

      logger.info('Team chat message received', { teamId, userId });

      // Get or create team chat session
      const sessionResult = await dbAdapter.getOrCreateActiveSession(userId, {
        workflow_type: 'team_chat',
        workflow_id: `team_${teamId}`,
        team_id: teamId,
        session_title: `Team Chat: ${teamId}`
      });

      const sessionId = sessionResult.session.id;

      // Ask question with context
      const result = await teamChatService.askQuestion(userId, message, {
        teamId,
        contextFilter: options.contextFilter,
        codeContext: options.codeContext
      });

      if (!result.success) {
        throw new Error(result.error);
      }

      // Save messages to session
      await dbAdapter.saveMessageToSession(sessionId, message, 'user', {
        team_id: teamId,
        context_filter: options.contextFilter
      }, userId);

      await dbAdapter.saveMessageToSession(sessionId, result.answer, 'assistant', {
        team_id: teamId,
        context_used: result.context_used
      }, userId);

      logger.info('Team chat response generated', { sessionId, teamId });

      return {
        success: true,
        message: result.answer,
        context_used: result.context_used
      };

    } catch (error) {
      logger.error('Team chat error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });

  /**
   * Get team chat history
   */
  ipcMain.handle('teamChat:getHistory', async (event, teamId) => {
    try {
      const userId = auth?.currentUser?.id;

      if (!userId) {
        return { success: true, messages: [] };
      }

      // Get session
      const { data: session } = await dbAdapter.supabase
        .from('conversation_sessions')
        .select('id')
        .eq('user_id', userId)
        .eq('workflow_type', 'team_chat')
        .eq('workflow_id', `team_${teamId}`)
        .single();

      if (!session) {
        return { success: true, messages: [] };
      }

      // Get messages
      const historyResult = await dbAdapter.getSessionMessages(session.id);

      if (historyResult.success) {
        return {
          success: true,
          messages: historyResult.messages.map(msg => ({
            role: msg.role,
            content: msg.message_text,
            timestamp: msg.created_at,
            metadata: msg.metadata
          }))
        };
      }

      return { success: true, messages: [] };
    } catch (error) {
      logger.error('Failed to get team chat history:', error);
      return { success: false, error: error.message };
    }
  });

  /**
   * Get available context (meetings, tasks for picker)
   */
  ipcMain.handle('teamChat:getAvailableContext', async (event, teamId) => {
    try {
      const context = await dbAdapter.getTeamContext(teamId);
      return context;
    } catch (error) {
      logger.error('Failed to get team context:', error);
      return { success: false, error: error.message };
    }
  });

  logger.info('✅ Team chat handlers registered');
}

module.exports = registerTeamChatHandlers;
```

#### **3B. Register Handler in main/index.js**

```javascript
// Add import
const registerTeamChatHandlers = require('./ipc/team-chat-handlers');
const TeamChatService = require('./services/TeamChatService');

// Initialize service (around line 50-60)
const teamChatService = new TeamChatService({
  supabaseAdapter: supabaseAdapter,
  logger: logger
});

// Add to services object
const services = {
  ai: aiService,
  slack: slackService,
  // ... existing services ...
  teamChatService: teamChatService
};

// Register handlers (around line 80-90)
registerTeamChatHandlers(services, logger);
```

---

### **Phase 4: Frontend Components** ⏱️ 6 hours

#### **4A. Copy Components**

**Source:** `/Users/jarvis/Code/HeyJarvis/extra_feature_desktop/renderer/src/pages/TeamChat.jsx`
**Destination:** `/Users/jarvis/Code/HeyJarvis/desktop2/renderer2/src/pages/TeamChat.jsx`

**Required Adaptations:**
1. Change IPC calls from `window.electronAPI.intelligence.ask()` to `window.electronAPI.teamChat.send()`
2. Replace localStorage sessions with Supabase-backed sessions
3. Update team selection to use desktop2's team management
4. Adapt styling to match desktop2 theme

**Key Changes:**
```javascript
// BEFORE (extra_feature)
const response = await window.electronAPI.intelligence.ask(userId, currentMessage, {
  contextFilter: {
    meetingIds: selectedContext.meetings.map(m => m.id),
    taskIds: selectedContext.tasks.map(t => t.id)
  }
});

// AFTER (desktop2)
const response = await window.electronAPI.teamChat.send(teamId, currentMessage, {
  contextFilter: {
    meetingIds: selectedContext.meetings.map(m => m.id),
    taskIds: selectedContext.tasks.map(t => t.id)
  }
});
```

**Component Structure:**
```jsx
/pages/TeamChat.jsx       - Main page with sidebar + context picker
/components/TeamChat/
  ├── TeamChatSidebar.jsx    - Session list
  ├── TeamContextPicker.jsx  - Meeting/task/repo selector
  ├── TeamChatMessages.jsx   - Message list
  └── TeamChatInput.jsx      - Input box
```

#### **4B. Create Custom Hook**

**File:** `/Users/jarvis/Code/HeyJarvis/desktop2/renderer2/src/hooks/useTeamChat.js`

```javascript
import { useState, useCallback, useEffect } from 'react';

export function useTeamChat(teamId) {
  const [messages, setMessages] = useState([]);
  const [isTyping, setIsTyping] = useState(false);
  const [error, setError] = useState(null);

  // Load history on mount
  useEffect(() => {
    if (teamId) {
      loadHistory();
    }
  }, [teamId]);

  const loadHistory = useCallback(async () => {
    try {
      const response = await window.electronAPI.teamChat.getHistory(teamId);
      if (response.success && response.messages) {
        setMessages(response.messages);
      }
    } catch (err) {
      console.error('Load history error:', err);
      setError(err.message);
    }
  }, [teamId]);

  const sendMessage = useCallback(async (content, options = {}) => {
    if (!content.trim()) return;

    const userMessage = {
      role: 'user',
      content,
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMessage]);
    setIsTyping(true);
    setError(null);

    try {
      const response = await window.electronAPI.teamChat.send(teamId, content, options);

      if (response.success) {
        const assistantMessage = {
          role: 'assistant',
          content: response.message,
          timestamp: new Date().toISOString(),
          metadata: { context_used: response.context_used }
        };
        setMessages(prev => [...prev, assistantMessage]);
      } else {
        throw new Error(response.error || 'Failed to send message');
      }
    } catch (err) {
      console.error('Team chat error:', err);
      setError(err.message);
    } finally {
      setIsTyping(false);
    }
  }, [teamId]);

  return { messages, isTyping, error, sendMessage, loadHistory };
}
```

#### **4C. Add Route**

**File:** `/Users/jarvis/Code/HeyJarvis/desktop2/renderer2/src/App.jsx`

```javascript
// Add import
import TeamChat from './pages/TeamChat';

// Add route (around line 300)
<Route path="/team-chat" element={<TeamChat user={currentUser} />} />

// Add to routeMap (around line 190)
const routeMap = {
  // ... existing routes ...
  'team': '/team-chat',
  'team-chat': '/team-chat'
};
```

#### **4D. Add Tab**

**File:** `/Users/jarvis/Code/HeyJarvis/desktop2/renderer2/src/components/common/TabBar.jsx`

```javascript
const tabs = [
  // ... existing tabs ...
  {
    id: 'team-chat',
    path: '/team-chat',
    label: 'Team Chat',
    // roles: [] - visible to all
  }
];
```

---

### **Phase 5: Testing & Refinement** ⏱️ 4 hours

#### **5A. Integration Tests**

1. **Test Team Creation:**
   - Create a new team
   - Add team members
   - Assign meetings/tasks to team

2. **Test Context Picker:**
   - Load team meetings
   - Load team tasks
   - Select items for context
   - Verify context is sent to AI

3. **Test Team Chat:**
   - Send message with selected context
   - Verify AI response uses only selected context
   - Check message persistence
   - Test chat history loading

4. **Test Session Management:**
   - Create multiple sessions
   - Switch between sessions
   - Delete sessions
   - Verify persistence

#### **5B. Edge Cases**

- [ ] User not on team
- [ ] Empty context
- [ ] No team selected
- [ ] Network errors
- [ ] Missing API key
- [ ] Malformed responses

---

## 🚧 Potential Issues & Solutions

### **Issue 1: Session Persistence**
**Problem:** extra_feature uses localStorage, desktop2 uses Supabase

**Solution:** **Use Supabase** (desktop2 approach is better)
- Store sessions in `conversation_sessions` with `workflow_type: 'team_chat'`
- Store selected context in `workflow_metadata`
- One session per team per user

### **Issue 2: Context Picker State**
**Problem:** Large context picker component may slow down

**Solution:**
- Paginate meetings/tasks (load on-demand)
- Cache available context in component state
- Only refresh when team changes

### **Issue 3: Code Context Integration**
**Problem:** extra_feature has code indexer integration

**Solution:**
- Make it optional
- Only enable if code indexer is initialized
- Add checkbox: "Include code context"

### **Issue 4: Team Selection**
**Problem:** extra_feature has team dropdown in UI

**Solution:** **Two options:**

**Option A:** Add team selector to TabBar (recommended)
```javascript
// TabBar.jsx - add team dropdown
const [selectedTeam, setSelectedTeam] = useState(null);
// Pass to TeamChat as prop
```

**Option B:** Use current user's default team
```javascript
// Use auth.currentUser.team_id as default
```

---

## 📝 Final Checklist

### Database
- [ ] Run team-chat-schema.sql migration
- [ ] Verify all tables created
- [ ] Test team CRUD operations
- [ ] Verify RLS policies

### Backend
- [ ] TeamChatService created and tested
- [ ] SupabaseAdapter enhanced with team methods
- [ ] team-chat-handlers.js created
- [ ] Handler registered in main/index.js
- [ ] Service initialized with correct dependencies

### Frontend
- [ ] TeamChat.jsx ported and adapted
- [ ] useTeamChat hook created
- [ ] Route added to App.jsx
- [ ] Tab added to TabBar.jsx
- [ ] Styling adapted to desktop2 theme

### Integration
- [ ] End-to-end message flow tested
- [ ] Context filtering verified
- [ ] Session persistence working
- [ ] Team membership verified
- [ ] Error handling tested

---

## 🎯 Success Criteria

✅ **User can:**
1. Select a team from team dropdown
2. View team meetings, tasks, repositories
3. Select specific items for context
4. Ask questions about selected context
5. Get AI responses that cite sources
6. See chat history persist across sessions
7. Create multiple chat sessions per team
8. Switch between sessions

✅ **System can:**
1. Verify team membership before allowing access
2. Fetch only team-scoped data
3. Build context from selected items
4. Store sessions in Supabase
5. Handle errors gracefully
6. Scale to multiple teams

---

## 📊 Estimated Timeline

| Phase | Time | Risk |
|-------|------|------|
| Database Migration | 2h | Low |
| Backend Services | 4h | Medium |
| IPC Handlers | 3h | Low |
| Frontend Components | 6h | Medium |
| Testing & Refinement | 4h | High |
| **Total** | **19h** (~3 days) | **Medium** |

---

## 🚀 Next Steps

1. **Review this plan** - Make sure approach is correct
2. **Run database migration** - Set up schema
3. **Port backend services** - Start with TeamChatService
4. **Create IPC handlers** - Connect frontend to backend
5. **Port frontend** - Copy and adapt TeamChat component
6. **Test integration** - End-to-end testing

---

**Ready to implement?** Start with Phase 1 (database) and work sequentially through each phase.
