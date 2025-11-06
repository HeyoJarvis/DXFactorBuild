import { useState, useRef, useEffect } from 'react';
import './UniversalChatBar.css';

/**
 * UniversalChatBar - Persistent chat bar at bottom with GitHub/Confluence integration
 * 
 * Features:
 * - Simple text input
 * - GitHub repository connection
 * - Confluence documentation button
 * - File attachment
 * - Context indicator when task is selected
 */
export default function UniversalChatBar({ selectedTask, user, onTaskSelect }) {
  const [input, setInput] = useState('');
  const [showRepoSelector, setShowRepoSelector] = useState(false);
  const [connectedRepo, setConnectedRepo] = useState(null);
  const [availableRepositories, setAvailableRepositories] = useState([]);
  const [isTyping, setIsTyping] = useState(false);
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);

  // Load available repositories when repo selector is opened
  const loadAvailableRepositories = async () => {
    try {
      const result = await window.electronAPI?.codeIndexer?.listIndexedRepositories?.();
      if (result?.success) {
        setAvailableRepositories(result.repositories.map(r => r.full_name));
      }
    } catch (error) {
      console.error('Failed to load repositories:', error);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isTyping) return;
    if (!selectedTask) {
      alert('Please select a task from the carousel first');
      return;
    }

    const userMessage = input.trim();
    setInput('');
    setIsTyping(true);

    try {
      const response = await window.electronAPI.tasks.sendChatMessage(selectedTask.id, userMessage, {
        task: {
          id: selectedTask.id,
          title: selectedTask.title,
          description: selectedTask.description,
          priority: selectedTask.priority,
          status: selectedTask.status,
          route_to: selectedTask.route_to || 'mission-control',
          work_type: selectedTask.work_type || 'task'
        },
        repository: connectedRepo
      });

      if (response.success) {
        console.log('✅ Message sent successfully');
        // Clear repo connection after sending
        setConnectedRepo(null);
      } else {
        alert('Failed to send message: ' + response.error);
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      alert('Failed to send message');
    } finally {
      setIsTyping(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleRepoSelect = (repo) => {
    setConnectedRepo(repo);
    setShowRepoSelector(false);
  };

  return (
    <div className="universal-chat-bar">
      {/* Context Indicator */}
      {selectedTask && (
        <div className="chat-context-indicator">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
          </svg>
          <span>Chatting about: {selectedTask.external_key || selectedTask.title}</span>
          <button className="clear-context" onClick={() => onTaskSelect(null)}>×</button>
        </div>
      )}

      {/* Repository Connection Status */}
      {connectedRepo && (
        <div className="repo-connection-status">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"></path>
          </svg>
          <span>Connected: {connectedRepo}</span>
          <button onClick={() => setConnectedRepo(null)}>×</button>
        </div>
      )}

      <div className="chat-input-container">
        {/* Left Controls */}
        <div className="chat-controls-left">
          <button
            className="chat-control-btn"
            title="Add files"
            onClick={() => fileInputRef.current?.click()}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
          </button>

          <button
            className={`chat-control-btn ${connectedRepo ? 'active' : ''}`}
            title={connectedRepo ? `Connected: ${connectedRepo}` : "Connect to GitHub repository"}
            onClick={() => {
              if (!showRepoSelector) {
                loadAvailableRepositories();
              }
              setShowRepoSelector(!showRepoSelector);
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"></path>
            </svg>
          </button>

          <button className="chat-control-btn" title="Create Confluence documentation">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
            </svg>
          </button>
        </div>

        {/* Text Input */}
        <textarea
          ref={inputRef}
          className="chat-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={selectedTask ? "Ask about this task..." : "Select a task to chat..."}
          rows={1}
          disabled={isTyping || !selectedTask}
        />

        {/* Send Button */}
        <button
          className="send-button"
          onClick={handleSend}
          disabled={!input.trim() || isTyping || !selectedTask}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="22" y1="2" x2="11" y2="13"></line>
            <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
          </svg>
        </button>
      </div>

      {/* Repository Selector Modal */}
      {showRepoSelector && (
        <div className="repo-selector-modal">
          <div className="repo-selector-header">
            <span>Select Repository</span>
            <button onClick={() => setShowRepoSelector(false)}>×</button>
          </div>
          <div className="repo-selector-list">
            {availableRepositories.length > 0 ? (
              availableRepositories.map(repo => (
                <button
                  key={repo}
                  className="repo-option"
                  onClick={() => handleRepoSelect(repo)}
                >
                  {repo}
                </button>
              ))
            ) : (
              <div className="no-repos">No indexed repositories found</div>
            )}
          </div>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        style={{ display: 'none' }}
        multiple
      />
    </div>
  );
}

