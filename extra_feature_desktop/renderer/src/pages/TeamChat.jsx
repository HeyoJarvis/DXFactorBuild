import React, { useState, useEffect, useRef } from 'react';
import ChatInterface from '../components/ChatInterface';
import './TeamChat.css';

function TeamChat({ user }) {
  const [sessions, setSessions] = useState([]);
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [showContextPicker, setShowContextPicker] = useState(false);
  const [loading, setLoading] = useState(false);
  
  // Context options
  const [availableMeetings, setAvailableMeetings] = useState([]);
  const [availableTasks, setAvailableTasks] = useState([]);
  const [availableRepos, setAvailableRepos] = useState([]);
  
  const chatEndRef = useRef(null);

  useEffect(() => {
    loadSessions();
    loadAvailableContext();
  }, [user]);

  useEffect(() => {
    scrollToBottom();
  }, [currentSessionId, sessions]);

  const loadSessions = () => {
    try {
      const saved = localStorage.getItem('chatSessions');
      if (saved) {
        const parsed = JSON.parse(saved);
        setSessions(parsed);
        if (parsed.length > 0 && !currentSessionId) {
          setCurrentSessionId(parsed[0].id);
        }
      }
    } catch (error) {
      console.error('Failed to load sessions:', error);
    }
  };

  const saveSessions = (updatedSessions) => {
    try {
      localStorage.setItem('chatSessions', JSON.stringify(updatedSessions));
      setSessions(updatedSessions);
    } catch (error) {
      console.error('Failed to save sessions:', error);
    }
  };

  const loadAvailableContext = async () => {
    if (!user) return;

    try {
      // Load meetings - pass Date objects for last 10 days
      const meetingsResult = await window.electronAPI.meeting.getSummaries({
        startDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
        endDate: new Date()
      });
      if (meetingsResult && meetingsResult.success) {
        // Backend returns 'meetings', not 'summaries'
        const meetings = meetingsResult.meetings || meetingsResult.summaries || [];
        console.log('Loaded meetings for context picker:', meetings.length);
        setAvailableMeetings(meetings);
      }

      // Load JIRA tasks - last 30 days to match JIRA Tasks page
      const tasksResult = await window.electronAPI.sync.getUpdates({ days: 30 });
      if (tasksResult.success) {
        const jiraTasks = (tasksResult.updates || []).filter(u => 
          u && u.update_type && u.update_type.startsWith('jira_')
        );
        setAvailableTasks(jiraTasks);
      }

      // Load GitHub repos
      const reposResult = await window.electronAPI.github.listRepositories();
      if (reposResult.success) {
        setAvailableRepos(reposResult.repositories || []);
      }
    } catch (error) {
      console.error('Failed to load context:', error);
    }
  };

  const createNewSession = () => {
    const newSession = {
      id: Date.now().toString(),
      name: `Chat ${sessions.length + 1}`,
      createdAt: new Date().toISOString(),
      messages: [],
      context: {
        meetings: [],
        tasks: [],
        repositories: []
      }
    };
    
    const updated = [newSession, ...sessions];
    saveSessions(updated);
    setCurrentSessionId(newSession.id);
    setShowContextPicker(true);
  };

  const deleteSession = (sessionId) => {
    if (!confirm('Delete this chat session?')) return;
    
    const updated = sessions.filter(s => s.id !== sessionId);
    saveSessions(updated);
    
    if (currentSessionId === sessionId && updated.length > 0) {
      setCurrentSessionId(updated[0].id);
    } else if (updated.length === 0) {
      setCurrentSessionId(null);
    }
  };

  const renameSession = (sessionId, newName) => {
    const updated = sessions.map(s => 
      s.id === sessionId ? { ...s, name: newName } : s
    );
    saveSessions(updated);
  };

  const updateSessionContext = (sessionId, context) => {
    const updated = sessions.map(s => 
      s.id === sessionId ? { ...s, context } : s
    );
    saveSessions(updated);
  };

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = async (message) => {
    if (!message.trim() || !currentSessionId) return;

    const session = sessions.find(s => s.id === currentSessionId);
    if (!session) return;

    // Add user message
    const userMessage = {
      role: 'user',
      content: message,
      timestamp: new Date().toISOString()
    };

    const updatedMessages = [...session.messages, userMessage];
    updateSessionMessages(currentSessionId, updatedMessages);
    setLoading(true);

    try {
      // Prepare context for AI
      const contextOptions = {
        daysBack: 30,  // Use 30 days for general context
        maxMeetings: 10,
        maxUpdates: 20,
        contextFilter: {
          meetingIds: session.context.meetings.map(m => m.id),
          taskIds: session.context.tasks.map(t => t.id),
          repositories: session.context.repositories.map(r => ({ owner: r.owner, name: r.name }))
        }
      };

      // Ask AI with context
      const result = await window.electronAPI.intelligence.ask(user.id, message, contextOptions);

      if (result.success) {
        const aiMessage = {
          role: 'assistant',
          content: result.answer,
          timestamp: new Date().toISOString(),
          sources: result.sources,
          contextUsed: result.context_used
        };
        updateSessionMessages(currentSessionId, [...updatedMessages, aiMessage]);
      } else {
        const errorMessage = {
          role: 'assistant',
          content: `Sorry, I encountered an error: ${result.error}`,
          timestamp: new Date().toISOString(),
          isError: true
        };
        updateSessionMessages(currentSessionId, [...updatedMessages, errorMessage]);
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      const errorMessage = {
        role: 'assistant',
        content: 'Sorry, something went wrong. Please try again.',
        timestamp: new Date().toISOString(),
        isError: true
      };
      updateSessionMessages(currentSessionId, [...updatedMessages, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const updateSessionMessages = (sessionId, messages) => {
    const updated = sessions.map(s => 
      s.id === sessionId ? { ...s, messages } : s
    );
    saveSessions(updated);
  };

  const handleQueryCode = async (query) => {
    const session = sessions.find(s => s.id === currentSessionId);
    if (!session || session.context.repositories.length === 0) {
      alert('Please select at least one repository in the context picker');
      return;
    }

    setLoading(true);
    try {
      // Query the code indexer
      const repo = session.context.repositories[0]; // Use first selected repo
      const result = await window.electronAPI.codeIndexer.query({
        query,
        owner: repo.owner,
        repo: repo.name
      });

      if (result.success) {
        // Add code result as a message
        const codeMessage = {
          role: 'assistant',
          content: `**Code Search Results:**\n\n${result.data.answer}`,
          timestamp: new Date().toISOString(),
          sources: result.data.sources || [],
          type: 'code'
        };
        
        const session = sessions.find(s => s.id === currentSessionId);
        updateSessionMessages(currentSessionId, [...session.messages, codeMessage]);
      } else {
        alert('Code search failed: ' + result.error);
      }
    } catch (error) {
      console.error('Code query failed:', error);
      alert('Error: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const renderSessionList = () => (
    <div className="session-list">
      <div className="session-list-header">
        <h3>Chat Sessions</h3>
        <button className="btn-icon" onClick={createNewSession} title="New Session">
          ➕
        </button>
      </div>
      
      <div className="session-items">
        {sessions.length === 0 ? (
          <div className="empty-sessions">
            <p>No chat sessions yet</p>
            <button className="btn btn-primary btn-sm" onClick={createNewSession}>
              Create First Session
            </button>
          </div>
        ) : (
          sessions.map(session => (
            <div
              key={session.id}
              className={`session-item ${currentSessionId === session.id ? 'active' : ''}`}
              onClick={() => setCurrentSessionId(session.id)}
            >
              <div className="session-info">
                <div className="session-name">{session.name}</div>
                <div className="session-meta">
                  <span>{session.messages.length} messages</span>
                  <span>•</span>
                  <span>{new Date(session.createdAt).toLocaleDateString()}</span>
                </div>
                {(session.context.meetings.length > 0 || 
                  session.context.tasks.length > 0 || 
                  session.context.repositories.length > 0) && (
                  <div className="session-context-tags">
                    {session.context.meetings.length > 0 && (
                      <span className="context-tag">📅 {session.context.meetings.length}</span>
                    )}
                    {session.context.tasks.length > 0 && (
                      <span className="context-tag">🎯 {session.context.tasks.length}</span>
                    )}
                    {session.context.repositories.length > 0 && (
                      <span className="context-tag">💻 {session.context.repositories.length}</span>
                    )}
                  </div>
                )}
              </div>
              <button
                className="btn-icon btn-danger"
                onClick={(e) => {
                  e.stopPropagation();
                  deleteSession(session.id);
                }}
                title="Delete Session"
              >
                🗑️
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );

  const renderContextPicker = () => {
    const session = sessions.find(s => s.id === currentSessionId);
    if (!session) return null;

    const toggleMeeting = (meeting) => {
      const meetings = session.context.meetings.some(m => m.id === meeting.id)
        ? session.context.meetings.filter(m => m.id !== meeting.id)
        : [...session.context.meetings, meeting];
      updateSessionContext(currentSessionId, { ...session.context, meetings });
    };

    const toggleTask = (task) => {
      const tasks = session.context.tasks.some(t => t.id === task.id)
        ? session.context.tasks.filter(t => t.id !== task.id)
        : [...session.context.tasks, task];
      updateSessionContext(currentSessionId, { ...session.context, tasks });
    };

    const toggleRepo = (repo) => {
      const repositories = session.context.repositories.some(r => r.full_name === repo.full_name)
        ? session.context.repositories.filter(r => r.full_name !== repo.full_name)
        : [...session.context.repositories, repo];
      updateSessionContext(currentSessionId, { ...session.context, repositories });
    };

    return (
      <div className={`context-picker ${showContextPicker ? 'visible' : ''}`}>
        <div className="context-picker-header">
          <h3>📎 Context Picker</h3>
          <button className="btn-icon" onClick={() => setShowContextPicker(!showContextPicker)}>
            {showContextPicker ? '✕' : '📎'}
          </button>
        </div>

        {showContextPicker && (
          <div className="context-picker-content">
            {/* Meetings Section */}
            <div className="context-section">
              <h4>📅 Meetings ({session.context.meetings.length} selected)</h4>
              <div className="context-items">
                {availableMeetings.length === 0 ? (
                  <p className="empty-text">No meetings available</p>
                ) : (
                  availableMeetings.slice(0, 10).map(meeting => (
                    <label key={meeting.id} className="context-item">
                      <input
                        type="checkbox"
                        checked={session.context.meetings.some(m => m.id === meeting.id)}
                        onChange={() => toggleMeeting(meeting)}
                      />
                      <span className="context-item-content">
                        <strong>{meeting.title || 'Untitled Meeting'}</strong>
                        <small>{new Date(meeting.meeting_date).toLocaleDateString()}</small>
                      </span>
                    </label>
                  ))
                )}
              </div>
            </div>

            {/* JIRA Tasks Section */}
            <div className="context-section">
              <h4>🎯 JIRA Tasks ({session.context.tasks.length} selected)</h4>
              <div className="context-items">
                {availableTasks.length === 0 ? (
                  <p className="empty-text">No JIRA tasks available</p>
                ) : (
                  availableTasks.slice(0, 10).map(task => (
                    <label key={task.id} className="context-item">
                      <input
                        type="checkbox"
                        checked={session.context.tasks.some(t => t.id === task.id)}
                        onChange={() => toggleTask(task)}
                      />
                      <span className="context-item-content">
                        <strong>{task.title || 'Untitled Task'}</strong>
                        <small>{task.external_id || 'No ID'}</small>
                      </span>
                    </label>
                  ))
                )}
              </div>
            </div>

            {/* Repositories Section */}
            <div className="context-section">
              <h4>💻 Repositories ({session.context.repositories.length} selected)</h4>
              <div className="context-items">
                {availableRepos.length === 0 ? (
                  <p className="empty-text">No repositories available</p>
                ) : (
                  availableRepos.map(repo => (
                    <label key={repo.full_name} className="context-item">
                      <input
                        type="checkbox"
                        checked={session.context.repositories.some(r => r.full_name === repo.full_name)}
                        onChange={() => toggleRepo(repo)}
                      />
                      <span className="context-item-content">
                        <strong>{repo.name}</strong>
                        <small>{repo.full_name}</small>
                      </span>
                    </label>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderMessages = () => {
    const session = sessions.find(s => s.id === currentSessionId);
    if (!session) return null;

    if (session.messages.length === 0) {
      return (
          <div className="chat-welcome">
          <div className="welcome-icon">💬</div>
          <h2 className="welcome-title">Start a conversation</h2>
          <p className="welcome-text">
            Ask questions about your selected context: meetings (10 days), tasks (30 days), and code
          </p>
          
          <div className="context-summary">
            <h3>Selected Context:</h3>
            <div className="context-summary-grid">
              <div className="context-summary-item">
                <span className="context-icon">📅</span>
                <span className="context-count">{session.context.meetings.length}</span>
                <span className="context-label">Meetings</span>
              </div>
              <div className="context-summary-item">
                <span className="context-icon">🎯</span>
                <span className="context-count">{session.context.tasks.length}</span>
                <span className="context-label">JIRA Tasks</span>
              </div>
              <div className="context-summary-item">
                <span className="context-icon">💻</span>
                <span className="context-count">{session.context.repositories.length}</span>
                <span className="context-label">Repositories</span>
              </div>
            </div>
            <button 
              className="btn btn-primary" 
              onClick={() => setShowContextPicker(true)}
            >
              {session.context.meetings.length + session.context.tasks.length + session.context.repositories.length === 0
                ? '📎 Pick Context to Start'
                : '📎 Modify Context'}
            </button>
          </div>
        </div>
      );
    }

    return (
      <>
        {session.messages.map((message, index) => (
          <div 
            key={index} 
            className={`message message-${message.role}`}
          >
            <div className="message-avatar">
              {message.role === 'user' ? '👤' : '🤖'}
            </div>
            <div className="message-content">
              <div className={`message-bubble ${message.isError ? 'error' : ''} ${message.type === 'code' ? 'code-result' : ''}`}>
                {message.content.split('\n').map((line, i) => (
                  <React.Fragment key={i}>
                    {line}
                    {i < message.content.split('\n').length - 1 && <br />}
                  </React.Fragment>
                ))}
              </div>
              {message.sources && message.sources.length > 0 && (
                <div className="message-sources">
                  <strong>Sources:</strong>
                  {message.sources.map((source, i) => (
                    <span key={i} className="source-tag">
                      {source.type === 'meeting' && '📅'}
                      {source.type === 'jira' && '🎯'}
                      {source.type === 'github_pr' && '🔀'}
                      {source.type === 'github_commit' && '💻'}
                      {source.type === 'code' && '📝'}
                      {' '}
                      {source.title || source.file || 'Source'}
                    </span>
                  ))}
                </div>
              )}
              {message.contextUsed && (
                <div className="message-context">
                  📊 Context: {message.contextUsed.meetings || 0} meetings, 
                  {' '}{message.contextUsed.jira || 0} JIRA tasks, 
                  {' '}{message.contextUsed.codeChunks !== undefined ? `${message.contextUsed.codeChunks} code chunks` : `${message.contextUsed.github || 0} GitHub updates`}
                </div>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="message message-assistant">
            <div className="message-avatar">🤖</div>
            <div className="message-content">
              <div className="message-bubble loading">
                <div className="typing-indicator">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              </div>
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </>
    );
  };

  if (!user) {
    return (
      <div className="page-container">
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  const currentSession = sessions.find(s => s.id === currentSessionId);

  return (
    <div className="page-container team-chat-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">💬 Team Intelligence Chat</h1>
          <p className="page-subtitle">
            Multi-session conversations with context-aware AI
          </p>
        </div>
        <div className="header-actions">
          <button 
            className={`btn ${showContextPicker ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setShowContextPicker(!showContextPicker)}
            disabled={!currentSession}
          >
            📎 Context {showContextPicker ? '▼' : '▶'}
          </button>
          <button 
            className="btn btn-primary"
            onClick={createNewSession}
          >
            ➕ New Session
          </button>
        </div>
      </div>

      <div className="chat-layout">
        {/* Sessions Sidebar */}
        <div className="chat-sidebar">
          {renderSessionList()}
        </div>

        {/* Main Chat Area */}
        <div className="chat-main">
          {currentSession ? (
            <>
              <div className="chat-session-header">
                <input
                  type="text"
                  className="session-name-input"
                  value={currentSession.name}
                  onChange={(e) => renameSession(currentSession.id, e.target.value)}
                  placeholder="Session name..."
                />
                <div className="session-context-summary">
                  {currentSession.context.meetings.length > 0 && (
                    <span className="context-badge">📅 {currentSession.context.meetings.length}</span>
                  )}
                  {currentSession.context.tasks.length > 0 && (
                    <span className="context-badge">🎯 {currentSession.context.tasks.length}</span>
                  )}
                  {currentSession.context.repositories.length > 0 && (
                    <span className="context-badge">💻 {currentSession.context.repositories.length}</span>
                  )}
                </div>
              </div>

              <div className="chat-container">
                <div className="chat-messages">
                  {renderMessages()}
                </div>

                <ChatInterface 
                  onSendMessage={handleSendMessage} 
                  disabled={loading}
                />
              </div>
            </>
          ) : (
            <div className="no-session-selected">
              <div className="empty-icon">💬</div>
              <h2>No Session Selected</h2>
              <p>Create a new session or select one from the sidebar</p>
              <button className="btn btn-primary" onClick={createNewSession}>
                ➕ Create New Session
              </button>
            </div>
          )}
        </div>

        {/* Context Picker Panel */}
        {currentSession && (
          <div className={`chat-context-panel ${showContextPicker ? 'visible' : ''}`}>
            {renderContextPicker()}
          </div>
        )}
      </div>
    </div>
  );
}

export default TeamChat;
