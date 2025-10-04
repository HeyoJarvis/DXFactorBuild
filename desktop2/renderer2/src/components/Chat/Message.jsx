import './Message.css';

export default function Message({ role, content, timestamp }) {
  const isUser = role === 'user';
  const avatar = isUser ? '👤' : '🤖';
  
  const formatTime = (ts) => {
    if (!ts) return '';
    const date = new Date(ts);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className={`message ${role}`}>
      <div className="message-avatar">{avatar}</div>
      <div className="message-content">
        <div className="message-text">{content}</div>
        {timestamp && (
          <div className="message-time">{formatTime(timestamp)}</div>
        )}
      </div>
    </div>
  );
}

