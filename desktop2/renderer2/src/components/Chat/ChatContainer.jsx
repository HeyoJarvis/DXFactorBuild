import { useEffect, useRef, useState } from 'react';
import Message from './Message';
import './ChatContainer.css';

export default function ChatContainer({ messages, isTyping }) {
  const containerRef = useRef(null);
  const [teamContext, setTeamContext] = useState({
    meetings: [],
    tasks: [],
    codebaseFiles: []
  });

  useEffect(() => {
    // Auto-scroll to bottom when new messages arrive
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    // Load team context from window API if available
    if (window.electronAPI?.teamChat?.loadTeamContext) {
      loadTeamContext();
    }
  }, []);

  const loadTeamContext = async () => {
    try {
      // This would be called with actual team ID in real implementation
      // For now, we'll set sample data
      setTeamContext({
        meetings: [
          { id: 1, title: 'Recent team meetings and discussions', date: 'Today' },
        ],
        tasks: [
          { id: 1, title: 'JIRA tickets assigned to this team', count: '12' },
        ],
        codebaseFiles: [
          { id: 1, title: 'Codebase files related to your projects', count: '24' },
        ]
      });
    } catch (error) {
      console.error('Error loading team context:', error);
    }
  };

  if (messages.length === 0) {
    return (
      <div className="chat-container" ref={containerRef}>
        <div className="task-chat-empty">
          {/* Icon Section */}
          <div className="empty-icon-wrapper">
            <div className="icon-glow"></div>
            <div className="empty-icon">💼</div>
          </div>

          {/* Greeting Section */}
          <div className="chat-section">
            <div className="chat-prompt">What would you like to work on today?</div>
          </div>

          {/* Team Context Section */}
          <div className="team-context-items">
            {/* Meetings */}
            <div className="context-item-card">
              <div className="context-item-check">✓</div>
              <div className="context-item-content">
                <div className="context-item-title">Recent team meetings and discussions</div>
              </div>
            </div>

            {/* JIRA Tickets */}
            <div className="context-item-card">
              <div className="context-item-check">✓</div>
              <div className="context-item-content">
                <div className="context-item-title">JIRA tickets assigned to this team</div>
              </div>
            </div>

            {/* Codebase Files */}
            <div className="context-item-card">
              <div className="context-item-check">✓</div>
              <div className="context-item-content">
                <div className="context-item-title">Codebase files related to your projects</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="chat-container" ref={containerRef}>
      {messages.map((message, index) => (
        <Message key={message.id || index} {...message} />
      ))}
      
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

