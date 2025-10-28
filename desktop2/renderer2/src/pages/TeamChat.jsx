import { useState, useEffect, useRef } from 'react';
import './TeamChat.css';

export default function TeamChat({ user, selectedTeam, departmentMode = false }) {
  // selectedTeam now comes from MissionControl dropdown - just react to it changing
  // departmentMode = true when chatting at the department level with all units
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

  // Load chat history when selectedTeam changes from parent (MissionControl dropdown)
  useEffect(() => {
    if (selectedTeam?.id) {
      // For department mode, don't load history yet (backend needs to be updated)
      if (departmentMode || selectedTeam.isDepartment) {
        console.log('💬 Department Chat: Starting fresh conversation for', selectedTeam.name);
        console.log('💬 Department object:', selectedTeam);
        console.log('💬 Units in department:', selectedTeam.units);
        console.log('💬 Unit IDs:', selectedTeam.units?.map(u => ({ id: u.id, name: u.name })));
        setMessages([]);
        setIsLoading(false);
      } else {
        console.log('💬 TeamChat: Loading chat for team', selectedTeam.name, '(ID:', selectedTeam.id, ')');
        loadChatHistory(selectedTeam.id);
      }
    } else {
      // Clear messages if no team selected
      setMessages([]);
    }
  }, [selectedTeam?.id, departmentMode]); // React to selectedTeam.id and departmentMode changes

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

      console.log('💬 Sending message to team:', selectedTeam.name, '(ID:', selectedTeam.id, ')');

      // For department mode, pass department info with all unit IDs
      const chatContext = departmentMode || selectedTeam.isDepartment ? {
        isDepartment: true,
        departmentName: selectedTeam.name,
        unitIds: selectedTeam.units?.map(u => u.id) || []
      } : null;

      console.log('💬 Department Chat Context:', {
        isDepartment: chatContext?.isDepartment,
        departmentName: chatContext?.departmentName,
        unitCount: selectedTeam.units?.length,
        unitIds: chatContext?.unitIds,
        selectedTeam: selectedTeam
      });

      const result = await window.electronAPI.teamChat.sendMessage(
        selectedTeam.id,
        userMessage,
        chatContext
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

  // Team selection is now handled by parent (MissionControl)

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

  // Format message content with markdown support
  const formatMessageContent = (content) => {
    if (!content) return '';
    
    // Process bold text in a string
    const processBoldText = (text, lineIndex) => {
      const boldRegex = /\*\*(.*?)\*\*/g;
      const parts = [];
      let lastIndex = 0;
      let match;
      let matchCount = 0;
      
      while ((match = boldRegex.exec(text)) !== null) {
        if (match.index > lastIndex) {
          parts.push(text.substring(lastIndex, match.index));
        }
        parts.push(<strong key={`b-${lineIndex}-${matchCount++}`}>{match[1]}</strong>);
        lastIndex = match.index + match[0].length;
      }
      if (lastIndex < text.length) {
        parts.push(text.substring(lastIndex));
      }
      
      return parts.length > 0 ? parts : text;
    };
    
    const lines = content.split('\n');
    const elements = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Empty line - add spacing
      if (line.trim() === '') {
        elements.push(<div key={`space-${i}`} className="message-spacer" />);
        continue;
      }
      
      // Numbered list: "1. text" or "  1. text"
      const numberedMatch = line.match(/^(\s*)(\d+)\.\s+(.*)$/);
      if (numberedMatch) {
        const indent = numberedMatch[1].length;
        const number = numberedMatch[2];
        const content = numberedMatch[3];
        
        elements.push(
          <div key={`num-${i}`} className="message-numbered-item" style={{ marginLeft: `${indent * 8}px` }}>
            <span className="item-number">{number}.</span>
            <span className="item-content">{processBoldText(content, i)}</span>
          </div>
        );
        continue;
      }
      
      // Bullet list: "- text" or "  - text" or "• text"
      const bulletMatch = line.match(/^(\s*)[-•*]\s+(.*)$/);
      if (bulletMatch) {
        const indent = bulletMatch[1].length;
        const content = bulletMatch[2];
        
        elements.push(
          <div key={`bullet-${i}`} className="message-bullet-item" style={{ marginLeft: `${indent * 8}px` }}>
            <span className="item-bullet">•</span>
            <span className="item-content">{processBoldText(content, i)}</span>
          </div>
        );
        continue;
      }
      
      // Regular paragraph
      elements.push(
        <div key={`para-${i}`} className="message-paragraph">
          {processBoldText(line, i)}
        </div>
      );
    }
    
    return <div className="formatted-content">{elements}</div>;
  };

  return (
    <div className="team-chat-container">
      {/* Header */}
      <div className="team-chat-header">
        <div className="team-chat-header-left">
          <h1 className="team-chat-title">
            {departmentMode ? 'Department Chat' : 'Team Chat'}
          </h1>
          <p className="team-chat-subtitle">
            {departmentMode 
              ? `Chat with context from all units in ${selectedTeam?.name || 'this department'}`
              : 'Context-aware conversations powered by team knowledge'
            }
          </p>
        </div>

        {/* Team Selector */}
        {/* Team selector is in MissionControl header - removed duplicate */}
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
                  <div className="team-chat-welcome-container">
                    <div className="welcome-icon-wrapper">
                      <div className="icon-glow"></div>
                      <img src="/Jarvis.png" alt="Jarvis" className="welcome-icon" />
                    </div>

                    <div className="welcome-chat-section">
                      <div className="welcome-chat-prompt">
                        {departmentMode 
                          ? `What would you like to discuss about the ${selectedTeam.name} department?`
                          : `What would you like to discuss with ${selectedTeam.name}?`
                        }
                      </div>
                    </div>

                    <div className="welcome-context-items">
                      {departmentMode ? (
                        <>
                          <div className="welcome-context-card">
                            <div className="context-check">✓</div>
                            <div className="context-label">All units in {selectedTeam.name} ({selectedTeam.units?.length || 0} teams)</div>
                          </div>
                          <div className="welcome-context-card">
                            <div className="context-check">✓</div>
                            <div className="context-label">Cross-team meetings and department-wide discussions</div>
                          </div>
                          <div className="welcome-context-card">
                            <div className="context-check">✓</div>
                            <div className="context-label">Department-wide JIRA tickets and shared projects</div>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="welcome-context-card">
                            <div className="context-check">✓</div>
                            <div className="context-label">Recent team meetings and discussions</div>
                          </div>
                          <div className="welcome-context-card">
                            <div className="context-check">✓</div>
                            <div className="context-label">JIRA tickets assigned to this team</div>
                          </div>
                          <div className="welcome-context-card">
                            <div className="context-check">✓</div>
                            <div className="context-label">Codebase files related to your projects</div>
                          </div>
                        </>
                      )}
                    </div>
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
                      <div className="message-text">
                        {formatMessageContent(msg.content)}
                      </div>
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
                  placeholder={departmentMode 
                    ? `Ask about ${selectedTeam.name} department...`
                    : `Message ${selectedTeam.name}...`
                  }
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
