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
  const messagesContainerRef = useRef(null);

  // Auto-scroll to bottom when messages change
  const scrollToBottom = () => {
    const container = messagesContainerRef.current;
    if (container) {
      container.scrollTo({ top: container.scrollHeight, behavior: 'auto' });
    } else {
      messagesEndRef.current?.scrollIntoView({ block: 'nearest' });
    }
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

      {/* Main Content Area - Full Width Chat */}
      <div className="team-chat-main">
        <div className="team-chat-content-full">
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
              <div className="team-chat-messages" ref={messagesContainerRef}>
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
