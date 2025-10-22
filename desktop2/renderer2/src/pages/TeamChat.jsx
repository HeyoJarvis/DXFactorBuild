import { useState, useEffect, useRef } from 'react';
import './TeamChat.css';

export default function TeamChat({ user }) {
  const [teams, setTeams] = useState([]);
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [contextSummary, setContextSummary] = useState(null);
  const [contextDetails, setContextDetails] = useState(null);
  const [contextSettings, setContextSettings] = useState({
    include_meetings: true,
    include_tasks: true,
    include_code: true,
    selected_repo_paths: []
  });
  const [isSavingContext, setIsSavingContext] = useState(false);
  const messagesEndRef = useRef(null);

  // Auto-scroll to bottom when messages change
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Load teams on mount
  useEffect(() => {
    loadTeams();
  }, []);

  // Load chat history when team is selected
  useEffect(() => {
    if (selectedTeam) {
      loadChatHistory(selectedTeam.id);
    }
  }, [selectedTeam]);

  const loadTeams = async () => {
    try {
      if (!window.electronAPI?.teamChat?.loadTeams) {
        console.error('Team Chat API not available');
        return;
      }

      const result = await window.electronAPI.teamChat.loadTeams();
      if (result.success) {
        setTeams(result.teams);

        // Auto-select first team if available
        if (result.teams.length > 0 && !selectedTeam) {
          setSelectedTeam(result.teams[0]);
        }
      } else {
        console.error('Failed to load teams:', result.error);
      }
    } catch (error) {
      console.error('Error loading teams:', error);
    }
  };

  const loadChatHistory = async (teamId) => {
    try {
      setIsLoading(true);

      if (!window.electronAPI?.teamChat?.getHistory) {
        console.error('Team Chat API not available');
        return;
      }

      const result = await window.electronAPI.teamChat.getHistory(teamId);

      if (result.success) {
        setMessages(result.messages || []);
        setContextSummary(result.context);
        setContextDetails(result.contextDetails || null);

        // Load context settings
        if (result.contextSettings) {
          setContextSettings(result.contextSettings);
        }
      } else {
        console.error('Failed to load chat history:', result.error);
        setMessages([]);
      }
    } catch (error) {
      console.error('Error loading chat history:', error);
      setMessages([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleContextToggle = (key) => {
    setContextSettings(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const handleRepoToggle = (repoPath) => {
    setContextSettings(prev => {
      const selected = prev.selected_repo_paths || [];
      const isSelected = selected.includes(repoPath);

      return {
        ...prev,
        selected_repo_paths: isSelected
          ? selected.filter(p => p !== repoPath)
          : [...selected, repoPath]
      };
    });
  };

  const handleSaveContextSettings = async () => {
    if (!selectedTeam) return;

    try {
      setIsSavingContext(true);

      if (!window.electronAPI?.teamChat?.saveContextSettings) {
        console.error('Team Chat API not available');
        return;
      }

      const result = await window.electronAPI.teamChat.saveContextSettings(
        selectedTeam.id,
        contextSettings
      );

      if (result.success) {
        // Reload context with new settings
        await loadChatHistory(selectedTeam.id);
      } else {
        console.error('Failed to save context settings:', result.error);
      }
    } catch (error) {
      console.error('Error saving context settings:', error);
    } finally {
      setIsSavingContext(false);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();

    if (!inputMessage.trim() || !selectedTeam || isSending) {
      return;
    }

    const userMessage = inputMessage.trim();
    setInputMessage('');
    setIsSending(true);

    // Add user message immediately to UI
    const userMessageObj = {
      role: 'user',
      content: userMessage,
      timestamp: new Date().toISOString()
    };
    setMessages(prev => [...prev, userMessageObj]);

    try {
      if (!window.electronAPI?.teamChat?.sendMessage) {
        console.error('Team Chat API not available');
        return;
      }

      const result = await window.electronAPI.teamChat.sendMessage(
        selectedTeam.id,
        userMessage
      );

      if (result.success) {
        // Add AI response to messages
        const aiMessageObj = {
          role: 'assistant',
          content: result.response,
          timestamp: new Date().toISOString()
        };
        setMessages(prev => [...prev, aiMessageObj]);
      } else {
        console.error('Failed to send message:', result.error);

        // Add error message
        const errorMessageObj = {
          role: 'assistant',
          content: `Error: ${result.error}`,
          timestamp: new Date().toISOString(),
          isError: true
        };
        setMessages(prev => [...prev, errorMessageObj]);
      }
    } catch (error) {
      console.error('Error sending message:', error);

      // Add error message
      const errorMessageObj = {
        role: 'assistant',
        content: `Error: ${error.message}`,
        timestamp: new Date().toISOString(),
        isError: true
      };
      setMessages(prev => [...prev, errorMessageObj]);
    } finally {
      setIsSending(false);
    }
  };

  const handleTeamSelect = (team) => {
    setSelectedTeam(team);
    setMessages([]);
    setContextSummary(null);
  };

  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;

    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;

    return date.toLocaleDateString();
  };

  return (
    <div className="team-chat-container">
      {/* Header */}
      <div className="team-chat-header">
        <div className="team-chat-header-left">
          <h1 className="team-chat-title">Team Chat</h1>
          <p className="team-chat-subtitle">
            Context-aware conversations powered by team knowledge
          </p>
        </div>

        {/* Team Selector */}
        <div className="team-selector">
          <label htmlFor="team-select" className="team-selector-label">
            Select Team:
          </label>
          <select
            id="team-select"
            className="team-selector-dropdown"
            value={selectedTeam?.id || ''}
            onChange={(e) => {
              const team = teams.find(t => t.id === e.target.value);
              if (team) handleTeamSelect(team);
            }}
          >
            {teams.length === 0 && (
              <option value="">No teams available</option>
            )}
            {teams.map(team => (
              <option key={team.id} value={team.id}>
                {team.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="team-chat-main">
        {/* Context Panel */}
        {selectedTeam && (
          <div className="team-chat-context-panel">
            <div className="context-panel-header">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"></circle>
                <path d="M12 16v-4"></path>
                <path d="M12 8h.01"></path>
              </svg>
              <h3>Team Context</h3>
            </div>

            <div className="context-panel-content">
              {/* Meetings Section */}
              <div className="context-section">
                <div className="context-section-header">
                  <label className="context-toggle">
                    <input
                      type="checkbox"
                      checked={contextSettings.include_meetings}
                      onChange={() => handleContextToggle('include_meetings')}
                    />
                    <span className="context-icon">📅</span>
                    <span className="context-label">Meetings</span>
                  </label>
                  {contextDetails?.meetings && (
                    <span className="context-count">{contextDetails.meetings.length}</span>
                  )}
                </div>
                {contextSettings.include_meetings && contextDetails?.meetings && (
                  <div className="context-items-list">
                    {contextDetails.meetings.slice(0, 5).map((meeting, idx) => (
                      <div key={idx} className="context-detail-item">
                        <div className="context-detail-title">{meeting.title}</div>
                        <div className="context-detail-meta">{new Date(meeting.meeting_date).toLocaleDateString()}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Tasks Section */}
              <div className="context-section">
                <div className="context-section-header">
                  <label className="context-toggle">
                    <input
                      type="checkbox"
                      checked={contextSettings.include_tasks}
                      onChange={() => handleContextToggle('include_tasks')}
                    />
                    <span className="context-icon">✅</span>
                    <span className="context-label">Tasks</span>
                  </label>
                  {contextDetails?.tasks && (
                    <span className="context-count">{contextDetails.tasks.length}</span>
                  )}
                </div>
                {contextSettings.include_tasks && contextDetails?.tasks && (
                  <div className="context-items-list">
                    {contextDetails.tasks.slice(0, 5).map((task, idx) => (
                      <div key={idx} className="context-detail-item">
                        <div className="context-detail-title">{task.title}</div>
                        {task.external_key && (
                          <div className="context-detail-meta">{task.external_key}</div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Code Section */}
              <div className="context-section">
                <div className="context-section-header">
                  <label className="context-toggle">
                    <input
                      type="checkbox"
                      checked={contextSettings.include_code}
                      onChange={() => handleContextToggle('include_code')}
                    />
                    <span className="context-icon">💻</span>
                    <span className="context-label">Codebase</span>
                  </label>
                  {contextDetails?.code_repos && (
                    <span className="context-count">{contextDetails.code_repos.length}</span>
                  )}
                </div>
                {contextSettings.include_code && contextDetails?.code_repos && (
                  <div className="context-items-list">
                    {contextDetails.code_repos.map((repo, idx) => (
                      <label key={idx} className="context-repo-item">
                        <input
                          type="checkbox"
                          checked={repo.selected}
                          onChange={() => handleRepoToggle(repo.path)}
                        />
                        <div className="context-repo-info">
                          <div className="context-detail-title">{repo.name}</div>
                          <div className="context-detail-meta">{repo.file_count} files</div>
                        </div>
                      </label>
                    ))}
                    {contextDetails.code_repos.length === 0 && (
                      <div className="context-empty-message">
                        No repositories indexed yet
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Save Button */}
              <button
                className="context-save-button"
                onClick={handleSaveContextSettings}
                disabled={isSavingContext}
              >
                {isSavingContext ? 'Saving...' : 'Save Context Settings'}
              </button>

              {/* Summary */}
              {contextSummary?.summary && (
                <p className="context-summary">{contextSummary.summary}</p>
              )}
            </div>
          </div>
        )}

        {/* Chat Area */}
        <div className="team-chat-content">
          {!selectedTeam ? (
            <div className="team-chat-empty-state">
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
              </svg>
              <h2>Select a team to start chatting</h2>
              <p>Choose a team from the dropdown to view context and start a conversation</p>
            </div>
          ) : isLoading ? (
            <div className="team-chat-loading">
              <div className="loading-spinner"></div>
              <p>Loading chat history...</p>
            </div>
          ) : (
            <>
              {/* Messages List */}
              <div className="team-chat-messages">
                {messages.length === 0 && (
                  <div className="team-chat-welcome">
                    <h3>Welcome to {selectedTeam.name} Chat</h3>
                    <p>Start a conversation! I have context from:</p>
                    <ul>
                      <li>Recent team meetings and discussions</li>
                      <li>JIRA tickets assigned to this team</li>
                      <li>Codebase files related to your projects</li>
                    </ul>
                  </div>
                )}

                {messages.map((msg, index) => (
                  <div
                    key={index}
                    className={`team-chat-message ${msg.role === 'user' ? 'user-message' : 'assistant-message'} ${msg.isError ? 'error-message' : ''}`}
                  >
                    <div className="message-avatar">
                      {msg.role === 'user' ? (
                        user?.name?.[0]?.toUpperCase() || 'U'
                      ) : (
                        '🤖'
                      )}
                    </div>
                    <div className="message-content">
                      <div className="message-header">
                        <span className="message-author">
                          {msg.role === 'user' ? (user?.name || 'You') : 'AI Assistant'}
                        </span>
                        <span className="message-timestamp">
                          {formatTimestamp(msg.timestamp)}
                        </span>
                      </div>
                      <div className="message-text">{msg.content}</div>
                    </div>
                  </div>
                ))}

                {isSending && (
                  <div className="team-chat-message assistant-message typing-indicator">
                    <div className="message-avatar">🤖</div>
                    <div className="message-content">
                      <div className="typing-dots">
                        <span></span>
                        <span></span>
                        <span></span>
                      </div>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Input Area */}
              <form className="team-chat-input-container" onSubmit={handleSendMessage}>
                <input
                  type="text"
                  className="team-chat-input"
                  placeholder={`Message ${selectedTeam.name}...`}
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  disabled={isSending}
                />
                <button
                  type="submit"
                  className="team-chat-send-button"
                  disabled={!inputMessage.trim() || isSending}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="22" y1="2" x2="11" y2="13"></line>
                    <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                  </svg>
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
