/**
 * useChat Hook
 * Manages chat state and communication with AI service via IPC
 */

import { useState, useCallback } from 'react';

export function useChat() {
  const [messages, setMessages] = useState([]);
  const [isTyping, setIsTyping] = useState(false);
  const [error, setError] = useState(null);

  /**
   * Send a message to the AI
   */
  const sendMessage = useCallback(async (content) => {
    if (!content.trim()) return;

    // Add user message immediately
    const userMessage = {
      id: Date.now().toString(),
      role: 'user',
      content,
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMessage]);
    setIsTyping(true);
    setError(null);

    try {
      // Send via Electron IPC
      const response = await window.electronAPI.chat.send(content);

      if (response.success) {
        // Add assistant response
        const assistantMessage = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: response.data.content,
          timestamp: response.data.timestamp
        };

        setMessages(prev => [...prev, assistantMessage]);
      } else {
        throw new Error(response.error || 'Failed to send message');
      }
    } catch (err) {
      console.error('Chat error:', err);
      setError(err.message);
      
      // Add error message
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date().toISOString()
      }]);
    } finally {
      setIsTyping(false);
    }
  }, []);

  /**
   * Clear chat history
   */
  const clearChat = useCallback(async () => {
    try {
      await window.electronAPI.chat.clear();
      setMessages([]);
      setError(null);
    } catch (err) {
      console.error('Clear chat error:', err);
      setError(err.message);
    }
  }, []);

  return {
    messages,
    isTyping,
    error,
    sendMessage,
    clearChat
  };
}

