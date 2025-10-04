import { useState, useEffect, useRef } from 'react';
import './TaskChat.css';

export default function TaskChat({ task, onClose }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

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

  return (
    <div className="task-chat-overlay" onClick={onClose}>
      <div className="task-chat-modal" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="task-chat-header">
          <div className="task-chat-title">
            <span className="task-chat-icon">💬</span>
            <div className="task-chat-info">
              <div className="task-chat-name">Task Discussion</div>
              <div className="task-chat-subtitle">AI-powered task assistant</div>
            </div>
          </div>
          <button className="task-chat-close" onClick={onClose}>×</button>
        </div>

        {/* Task Context */}
        <div className="task-chat-context">
          <div className="task-context-label">Task Context:</div>
          <div className="task-context-content">
            <strong>{task.title}</strong>
            {task.description && <div className="task-context-desc">{task.description}</div>}
            <div className="task-context-meta">
              <span className={`priority-badge ${task.priority}`}>{task.priority}</span>
              <span className={`status-badge ${task.status}`}>{task.status}</span>
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="task-chat-messages">
          {messages.length === 0 ? (
            <div className="task-chat-welcome">
              <div className="welcome-icon">🎯</div>
              <div className="welcome-text">Let's work on this task together!</div>
              <div className="welcome-subtitle">
                I can help you brainstorm, plan, and complete this task.
              </div>
            </div>
          ) : (
            messages.map((msg, idx) => (
              <div key={idx} className={`task-message ${msg.role}`}>
                <div className="message-avatar">
                  {msg.role === 'user' ? '👤' : '🤖'}
                </div>
                <div className="message-content">
                  <div className="message-text">{msg.content}</div>
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

        {/* Input */}
        <div className="task-chat-input">
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Ask about this task, brainstorm ideas, get help..."
            rows={1}
            disabled={isTyping}
          />
          <button onClick={handleSend} disabled={!input.trim() || isTyping}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="m22 2-7 20-4-9-9-4z"/>
              <path d="M22 2 11 13"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

