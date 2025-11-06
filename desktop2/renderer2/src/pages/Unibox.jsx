import { useState, useEffect } from 'react';
import './Unibox.css';

/**
 * Unibox - Unified Inbox for Email, LinkedIn, Slack, Teams
 * 
 * Features:
 * - Multi-source inbox (Email, LinkedIn, Slack, Teams)
 * - Category filtering (All, Marketing, Sales)
 * - Source filtering (All, Email, LinkedIn)
 * - Status badges (Replied, Sent, Meeting scheduled)
 * - Search functionality
 * - Tabs: Inbox, Outcomes, Suggestions
 */
export default function Unibox() {
  const [activeTab, setActiveTab] = useState('inbox');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [messages, setMessages] = useState([]);
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [loading, setLoading] = useState(true);

  // Load messages on mount
  useEffect(() => {
    console.log('🎯 Unibox component mounted, loading messages...');
    loadMessages();
  }, []);

  const loadMessages = async () => {
    try {
      setLoading(true);
      console.log('📬 Loading unified inbox...');
      console.log('📬 electronAPI available?', !!window.electronAPI);
      console.log('📬 inbox API available?', !!window.electronAPI?.inbox);
      console.log('📬 getUnified available?', !!window.electronAPI?.inbox?.getUnified);
      
      if (!window.electronAPI?.inbox?.getUnified) {
        console.error('❌ Inbox API not available!');
        setLoading(false);
        return;
      }
      
      const result = await window.electronAPI.inbox.getUnified();
      
      console.log('📬 Inbox result:', result);
      
      if (result.success) {
        console.log('✅ Messages received:', result.messages?.length || 0);
        console.log('📬 Messages:', result.messages);
        setMessages(result.messages || []);
      } else {
        console.error('❌ Inbox fetch failed:', result.error);
      }
    } catch (error) {
      console.error('❌ Failed to load inbox:', error);
    } finally {
      setLoading(false);
    }
  };

  // Filter messages based on active filters
  const filteredMessages = messages.filter(msg => {
    // Category filter
    if (categoryFilter !== 'all' && msg.category?.toLowerCase() !== categoryFilter) {
      return false;
    }
    
    // Source filter
    if (sourceFilter !== 'all' && msg.source?.toLowerCase() !== sourceFilter) {
      return false;
    }
    
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        msg.company?.toLowerCase().includes(query) ||
        msg.subject?.toLowerCase().includes(query) ||
        msg.preview?.toLowerCase().includes(query) ||
        msg.from?.toLowerCase().includes(query)
      );
    }
    
    return true;
  });

  // Debug logs - these run on every render
  useEffect(() => {
    console.log('📬 RENDER: Total messages:', messages.length);
    console.log('📬 RENDER: Filtered messages:', filteredMessages.length);
    console.log('📬 RENDER: Filters:', { categoryFilter, sourceFilter, searchQuery });
    console.log('📬 RENDER: Loading state:', loading);
  }, [messages, filteredMessages, categoryFilter, sourceFilter, searchQuery, loading]);

  const getSourceIcon = (source) => {
    switch (source?.toLowerCase()) {
      case 'email':
        return (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
            <polyline points="22,6 12,13 2,6"></polyline>
          </svg>
        );
      case 'linkedin':
        return (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.32 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.79M6.88 8.56a1.68 1.68 0 0 0 1.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 0 0-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77z"/>
          </svg>
        );
      default:
        return null;
    }
  };

  const getStatusBadge = (status) => {
    if (!status) return null;
    
    const badges = {
      replied: { text: 'Replied', class: 'status-replied' },
      sent: { text: 'Sent', class: 'status-sent' },
      'meeting scheduled': { text: 'Meeting scheduled', class: 'status-meeting' }
    };
    
    const badge = badges[status.toLowerCase()];
    if (!badge) return null;
    
    return <span className={`status-badge ${badge.class}`}>{badge.text}</span>;
  };

  return (
    <div className="unibox-container">
      {/* Header */}
      <div className="unibox-header">
        <h1>Inbox</h1>
        
        {/* Tabs */}
        <div className="unibox-tabs">
          <button 
            className={`tab-btn ${activeTab === 'inbox' ? 'active' : ''}`}
            onClick={() => setActiveTab('inbox')}
          >
            Inbox
          </button>
          <button 
            className={`tab-btn ${activeTab === 'outcomes' ? 'active' : ''}`}
            onClick={() => setActiveTab('outcomes')}
          >
            Outcomes
          </button>
          <button 
            className={`tab-btn ${activeTab === 'suggestions' ? 'active' : ''}`}
            onClick={() => setActiveTab('suggestions')}
          >
            Suggestions
          </button>
        </div>

        {/* Search */}
        <div className="unibox-search">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"></circle>
            <path d="m21 21-4.35-4.35"></path>
          </svg>
          <input
            type="text"
            placeholder="Search company, subject, purpose"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Filters */}
      <div className="unibox-filters">
        {/* Category Filters */}
        <div className="filter-group">
          <button 
            className={`filter-btn ${categoryFilter === 'all' ? 'active' : ''}`}
            onClick={() => setCategoryFilter('all')}
          >
            All
          </button>
          <button 
            className={`filter-btn ${categoryFilter === 'marketing' ? 'active' : ''}`}
            onClick={() => setCategoryFilter('marketing')}
          >
            Marketing
          </button>
          <button 
            className={`filter-btn ${categoryFilter === 'sales' ? 'active' : ''}`}
            onClick={() => setCategoryFilter('sales')}
          >
            Sales
          </button>
        </div>

        {/* Source Filters */}
        <div className="filter-group">
          <button 
            className={`filter-btn ${sourceFilter === 'all' ? 'active' : ''}`}
            onClick={() => setSourceFilter('all')}
          >
            All
          </button>
          <button 
            className={`filter-btn ${sourceFilter === 'email' ? 'active' : ''}`}
            onClick={() => setSourceFilter('email')}
          >
            Email
          </button>
          <button 
            className={`filter-btn ${sourceFilter === 'linkedin' ? 'active' : ''}`}
            onClick={() => setSourceFilter('linkedin')}
          >
            LinkedIn
          </button>
        </div>
      </div>

      {/* Message List */}
      <div className="unibox-content">
        {loading ? (
          <div className="unibox-loading">
            <div className="spinner"></div>
            <p>Loading messages...</p>
          </div>
        ) : filteredMessages.length === 0 ? (
          <div className="unibox-empty">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
              <polyline points="22,6 12,13 2,6"></polyline>
            </svg>
            <p>No messages found</p>
            <span>Try adjusting your filters</span>
          </div>
        ) : (
          <div className="message-list">
            {filteredMessages.map((msg, index) => (
              <div 
                key={msg.id || index} 
                className={`message-item ${selectedMessage?.id === msg.id ? 'selected' : ''}`}
                onClick={() => setSelectedMessage(msg)}
              >
                {/* Avatar */}
                <div className="message-avatar">
                  {msg.avatar ? (
                    <img src={msg.avatar} alt={msg.company} />
                  ) : (
                    <div className="avatar-placeholder">
                      {msg.company?.charAt(0) || '?'}
                    </div>
                  )}
                </div>

                {/* Source Icon */}
                <div className="message-source-icon">
                  {getSourceIcon(msg.source)}
                </div>

                {/* Content */}
                <div className="message-content">
                  <div className="message-header">
                    <span className="message-company">{msg.company}</span>
                    <span className="message-email">{msg.from}</span>
                  </div>
                  <div className="message-subject">{msg.subject}</div>
                  <div className="message-preview">{msg.preview}</div>
                  <div className="message-timestamp">{msg.timestamp}</div>
                </div>

                {/* Tags and Status */}
                <div className="message-meta">
                  <div className="message-tags">
                    {msg.tags?.map((tag, idx) => (
                      <span key={idx} className="tag">{tag}</span>
                    ))}
                  </div>
                  {getStatusBadge(msg.status)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

