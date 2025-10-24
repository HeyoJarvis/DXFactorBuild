# Team Chat - Simple Integration Plan
## Add as new tab in desktop2, reuse existing database & auth

---

## 🎯 Simple Approach

**What we're doing:**
- Add "Team Chat" as a new tab in desktop2 (alongside Tasks, Code, etc.)
- Reuse the **same Supabase database** that extra_feature_desktop uses
- Leverage **existing auth** (JIRA, GitHub, MS Teams already connected)
- Port just the chat UI + minimal backend logic

**Key Insight:** Since both apps share the same database, we can just:
1. Use existing `team_meetings`, `team_updates`, `app_teams` tables (already there!)
2. Add a simple chat interface
3. Query the shared database
4. Done!

---

## 📋 What Already Exists (Shared Database)

### ✅ Tables (Already in Supabase)
- `app_teams` - Team definitions
- `app_team_members` - Team membership
- `app_team_repositories` - Team repos
- `team_meetings` - Meeting summaries
- `team_updates` - JIRA/GitHub activity
- `users` - User accounts (shared)
- `integration_connections` - OAuth tokens (JIRA, GitHub, MS Teams)

### ✅ Auth (Already Connected)
- JIRA OAuth ✅
- GitHub App ✅
- Microsoft Teams OAuth ✅ (may need sync from extra_feature)

---

## 🚀 Implementation (3 Steps)

### **Step 1: Add Tab to UI** ⏱️ 30 min

#### **1A. Add Route**

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

#### **1B. Add Tab to TabBar**

**File:** `/Users/jarvis/Code/HeyJarvis/desktop2/renderer2/src/components/common/TabBar.jsx`

```javascript
const tabs = [
  { id: 'mission-control', path: '/mission-control', label: 'Mission Control' },
  { id: 'indexer', path: '/indexer', label: 'Code' },
  { id: 'team-chat', path: '/team-chat', label: 'Team Chat' }, // ← NEW
  { id: 'architecture', path: '/architecture', label: 'Architecture', roles: ['developer'] },
  { id: 'tasks', path: '/tasks', label: userRole === 'developer' ? 'Developer' : 'Sales Tasks' }
];
```

---

### **Step 2: Create Simple UI** ⏱️ 2 hours

#### **2A. Create TeamChat Page**

**File:** `/Users/jarvis/Code/HeyJarvis/desktop2/renderer2/src/pages/TeamChat.jsx`

```jsx
import React, { useState, useEffect } from 'react';
import './TeamChat.css';

function TeamChat({ user }) {
  const [teams, setTeams] = useState([]);
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [showTeamPicker, setShowTeamPicker] = useState(false);

  // Load user's teams on mount
  useEffect(() => {
    loadTeams();
  }, []);

  // Load team context when team selected
  useEffect(() => {
    if (selectedTeam) {
      loadTeamContext();
      loadChatHistory();
    }
  }, [selectedTeam]);

  const loadTeams = async () => {
    try {
      const result = await window.electronAPI.teamChat.getTeams();
      if (result.success) {
        setTeams(result.teams);
        if (result.teams.length > 0) {
          setSelectedTeam(result.teams[0]); // Auto-select first team
        }
      }
    } catch (error) {
      console.error('Failed to load teams:', error);
    }
  };

  const loadTeamContext = async () => {
    // Load meetings, tasks, repos for the selected team
    // (For now, just load - we'll add context picker later)
  };

  const loadChatHistory = async () => {
    if (!selectedTeam) return;

    try {
      const result = await window.electronAPI.teamChat.getHistory(selectedTeam.id);
      if (result.success) {
        setMessages(result.messages || []);
      }
    } catch (error) {
      console.error('Failed to load chat history:', error);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || !selectedTeam) return;

    const userMessage = {
      role: 'user',
      content: input,
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsTyping(true);

    try {
      const result = await window.electronAPI.teamChat.send(selectedTeam.id, input);

      if (result.success) {
        const assistantMessage = {
          role: 'assistant',
          content: result.message,
          timestamp: new Date().toISOString()
        };
        setMessages(prev => [...prev, assistantMessage]);
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error('Chat error:', error);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date().toISOString()
      }]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="team-chat-container">
      {/* Team Selector */}
      <div className="team-chat-header">
        <div className="team-selector">
          <button
            className="team-selector-button"
            onClick={() => setShowTeamPicker(!showTeamPicker)}
          >
            {selectedTeam ? selectedTeam.name : 'Choose Team'} ▼
          </button>

          {showTeamPicker && (
            <div className="team-dropdown">
              {teams.map(team => (
                <div
                  key={team.id}
                  className={`team-option ${selectedTeam?.id === team.id ? 'selected' : ''}`}
                  onClick={() => {
                    setSelectedTeam(team);
                    setShowTeamPicker(false);
                  }}
                >
                  {team.name}
                </div>
              ))}
              <div className="team-option create-team">
                + Create team
              </div>
            </div>
          )}
        </div>

        <button className="edit-context-button">
          Edit Context
        </button>
      </div>

      {/* Chat Messages */}
      <div className="team-chat-messages">
        {messages.length === 0 ? (
          <div className="empty-state">
            <h3>Ask me anything about {selectedTeam?.name || 'your team'}</h3>
            <p>I have context from meetings, JIRA tasks, and code repositories.</p>
          </div>
        ) : (
          messages.map((msg, idx) => (
            <div key={idx} className={`message message-${msg.role}`}>
              <div className="message-content">
                {msg.content}
              </div>
              <div className="message-timestamp">
                {new Date(msg.timestamp).toLocaleTimeString()}
              </div>
            </div>
          ))
        )}

        {isTyping && (
          <div className="message message-assistant">
            <div className="typing-indicator">
              <span></span><span></span><span></span>
            </div>
          </div>
        )}
      </div>

      {/* Input Box */}
      <div className="team-chat-input">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder={`Ask about ${selectedTeam?.name || 'your team'}...`}
          rows={3}
          disabled={!selectedTeam}
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || !selectedTeam || isTyping}
        >
          Send
        </button>
      </div>
    </div>
  );
}

export default TeamChat;
```

#### **2B. Create Styles**

**File:** `/Users/jarvis/Code/HeyJarvis/desktop2/renderer2/src/pages/TeamChat.css`

```css
.team-chat-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: #1a1a1a;
  color: #fff;
}

.team-chat-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  border-bottom: 1px solid #333;
}

.team-selector {
  position: relative;
}

.team-selector-button {
  padding: 0.5rem 1rem;
  background: #2a2a2a;
  border: 1px solid #444;
  border-radius: 6px;
  color: #fff;
  cursor: pointer;
  font-size: 14px;
}

.team-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  margin-top: 0.5rem;
  background: #2a2a2a;
  border: 1px solid #444;
  border-radius: 6px;
  min-width: 200px;
  max-height: 300px;
  overflow-y: auto;
  z-index: 100;
}

.team-option {
  padding: 0.75rem 1rem;
  cursor: pointer;
  border-bottom: 1px solid #333;
}

.team-option:hover {
  background: #333;
}

.team-option.selected {
  background: #0066cc;
}

.team-option.create-team {
  color: #0066cc;
  border-bottom: none;
}

.edit-context-button {
  padding: 0.5rem 1rem;
  background: #2a2a2a;
  border: 1px solid #444;
  border-radius: 6px;
  color: #fff;
  cursor: pointer;
}

.team-chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 1rem;
}

.empty-state {
  text-align: center;
  margin-top: 4rem;
  color: #888;
}

.message {
  margin-bottom: 1rem;
  max-width: 80%;
}

.message-user {
  margin-left: auto;
}

.message-user .message-content {
  background: #0066cc;
  border-radius: 12px 12px 0 12px;
  padding: 0.75rem 1rem;
}

.message-assistant .message-content {
  background: #2a2a2a;
  border-radius: 12px 12px 12px 0;
  padding: 0.75rem 1rem;
}

.message-timestamp {
  font-size: 11px;
  color: #666;
  margin-top: 0.25rem;
}

.typing-indicator {
  display: flex;
  gap: 4px;
  padding: 0.75rem;
}

.typing-indicator span {
  width: 8px;
  height: 8px;
  background: #666;
  border-radius: 50%;
  animation: typing 1.4s infinite;
}

.typing-indicator span:nth-child(2) {
  animation-delay: 0.2s;
}

.typing-indicator span:nth-child(3) {
  animation-delay: 0.4s;
}

@keyframes typing {
  0%, 60%, 100% {
    opacity: 0.3;
  }
  30% {
    opacity: 1;
  }
}

.team-chat-input {
  padding: 1rem;
  border-top: 1px solid #333;
  display: flex;
  gap: 0.5rem;
}

.team-chat-input textarea {
  flex: 1;
  background: #2a2a2a;
  border: 1px solid #444;
  border-radius: 6px;
  color: #fff;
  padding: 0.75rem;
  font-size: 14px;
  resize: none;
  font-family: inherit;
}

.team-chat-input button {
  padding: 0.75rem 1.5rem;
  background: #0066cc;
  border: none;
  border-radius: 6px;
  color: #fff;
  cursor: pointer;
  font-weight: 500;
}

.team-chat-input button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
```

---

### **Step 3: Add Minimal Backend** ⏱️ 1 hour

#### **3A. Create IPC Handler**

**File:** `/Users/jarvis/Code/HeyJarvis/desktop2/main/ipc/team-chat-handlers.js`

```javascript
const { ipcMain } = require('electron');

function registerTeamChatHandlers(services, logger) {
  const { dbAdapter, ai, auth } = services;

  /**
   * Get user's teams
   */
  ipcMain.handle('teamChat:getTeams', async () => {
    try {
      const userId = auth?.currentUser?.id;
      if (!userId) {
        return { success: false, error: 'Not authenticated' };
      }

      const { data, error } = await dbAdapter.supabase
        .from('app_team_members')
        .select('team_id, role, app_teams(*)')
        .eq('user_id', userId);

      if (error) throw error;

      const teams = data.map(m => ({
        id: m.app_teams.id,
        name: m.app_teams.name,
        role: m.role,
        ...m.app_teams
      }));

      return { success: true, teams };
    } catch (error) {
      logger.error('Failed to get teams:', error);
      return { success: false, error: error.message };
    }
  });

  /**
   * Send message to team chat
   */
  ipcMain.handle('teamChat:send', async (event, teamId, message) => {
    try {
      const userId = auth?.currentUser?.id;
      if (!userId) {
        return { success: false, error: 'Not authenticated' };
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

      // Get team context (meetings, tasks)
      const { data: meetings } = await dbAdapter.supabase
        .from('team_meetings')
        .select('*')
        .eq('app_team_id', teamId)
        .order('start_time', { ascending: false })
        .limit(10);

      const { data: tasks } = await dbAdapter.supabase
        .from('team_updates')
        .select('*')
        .eq('app_team_id', teamId)
        .eq('update_type', 'jira_issue')
        .order('created_at', { ascending: false })
        .limit(10);

      // Build context
      let contextString = '## Team Context\n\n';

      if (meetings?.length > 0) {
        contextString += '### Recent Meetings:\n';
        meetings.forEach(m => {
          contextString += `- ${m.title} (${new Date(m.start_time).toLocaleDateString()})\n`;
          if (m.ai_summary) {
            contextString += `  Summary: ${m.ai_summary}\n`;
          }
        });
        contextString += '\n';
      }

      if (tasks?.length > 0) {
        contextString += '### Recent JIRA Tasks:\n';
        tasks.forEach(t => {
          contextString += `- ${t.external_key}: ${t.title} (${t.status})\n`;
        });
        contextString += '\n';
      }

      // Send to AI
      const systemPrompt = `You are HeyJarvis, helping a team collaborate.

${contextString}

Answer questions based on the team context above. Be concise and cite specific meetings or tasks.`;

      const response = await ai.sendMessage(message, { systemPrompt });
      const responseContent = typeof response === 'string' ? response : response.content;

      // Save to session
      const sessionResult = await dbAdapter.getOrCreateActiveSession(userId, {
        workflow_type: 'team_chat',
        workflow_id: `team_${teamId}`,
        team_id: teamId
      });

      await dbAdapter.saveMessageToSession(sessionResult.session.id, message, 'user', { team_id: teamId }, userId);
      await dbAdapter.saveMessageToSession(sessionResult.session.id, responseContent, 'assistant', { team_id: teamId }, userId);

      return { success: true, message: responseContent };
    } catch (error) {
      logger.error('Team chat error:', error);
      return { success: false, error: error.message };
    }
  });

  /**
   * Get chat history
   */
  ipcMain.handle('teamChat:getHistory', async (event, teamId) => {
    try {
      const userId = auth?.currentUser?.id;
      if (!userId) {
        return { success: true, messages: [] };
      }

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

      const result = await dbAdapter.getSessionMessages(session.id);

      if (result.success) {
        return {
          success: true,
          messages: result.messages.map(m => ({
            role: m.role,
            content: m.message_text,
            timestamp: m.created_at
          }))
        };
      }

      return { success: true, messages: [] };
    } catch (error) {
      logger.error('Get history error:', error);
      return { success: false, error: error.message };
    }
  });

  logger.info('✅ Team chat handlers registered');
}

module.exports = registerTeamChatHandlers;
```

#### **3B. Register Handler**

**File:** `/Users/jarvis/Code/HeyJarvis/desktop2/main/index.js`

```javascript
// Add import (around line 25)
const registerTeamChatHandlers = require('./ipc/team-chat-handlers');

// Register handler (around line 85, after other handlers)
registerTeamChatHandlers(services, logger);
```

---

## ✅ That's It!

**Total time:** ~3.5 hours

**What you get:**
- New "Team Chat" tab
- Team selector dropdown
- Simple chat interface
- AI responses using team context (meetings + JIRA)
- Chat history persistence
- Works with existing auth & database

**What's NOT included (can add later):**
- Context picker (selecting specific meetings/tasks)
- Code context integration
- Multiple chat sessions
- Team creation UI

**Next steps:**
1. Copy the code above
2. Test with existing teams in database
3. Iterate on UI/features as needed

This is a **minimal viable implementation** that gets you a working team chat quickly!
