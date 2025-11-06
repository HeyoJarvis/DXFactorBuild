import { useState, useEffect } from 'react';
import './UniboxCarousel.css';

/**
 * UniboxCarousel - Displays unified inbox messages in a list format
 * Shows emails from Gmail, Outlook, LinkedIn, etc.
 */
export default function UniboxCarousel({ onSelectMessage }) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [hideMarketing, setHideMarketing] = useState(true); // Default to hiding marketing emails
  const [whitelistedEmails, setWhitelistedEmails] = useState([]);
  const [showWhitelistModal, setShowWhitelistModal] = useState(false);
  const [newWhitelistEmail, setNewWhitelistEmail] = useState('');

  useEffect(() => {
    loadMessages();
  }, []);

  const loadMessages = async () => {
    try {
      setLoading(true);
      console.log('📬 UniboxCarousel: Loading messages...');
      
      // Request up to 500 emails (increased from default 50)
      const result = await window.electronAPI.inbox.getUnified({
        maxResults: 500,
        includeSources: ['email', 'linkedin']
      });
      
      console.log('📬 UniboxCarousel: Result:', result);
      
      if (result.success && result.messages) {
        console.log('📬 UniboxCarousel: Loaded', result.messages.length, 'messages');
        console.log('📬 UniboxCarousel: Sample message data:', result.messages[0]);
        console.log('📬 UniboxCarousel: Message fields:', {
          company: result.messages[0]?.company,
          from: result.messages[0]?.from,
          subject: result.messages[0]?.subject,
          preview: result.messages[0]?.preview
        });
        setMessages(result.messages);
      }
    } catch (error) {
      console.error('📬 UniboxCarousel: Error loading messages:', error);
    } finally {
      setLoading(false);
    }
  };

  // Check if email is from workspace domain or whitelisted
  const isWhitelisted = (msg) => {
    const from = (msg.from || '').toLowerCase();
    const workspaceDomain = 'heyjarvis.ai'; // Your workspace domain
    
    // Check if from workspace domain
    if (from.includes(`@${workspaceDomain}`)) {
      return true;
    }
    
    // Check if in whitelist
    return whitelistedEmails.some(email => from.includes(email.toLowerCase()));
  };

  // Function to detect marketing/advertising emails with aggressive filtering
  const isMarketingEmail = (msg) => {
    // PRIORITY 1: Always allow whitelisted emails
    if (isWhitelisted(msg)) {
      return false; // Not marketing, always show
    }
    
    const subject = (msg.subject || '').toLowerCase();
    const preview = (msg.preview || '').toLowerCase();
    const from = (msg.from || '').toLowerCase();
    const body = (msg.body || '').toLowerCase();
    const company = (msg.company || '').toLowerCase();
    
    // PRIORITY 2: Known marketing/product companies (aggressive list)
    const marketingCompanies = [
      'canva', 'vercel', 'notion', 'figma', 'slack', 'github',
      'mailchimp', 'hubspot', 'salesforce', 'zendesk', 'intercom',
      'stripe', 'shopify', 'squarespace', 'wix', 'wordpress',
      'linkedin', 'twitter', 'facebook', 'instagram', 'tiktok',
      'youtube', 'medium', 'substack', 'grammarly', 'dropbox',
      'google cloud', 'aws', 'azure', 'heroku', 'netlify',
      'airtable', 'asana', 'trello', 'monday.com', 'clickup',
      'zoom', 'calendly', 'loom', 'miro', 'lucidchart',
      'atlassian', 'jira', 'confluence', 'bitbucket', 'sourcetree',
      'docker', 'kubernetes', 'mongodb', 'redis', 'postgresql',
      'amplitude', 'mixpanel', 'segment', 'datadog', 'sentry',
      'twilio', 'sendgrid', 'postmark', 'mailgun', 'sparkpost',
      'algolia', 'elastic', 'cloudflare', 'fastly', 'akamai',
      'auth0', 'okta', 'onelogin', 'duo', 'lastpass',
      'adobe', 'sketch', 'invision', 'zeplin', 'abstract',
      'framer', 'webflow', 'bubble', 'zapier', 'ifttt',
      'typeform', 'surveymonkey', 'qualtrics', 'hotjar', 'fullstory',
      'intercom', 'drift', 'crisp', 'freshdesk', 'helpscout'
    ];
    
    const isFromMarketingCompany = marketingCompanies.some(comp => 
      from.includes(comp) || company.includes(comp)
    );
    
    // PRIORITY 3: Strong marketing indicators (high confidence)
    const strongMarketingKeywords = [
      'unsubscribe', 'opt-out', 'opt out', 'click here to unsubscribe',
      'manage preferences', 'update email preferences', 'promotional',
      'this email was sent to', 'you are receiving this email because',
      'view in browser', 'view this email in your browser'
    ];
    
    const hasStrongMarketingIndicator = strongMarketingKeywords.some(keyword => 
      body.includes(keyword) || preview.includes(keyword) || subject.includes(keyword)
    );
    
    if (hasStrongMarketingIndicator) {
      return true; // Definitely marketing
    }
    
    // PRIORITY 4: Marketing sender patterns (aggressive)
    const marketingSenders = [
      'noreply@', 'no-reply@', 'donotreply@', 'do-not-reply@',
      'marketing@', 'newsletter@', 'notifications@', 'hello@',
      'info@', 'support@', 'team@', 'updates@', 'news@',
      'announce@', 'digest@', 'alerts@', 'welcome@', 'onboarding@'
    ];
    
    const hasMarketingSender = marketingSenders.some(pattern => from.includes(pattern));
    
    // PRIORITY 5: Subject line marketing keywords
    const subjectMarketingKeywords = [
      'limited time', 'special offer', 'exclusive', 'discount', 'sale',
      'save now', 'act now', 'free shipping', 'deal', 'promo', 'coupon',
      '% off', 'shop now', 'buy now', 'order now', 'claim your',
      'new feature', 'product update', 'whats new', "what's new",
      'tips and tricks', 'getting started', 'welcome to', 'thanks for signing up',
      'weekly digest', 'monthly update', 'newsletter', 'announcement'
    ];
    
    const hasMarketingSubject = subjectMarketingKeywords.some(keyword => 
      subject.includes(keyword)
    );
    
    // PRIORITY 6: Aggressive scoring system
    let marketingScore = 0;
    
    if (isFromMarketingCompany) marketingScore += 4; // Companies like Canva, Vercel
    if (hasMarketingSender) marketingScore += 3;
    if (hasMarketingSubject) marketingScore += 3;
    if (body.includes('unsubscribe') || preview.includes('unsubscribe')) marketingScore += 5;
    if (from.includes('noreply') || from.includes('no-reply')) marketingScore += 4;
    if (subject.includes('update') || subject.includes('announcement')) marketingScore += 2;
    if (subject.includes('new') && (subject.includes('feature') || subject.includes('product'))) marketingScore += 3;
    
    // Check for personal indicators (reduce score significantly)
    const personalIndicators = ['re:', 'fwd:', 'meeting', 'call', 'schedule', 'urgent', 'invoice', 'payment', 'receipt'];
    const hasPersonalIndicator = personalIndicators.some(indicator => subject.includes(indicator));
    if (hasPersonalIndicator) marketingScore -= 5;
    
    // Check if it's a direct personal email (no marketing score if from a person)
    const looksPersonal = !from.includes('noreply') && 
                          !from.includes('no-reply') && 
                          !from.includes('@notifications') &&
                          !hasMarketingSender &&
                          !isFromMarketingCompany;
    
    if (looksPersonal && marketingScore < 5) {
      return false; // Likely personal
    }
    
    // Lower threshold: 3 or more = marketing (more aggressive)
    return marketingScore >= 3;
  };

  // Add email to whitelist
  const addToWhitelist = () => {
    if (newWhitelistEmail && newWhitelistEmail.includes('@')) {
      setWhitelistedEmails([...whitelistedEmails, newWhitelistEmail.toLowerCase()]);
      setNewWhitelistEmail('');
      setShowWhitelistModal(false);
      
      // Save to localStorage
      localStorage.setItem('inbox-whitelist', JSON.stringify([...whitelistedEmails, newWhitelistEmail.toLowerCase()]));
    }
  };

  // Remove from whitelist
  const removeFromWhitelist = (email) => {
    const updated = whitelistedEmails.filter(e => e !== email);
    setWhitelistedEmails(updated);
    localStorage.setItem('inbox-whitelist', JSON.stringify(updated));
  };

  // Load whitelist from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('inbox-whitelist');
    if (saved) {
      try {
        setWhitelistedEmails(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to load whitelist:', e);
      }
    }
  }, []);

  // Filter messages based on search query and marketing filter
  const filteredMessages = messages.filter(msg => {
    // Marketing filter
    if (hideMarketing && isMarketingEmail(msg)) {
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

  const getSourceIcon = (message) => {
    const source = message.source?.toLowerCase();
    const from = message.from?.toLowerCase() || '';
    
    // Check if it's a Gmail message
    if (source === 'email' && (from.includes('@gmail.com') || message.provider === 'gmail')) {
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <path d="M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.64l-6.545-4.91v9.273H1.636A1.636 1.636 0 0 1 0 19.366V5.457c0-2.023 2.309-3.178 3.927-1.964L5.455 4.64 12 9.548l6.545-4.91 1.528-1.145C21.69 2.28 24 3.434 24 5.457z" fill="#EA4335"/>
          <path d="M0 5.457v.727l12 9 12-9v-.727c0-2.023-2.309-3.178-3.927-1.964L12 9.548 3.927 3.493C2.31 2.28 0 3.434 0 5.457z" fill="#FBBC05"/>
          <path d="M12 16.64l-6.545-4.91v9.273h13.09V11.73z" fill="#34A853"/>
          <path d="M18.545 11.73L12 16.64V9.548l6.545-4.91z" fill="#4285F4"/>
          <path d="M5.455 11.73L12 16.64V9.548l-6.545-4.91z" fill="#C5221F"/>
        </svg>
      );
    }
    
    // Check if it's an Outlook/Microsoft message
    if (source === 'email' && (from.includes('@outlook.com') || from.includes('@hotmail.com') || from.includes('microsoft.com') || message.provider === 'outlook')) {
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <path d="M24 7.387v9.226a3.387 3.387 0 0 1-3.387 3.387h-2.258a3.387 3.387 0 0 1-3.387-3.387V7.387A3.387 3.387 0 0 1 18.355 4h2.258A3.387 3.387 0 0 1 24 7.387z" fill="#0364B8"/>
          <path d="M14.968 4v5.419L9.613 12l5.355 2.581V20H3.387A3.387 3.387 0 0 1 0 16.613V7.387A3.387 3.387 0 0 1 3.387 4h11.581z" fill="#0078D4"/>
          <path d="M14.968 9.419V4h-3.226v16h3.226v-5.419L9.613 12z" fill="#28A8EA"/>
          <path d="M14.968 14.581L9.613 12l5.355-2.581z" fill="#0078D4"/>
          <path d="M7.484 7.548c-2.043 0-3.71 1.667-3.71 3.71s1.667 3.71 3.71 3.71c2.043 0 3.71-1.667 3.71-3.71s-1.667-3.71-3.71-3.71zm0 6.194c-1.37 0-2.484-1.114-2.484-2.484s1.114-2.484 2.484-2.484 2.484 1.114 2.484 2.484-1.114 2.484-2.484 2.484z" fill="#FFF"/>
        </svg>
      );
    }
    
    // LinkedIn
    if (source === 'linkedin') {
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="#0A66C2">
          <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.32 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.79M6.88 8.56a1.68 1.68 0 0 0 1.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 0 0-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77z"/>
        </svg>
      );
    }
    
    // Default email icon
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
        <polyline points="22,6 12,13 2,6"></polyline>
      </svg>
    );
  };

  if (loading) {
    return (
      <div className="unibox-inbox">
        <div className="inbox-loading">
          <div className="spinner"></div>
          <p>Loading messages...</p>
        </div>
      </div>
    );
  }

  // Handle message click - show email detail view
  const handleMessageClick = (message) => {
    console.log('📧 Email clicked:', message);
    setSelectedMessage(message);
    console.log('📧 Selected message state updated');
  };

  // Handle back to list
  const handleBackToList = () => {
    setSelectedMessage(null);
  };

  // If a message is selected, show the email detail view
  if (selectedMessage) {
    console.log('📧 Rendering email detail view for:', selectedMessage.subject);
    return (
      <div className="unibox-inbox">
        <div className="email-detail-view">
          {/* Header */}
          <div className="email-detail-header">
            <button className="back-btn" onClick={handleBackToList}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="15 18 9 12 15 6"></polyline>
              </svg>
              Back to Inbox
            </button>
            
            <div className="email-actions">
              <button className="action-btn">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="3 6 5 6 21 6"></polyline>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                </svg>
                Delete
              </button>
              <button className="action-btn">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                  <polyline points="22,6 12,13 2,6"></polyline>
                </svg>
                Reply
              </button>
              <button className="action-btn primary">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 2L11 13"></path>
                  <path d="M22 2l-7 20-4-9-9-4 20-7z"></path>
                </svg>
                Forward
              </button>
            </div>
          </div>

          {/* Email Content */}
          <div className="email-detail-content">
            <div className="email-detail-meta">
              <div className="email-detail-from">
                <div className="email-avatar">
                  {selectedMessage.avatar ? (
                    <img src={selectedMessage.avatar} alt={selectedMessage.company} />
                  ) : (
                    <div className="avatar-placeholder">
                      {selectedMessage.company?.charAt(0) || '?'}
                    </div>
                  )}
                </div>
                <div className="email-from-info">
                  <div className="email-from-name">{selectedMessage.company || 'Unknown Sender'}</div>
                  <div className="email-from-address">{selectedMessage.from}</div>
                </div>
                <div className="email-provider-icon">
                  {getSourceIcon(selectedMessage)}
                </div>
              </div>
              
              <div className="email-detail-subject">{selectedMessage.subject}</div>
              <div className="email-detail-timestamp">{selectedMessage.timestamp}</div>
              
              {selectedMessage.tags && selectedMessage.tags.length > 0 && (
                <div className="email-detail-tags">
                  {selectedMessage.tags.map((tag, idx) => (
                    <span key={idx} className="tag">{tag}</span>
                  ))}
                </div>
              )}
            </div>

            <div className="email-detail-body">
              {selectedMessage.bodyHtml ? (
                <div 
                  dangerouslySetInnerHTML={{ __html: selectedMessage.bodyHtml }}
                  className="email-html-content"
                />
              ) : (
                <div className="email-text-content">
                  {selectedMessage.body || selectedMessage.preview || 'No content available'}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="unibox-inbox">
      {/* Header */}
      <div className="inbox-header">
        <div className="inbox-header-top">
          <h1>Inbox</h1>
          
          <div className="header-actions">
            {/* Whitelist Button */}
            <button 
              className="whitelist-btn"
              onClick={() => setShowWhitelistModal(true)}
              title="Manage allowed senders"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                <circle cx="8.5" cy="7" r="4"></circle>
                <line x1="20" y1="8" x2="20" y2="14"></line>
                <line x1="23" y1="11" x2="17" y2="11"></line>
              </svg>
              Allowed ({whitelistedEmails.length})
            </button>
            
            {/* Marketing Filter Toggle */}
            <button 
              className={`marketing-filter-btn ${hideMarketing ? 'active' : ''}`}
              onClick={() => setHideMarketing(!hideMarketing)}
              title={hideMarketing ? 'Marketing emails hidden' : 'Showing all emails'}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                <polyline points="9 22 9 12 15 12 15 22"></polyline>
              </svg>
              {hideMarketing ? (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                  Hide Marketing
                </>
              ) : (
                'Show All'
              )}
            </button>
          </div>
        </div>
        
        {/* Search */}
        <div className="inbox-search">
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

        {/* Tabs */}
        <div className="inbox-tabs">
          <button className="tab-btn active">Inbox</button>
          <button className="tab-btn">Outcomes</button>
          <button className="tab-btn">Suggestions</button>
        </div>
      </div>

      {/* Inbox Section Header */}
      <div className="inbox-section-header">
        <h3>All Messages</h3>
        <span className="message-count">{filteredMessages.length} messages</span>
      </div>

      {/* Message List */}
      <div className="inbox-content">
        {filteredMessages.length === 0 ? (
          <div className="inbox-empty">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
              <polyline points="22,6 12,13 2,6"></polyline>
            </svg>
            <p>No messages found</p>
            <span>Try adjusting your filters</span>
          </div>
        ) : (
          <div className="message-list">
            {/* Debug: Log first message structure */}
            {filteredMessages.length > 0 && console.log('📧 First filtered message:', filteredMessages[0])}
            {filteredMessages.length > 0 && console.log('📧 Message fields:', {
              company: filteredMessages[0]?.company,
              from: filteredMessages[0]?.from,
              subject: filteredMessages[0]?.subject,
              preview: filteredMessages[0]?.preview,
              body: filteredMessages[0]?.body,
              allKeys: Object.keys(filteredMessages[0])
            })}
            {filteredMessages.map((msg) => (
              <div 
                key={msg.id} 
                className="message-item"
                onClick={() => handleMessageClick(msg)}
              >
                {/* Avatar Square with Provider Badge */}
                <div className="message-avatar-wrapper">
                  <div className="message-avatar-square">
                    {msg.company?.charAt(0)?.toUpperCase() || '?'}
                  </div>
                  <div className="avatar-provider-badge">
                    {getSourceIcon(msg)}
                  </div>
                </div>

                {/* Content */}
                <div className="message-content" style={{ position: 'relative', zIndex: 10 }}>
                  {/* DEBUG VIEW - Remove after fixing */}
                  <div style={{ 
                    background: '#fff3cd', 
                    padding: '8px', 
                    marginBottom: '8px', 
                    fontSize: '11px', 
                    fontFamily: 'monospace',
                    border: '1px solid #ffc107',
                    borderRadius: '4px'
                  }}>
                    <strong>DEBUG:</strong> company={msg.company || 'NULL'} | 
                    from={msg.from || 'NULL'} | 
                    subject={msg.subject || 'NULL'}
                  </div>
                  
                  <div className="message-header">
                    <div className="message-sender-info">
                      <span className="message-company" style={{ color: '#000000', fontSize: '16px', fontWeight: '600' }}>
                        {msg.company || 'Unknown'}
                      </span>
                      <span className="message-email" style={{ color: '#000000', fontSize: '13px', opacity: 0.6 }}>
                        {msg.from || 'No email'}
                      </span>
                    </div>
                    <div className="message-meta-right">
                      {msg.tags?.length > 0 && (
                        <span className="message-category">{msg.tags[0].toUpperCase()}</span>
                      )}
                      <span className="message-timestamp">{msg.timestamp || 'Unknown'}</span>
                    </div>
                  </div>
                  
                  <div className="message-subject" style={{ color: '#000000', fontSize: '15px', fontWeight: '600' }}>
                    {msg.subject || 'No subject'}
                  </div>
                  
                  <div className="message-preview" style={{ color: '#000000', fontSize: '14px', opacity: 0.7 }}>
                    {msg.preview || 'No preview available'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Whitelist Modal */}
      {showWhitelistModal && (
        <div className="modal-overlay" onClick={() => setShowWhitelistModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Allowed Senders</h2>
              <button className="modal-close" onClick={() => setShowWhitelistModal(false)}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
            <div className="modal-body">
              <p style={{ marginBottom: '16px', color: '#64748b', fontSize: '14px' }}>
                Emails from <strong>@heyjarvis.ai</strong> are automatically allowed. Add other senders below:
              </p>
              
              {/* Add New Email */}
              <div className="whitelist-add-section">
                <input
                  type="email"
                  placeholder="Enter email address (e.g., john@company.com)"
                  value={newWhitelistEmail}
                  onChange={(e) => setNewWhitelistEmail(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && addToWhitelist()}
                  className="whitelist-input"
                />
                <button onClick={addToWhitelist} className="whitelist-add-btn">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="12" y1="5" x2="12" y2="19"></line>
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                  </svg>
                  Add
                </button>
              </div>

              {/* Whitelist */}
              <div className="whitelist-list">
                <h3>Allowed Senders ({whitelistedEmails.length})</h3>
                {whitelistedEmails.length === 0 ? (
                  <p className="whitelist-empty">No custom senders added yet</p>
                ) : (
                  <div className="whitelist-items">
                    {whitelistedEmails.map((email, idx) => (
                      <div key={idx} className="whitelist-item">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                          <polyline points="22,6 12,13 2,6"></polyline>
                        </svg>
                        <span>{email}</span>
                        <button 
                          onClick={() => removeFromWhitelist(email)}
                          className="whitelist-remove-btn"
                          title="Remove from whitelist"
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="modal-footer">
              <button className="modal-btn-secondary" onClick={() => setShowWhitelistModal(false)}>
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

