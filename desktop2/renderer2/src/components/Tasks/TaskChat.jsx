import { useState, useEffect, useRef } from 'react';
import './TaskChat.css';

export default function TaskChat({ task, onClose }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [selectedModel, setSelectedModel] = useState('Sonnet 4.5');
  const [showModelDropdown, setShowModelDropdown] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const models = ['Sonnet 4.5', 'Sonnet 3.5', 'Opus 3', 'Haiku 3.5'];

  useEffect(() => {
    // Focus input on mount
    inputRef.current?.focus();
    
    // Load chat history for this task
    loadChatHistory();
  }, [task.id]);

  useEffect(() => {
    // Auto-scroll to bottom when messages change
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadChatHistory = async () => {
    try {
      const response = await window.electronAPI.tasks.getChatHistory(task.id);
      if (response.success && response.messages) {
        // Ensure all messages have string content
        const formattedMessages = response.messages.map(msg => ({
          role: msg.role,
          content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content),
          timestamp: msg.timestamp
        }));
        setMessages(formattedMessages);
      }
    } catch (error) {
      console.error('Failed to load chat history:', error);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isTyping) return;

    const userMessage = input.trim();
    setInput('');

    // Add user message immediately
    const newUserMessage = {
      role: 'user',
      content: userMessage,
      timestamp: new Date().toISOString()
    };
    setMessages(prev => [...prev, newUserMessage]);

    // Show typing indicator
    setIsTyping(true);

    try {
      const response = await window.electronAPI.tasks.sendChatMessage(task.id, userMessage, {
        task: {
          id: task.id,
          title: task.title,
          description: task.description,
          priority: task.priority,
          status: task.status,
          created_at: task.created_at
        }
      });

      if (response.success) {
        // Handle response - it might be a string or an object
        const messageContent = typeof response.message === 'string' 
          ? response.message 
          : response.message?.content || JSON.stringify(response.message);
        
        const aiMessage = {
          role: 'assistant',
          content: messageContent,
          timestamp: new Date().toISOString()
        };
        setMessages(prev => [...prev, aiMessage]);
      } else {
        throw new Error(response.error || 'Failed to send message');
      }
    } catch (error) {
      console.error('Chat error:', error);
      const errorMessage = {
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date().toISOString()
      };
      setMessages(prev => [...prev, errorMessage]);
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

  // Format date
  const formatDate = (dateString) => {
    if (!dateString) return 'Just now';
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  // Get priority label
  const getPriorityLabel = () => {
    const labels = {
      urgent: 'Urgent',
      high: 'High',
      medium: 'Medium',
      low: 'Low'
    };
    return labels[task.priority || 'medium'] || 'Medium';
  };

  return (
    <div className="task-chat-modal">
      <div className="task-chat-container">
        {/* Header - Task Card */}
        <div className="task-chat-header">
          <div className="task-chat-card">
            <button className="task-chat-close" onClick={onClose}>×</button>
            
            <div className="task-chat-card-header">
              <div className="task-chat-app-icon">
                <img 
                  src="/JIRALOGO.png" 
                  alt="JIRA" 
                  style={{ width: '24px', height: '24px', objectFit: 'contain' }}
                />
              </div>
              <div className="task-chat-title">
                <div className="task-chat-name">{task.title}</div>
                <div className="task-chat-subtitle">
                  {task.epicName && (
                    <span className="task-chat-meta-item">
                      {task.epicName}
                    </span>
                  )}
                  <span className="task-chat-meta-item">
                    {task.id}
                  </span>
                </div>
              </div>
            </div>
            
            <div className={`task-chat-priority-badge priority-${task.priority || 'medium'}`}>
              {getPriorityLabel()}
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="task-chat-messages">
          {/* User Story Section (if available) */}
          {task.userStory && (
            <div className="user-story-banner">
              <div className="story-banner-header">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path>
                  <circle cx="9" cy="7" r="4"></circle>
                  <path d="M22 21v-2a4 4 0 0 0-3-3.87"></path>
                  <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                </svg>
                <span>User Story</span>
              </div>
              <div className="story-content">
                <div className="story-row">
                  <span className="story-label">As a</span>
                  <span className="story-value">{task.userStory.asA}</span>
                </div>
                <div className="story-row">
                  <span className="story-label">When I</span>
                  <span className="story-value">{task.userStory.whenI}</span>
                </div>
                <div className="story-row">
                  <span className="story-label">So that</span>
                  <span className="story-value">{task.userStory.soThat}</span>
                </div>
              </div>
            </div>
          )}

          {messages.length === 0 ? (
            <div className="task-chat-welcome">
              <div className="welcome-text">Let's work on this task together!</div>
              <div className="welcome-subtitle">
                I can help you brainstorm, plan, and complete this task.
              </div>
            </div>
          ) : (
            messages.map((msg, idx) => (
              <div key={idx} className={`task-message ${msg.role}`}>
                <div className="task-message-bubble">
                  {msg.content}
                </div>
              </div>
            ))
          )}
          {isTyping && (
            <div className="task-chat-typing">
              <div className="typing-indicator">
                <span></span>
                <span></span>
                <span></span>
              </div>
              <span>Thinking about your task...</span>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area with Controls */}
        <div className="task-chat-input-wrapper">
          <div className="task-chat-input-container">
            {/* Left Controls */}
            <div className="chat-input-controls-left">
              <button className="chat-control-btn" title="Add attachment">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19"></line>
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                </svg>
              </button>
              <button className="chat-control-btn" title="Filter">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="4" y1="21" x2="4" y2="14"></line>
                  <line x1="4" y1="10" x2="4" y2="3"></line>
                  <line x1="12" y1="21" x2="12" y2="12"></line>
                  <line x1="12" y1="8" x2="12" y2="3"></line>
                  <line x1="20" y1="21" x2="20" y2="16"></line>
                  <line x1="20" y1="12" x2="20" y2="3"></line>
                  <line x1="1" y1="14" x2="7" y2="14"></line>
                  <line x1="9" y1="8" x2="15" y2="8"></line>
                  <line x1="17" y1="16" x2="23" y2="16"></line>
                </svg>
              </button>
              <button className="chat-control-btn" title="Extended search">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8"></circle>
                  <path d="m21 21-4.35-4.35"></path>
                  <path d="M11 8v6"></path>
                  <path d="M8 11h6"></path>
                </svg>
              </button>
            </div>

            {/* Text Input */}
            <textarea
              ref={inputRef}
              className="task-chat-textarea"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="How can I help you today?"
              rows={1}
              disabled={isTyping}
            />

            {/* Right Controls */}
            <div className="chat-input-controls-right">
              {/* Model Selector */}
              <div className="model-selector-wrapper">
                <button 
                  className="model-selector-btn"
                  onClick={() => setShowModelDropdown(!showModelDropdown)}
                  title="Select model"
                >
                  <span className="model-name">{selectedModel}</span>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="6 9 12 15 18 9"></polyline>
                  </svg>
                </button>
                {showModelDropdown && (
                  <div className="model-dropdown">
                    {models.map(model => (
                      <button
                        key={model}
                        className={`model-option ${selectedModel === model ? 'active' : ''}`}
                        onClick={() => {
                          setSelectedModel(model);
                          setShowModelDropdown(false);
                        }}
                      >
                        {model}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Send Button */}
              <button 
                className="task-chat-send-btn"
                onClick={handleSend} 
                disabled={!input.trim() || isTyping}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/>
                  <polyline points="12 16 16 12 12 8"/>
                  <line x1="8" y1="12" x2="16" y2="12"/>
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
