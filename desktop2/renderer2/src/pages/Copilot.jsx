import { useChat } from '../hooks/useChat';
import { useEffect, useRef } from 'react';
import StatusBar from '../components/common/StatusBar';
import ChatContainer from '../components/Chat/ChatContainer';
import InputBox from '../components/Chat/InputBox';
import QuickActions from '../components/common/QuickActions';
import DraggableHeader from '../components/common/DraggableHeader';
import './Copilot.css';

export default function Copilot({ systemStatus, initialMessage }) {
  const { messages, isTyping, sendMessage } = useChat();
  const initialMessageSent = useRef(false);

  const handleSendMessage = async (message) => {
    await sendMessage(message);
  };

  const handleQuickAction = (message) => {
    sendMessage(message);
  };

  // Send initial message if provided (only once)
  useEffect(() => {
    if (initialMessage && !initialMessageSent.current) {
      console.log('🚀 Sending initial message from header:', initialMessage);
      sendMessage(initialMessage);
      initialMessageSent.current = true;
    }
  }, [initialMessage, sendMessage]);

  // Reset the flag when initialMessage changes to null
  useEffect(() => {
    if (!initialMessage) {
      initialMessageSent.current = false;
    }
  }, [initialMessage]);

  return (
    <div className="copilot-page">
      {/* Draggable Window Controls */}
      <DraggableHeader title="Copilot" />

      <div className="copilot-content">
        <ChatContainer messages={messages} isTyping={isTyping} />
        
        {messages.length === 0 && (
          <div className="welcome-actions">
            <QuickActions onActionClick={handleQuickAction} />
          </div>
        )}
      </div>

      <InputBox onSend={handleSendMessage} disabled={isTyping} />
      
      <StatusBar systemStatus={systemStatus} />
    </div>
  );
}
