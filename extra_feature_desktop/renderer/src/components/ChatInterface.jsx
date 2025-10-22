import React, { useState } from 'react';
import './ChatInterface.css';

function ChatInterface({ onSendMessage, disabled }) {
  const [message, setMessage] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (message.trim() && !disabled) {
      onSendMessage(message);
      setMessage('');
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <form className="chat-interface" onSubmit={handleSubmit}>
      <textarea
        className="chat-input"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        onKeyPress={handleKeyPress}
        placeholder="Ask a question about your team's work..."
        disabled={disabled}
        rows={1}
      />
      <button
        type="submit"
        className="chat-send-btn"
        disabled={!message.trim() || disabled}
      >
        {disabled ? '⏳' : '➤'}
      </button>
    </form>
  );
}

export default ChatInterface;


