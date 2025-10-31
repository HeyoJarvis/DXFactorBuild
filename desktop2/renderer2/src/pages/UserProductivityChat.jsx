import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import './UserProductivityChat.css';

/**
 * User Productivity Chat - Chat interface for tracking and analyzing user productivity
 * Includes context from tasks, GitHub activity, and meetings
 */
export default function UserProductivityChat({ user }) {
  const { userId } = useParams();
  const navigate = useNavigate();
  
  const [targetUser, setTargetUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [contextSummary, setContextSummary] = useState(null);
  const [contextDetails, setContextDetails] = useState(null);
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

  // Load user info and chat history
  useEffect(() => {
    if (userId) {
      loadUserInfo();
      loadChatHistory();
    }
  }, [userId]);

  const loadUserInfo = async () => {
    try {
      if (!window.electronAPI?.userChat?.getUserInfo) {
        console.error('User Chat API not available');
        return;
      }

      const result = await window.electronAPI.userChat.getUserInfo(userId);

      if (result.success) {
        setTargetUser(result.user);
      } else {
        console.error('Failed to load user info:', result.error);
      }
    } catch (error) {
      console.error('Error loading user info:', error);
    }
  };

  const loadChatHistory = async () => {
    try {
      setIsLoading(true);

      if (!window.electronAPI?.userChat?.getHistory) {
        console.error('User Chat API not available');
        return;
      }

      const result = await window.electronAPI.userChat.getHistory(userId);

      if (result.success) {
        setMessages(result.messages || []);
        setContextSummary(result.context);
        setContextDetails(result.contextDetails || null);
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

  const loadContext = async () => {
    try {
      if (!window.electronAPI?.userChat?.loadContext) {
        console.error('User Chat API not available');
        return;
      }

      const result = await window.electronAPI.userChat.loadContext(userId);

      if (result.success) {
        setContextSummary(result.summary);
        setContextDetails(result.context || null);
      } else {
        console.error('Failed to load context:', result.error);
      }
    } catch (error) {
      console.error('Error loading context:', error);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();

    if (!inputMessage.trim() || !userId || isSending) {
      return;
    }

    const userMessage = inputMessage.trim();
    setInputMessage('');
    setIsSending(true);

    // Add user message to UI immediately
    const newUserMessage = {
      role: 'user',
      content: userMessage,
      timestamp: new Date().toISOString()
    };
    setMessages(prev => [...prev, newUserMessage]);

    try {
      if (!window.electronAPI?.userChat?.sendMessage) {
        console.error('User Chat API not available');
        return;
      }

      const result = await window.electronAPI.userChat.sendMessage(userId, userMessage);

      if (result.success) {
        // Add AI response to UI
        const aiMessage = {
          role: 'assistant',
          content: result.response,
          timestamp: new Date().toISOString()
        };
        setMessages(prev => [...prev, aiMessage]);
      } else {
        console.error('Failed to send message:', result.error);
        // Show error message
        const errorMessage = {
          role: 'assistant',
          content: `Error: ${result.error}`,
          timestamp: new Date().toISOString()
        };
        setMessages(prev => [...prev, errorMessage]);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      const errorMessage = {
        role: 'assistant',
        content: `Error: ${error.message}`,
        timestamp: new Date().toISOString()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsSending(false);
    }
  };

  const handleBack = () => {
    navigate('/admin');
  };

  return (
    <div className="user-productivity-chat">
      {/* Header */}
      <div className="user-chat-header">
        <button className="back-button" onClick={handleBack}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
        </button>
        <div className="user-chat-title">
          <div className="user-avatar">
            {targetUser?.name?.[0]?.toUpperCase() || 'U'}
          </div>
          <div>
            <h2>{targetUser?.name || 'Loading...'}</h2>
            <p className="user-subtitle">Productivity Chat</p>
          </div>
        </div>
        <button className="refresh-button" onClick={loadContext} disabled={isLoading}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/>
          </svg>
        </button>
      </div>

      {/* Main Content */}
      <div className="user-chat-content">
        {/* Context Sidebar */}
        <div className="user-chat-sidebar">
          <div className="context-section">
            <h3>📊 Context Overview</h3>
            {contextDetails ? (
              <>
                <div className="context-stat">
                  <span className="stat-label">Active Tasks</span>
                  <span className="stat-value">{contextDetails.tasks?.length || 0}</span>
                </div>
                <div className="context-stat">
                  <span className="stat-label">GitHub Activity</span>
                  <span className="stat-value">{contextDetails.github_activity?.length || 0}</span>
                </div>
                <div className="context-stat">
                  <span className="stat-label">Meetings</span>
                  <span className="stat-value">{contextDetails.meetings?.length || 0}</span>
                </div>
              </>
            ) : (
              <p className="context-empty">Loading context...</p>
            )}
          </div>

          {/* Tasks List */}
          {contextDetails?.tasks && contextDetails.tasks.length > 0 && (
            <div className="context-section">
              <h3>📋 Active Tasks</h3>
              <div className="context-list">
                {contextDetails.tasks.slice(0, 10).map((task, idx) => (
                  <div key={idx} className="context-item">
                    <div className="context-item-header">
                      <span className="task-key">{task.external_key || task.id}</span>
                      {task.status && (
                        <span className={`task-status status-${task.status.toLowerCase().replace(/\s+/g, '-')}`}>
                          {task.status}
                        </span>
                      )}
                    </div>
                    <p className="context-item-title">{task.title}</p>
                    {task.source && (
                      <span className="task-source">{task.source.toUpperCase()}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* GitHub Activity */}
          {contextDetails?.github_activity && contextDetails.github_activity.length > 0 && (
            <div className="context-section">
              <h3>💻 GitHub Activity</h3>
              <div className="context-list">
                {contextDetails.github_activity.slice(0, 5).map((activity, idx) => (
                  <div key={idx} className="context-item">
                    <div className="context-item-header">
                      <span className="activity-type">{activity.type}</span>
                    </div>
                    <p className="context-item-title">{activity.title}</p>
                    {activity.repository && (
                      <span className="activity-repo">{activity.repository}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Chat Messages */}
        <div className="user-chat-messages-container">
          {isLoading ? (
            <div className="loading-container">
              <div className="loading-spinner"></div>
              <p>Loading chat history...</p>
            </div>
          ) : messages.length === 0 ? (
            <div className="empty-state">
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
              </svg>
              <h3>Start a Productivity Conversation</h3>
              <p>Ask about {targetUser?.name || 'this user'}'s tasks, progress, or GitHub activity</p>
            </div>
          ) : (
            <div className="user-chat-messages" ref={messagesContainerRef}>
              {messages.map((msg, idx) => (
                <div key={idx} className={`message ${msg.role}`}>
                  <div className="message-content">
                    {msg.content}
                  </div>
                  <div className="message-timestamp">
                    {new Date(msg.timestamp).toLocaleTimeString()}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}

          {/* Input Form */}
          <form className="user-chat-input-form" onSubmit={handleSendMessage}>
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              placeholder={`Ask about ${targetUser?.name || 'user'}'s productivity...`}
              disabled={isSending || isLoading}
              className="user-chat-input"
            />
            <button
              type="submit"
              disabled={!inputMessage.trim() || isSending || isLoading}
              className="user-chat-send-button"
            >
              {isSending ? (
                <div className="button-spinner"></div>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="22" y1="2" x2="11" y2="13"></line>
                  <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                </svg>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

