import { useEffect, useRef } from 'react';
import Message from './Message';
import './ChatContainer.css';

export default function ChatContainer({ messages, isTyping }) {
  const containerRef = useRef(null);

  useEffect(() => {
    // Auto-scroll to bottom when new messages arrive
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <div className="chat-container" ref={containerRef}>
      {messages.length === 0 ? (
        <div className="welcome-message">
          <div className="welcome-icon">✨</div>
          <div className="welcome-greeting">Welcome back!</div>
          <div className="welcome-subtitle">
            I can help with competitive intelligence, CRM insights, and Slack monitoring.
          </div>
        </div>
      ) : (
        messages.map((message, index) => (
          <Message key={message.id || index} {...message} />
        ))
      )}
      
      {isTyping && (
        <div className="typing-indicator">
          <div className="typing-avatar">🤖</div>
          <div className="typing-content">
            <span>HeyJarvis is thinking</span>
            <div className="typing-dots">
              <span></span>
              <span></span>
              <span></span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

