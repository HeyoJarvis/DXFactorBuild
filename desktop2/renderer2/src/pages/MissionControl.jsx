import { useState, useEffect } from 'react';
import './MissionControl.css';

/**
 * Mission Control - Calendar & Email Management
 * Integrated with Outlook/Google Suite for scheduling and communication
 */
export default function MissionControl() {
  const [activeTab, setActiveTab] = useState('calendar'); // 'calendar' or 'email'
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showNewMeetingModal, setShowNewMeetingModal] = useState(false);
  const [showNewEmailModal, setShowNewEmailModal] = useState(false);

  // Mock calendar events (would come from Outlook/Google Calendar API)
  const mockEvents = [
    {
      id: 1,
      title: 'Team Standup',
      time: '9:00 AM',
      duration: '30 min',
      attendees: ['Sarah Chen', 'Mike Johnson', 'Emma Davis'],
      type: 'meeting',
      status: 'confirmed',
      location: 'Zoom',
      color: '#3b82f6'
    },
    {
      id: 2,
      title: 'Product Review with Client',
      time: '2:00 PM',
      duration: '1 hour',
      attendees: ['Alex Kumar', 'Client Team'],
      type: 'meeting',
      status: 'confirmed',
      location: 'Google Meet',
      color: '#10b981'
    },
    {
      id: 3,
      title: 'Follow up: Q4 Planning',
      time: '4:30 PM',
      duration: '30 min',
      attendees: ['Leadership Team'],
      type: 'suggested',
      status: 'suggested',
      location: 'Teams',
      color: '#f59e0b'
    }
  ];

  // Mock AI-suggested meetings (detected from action items)
  const suggestedMeetings = [
    {
      id: 's1',
      title: 'Discuss Authentication Implementation',
      reason: 'Detected from PROJ-123 action items',
      suggestedTime: 'Tomorrow, 10:00 AM',
      attendees: ['Sarah Chen', 'Backend Team'],
      priority: 'high'
    },
    {
      id: 's2',
      title: 'Review Dashboard Analytics',
      reason: 'Follow-up needed from last week',
      suggestedTime: 'Friday, 3:00 PM',
      attendees: ['Alex Kumar', 'Product Team'],
      priority: 'medium'
    }
  ];

  // Mock drafted emails
  const draftedEmails = [
    {
      id: 'e1',
      to: 'sarah.chen@company.com',
      subject: 'Authentication System - Implementation Update',
      preview: 'Hi Sarah, I wanted to follow up on the authentication system we discussed...',
      aiGenerated: true,
      status: 'draft',
      context: 'Generated from PROJ-123'
    },
    {
      id: 'e2',
      to: 'client@example.com',
      subject: 'Product Demo Follow-up',
      preview: 'Thank you for attending our product demo today. As discussed...',
      aiGenerated: true,
      status: 'draft',
      context: 'Generated from today\'s meeting'
    }
  ];

  // Format date for display
  const formatDate = (date) => {
    return date.toLocaleDateString('en-US', { 
      weekday: 'long', 
      month: 'long', 
      day: 'numeric',
      year: 'numeric'
    });
  };

  return (
    <div className="mission-control-page">
      {/* Header */}
      <div className="mc-header">
        <div className="mc-header-container">
          {/* Left - Title */}
          <div className="mc-header-left">
            <div className="mc-header-title-group">
              <h1 className="mc-header-title">MISSION CONTROL</h1>
              <div className="mc-header-subtitle">
                <div className="status-dot active"></div>
                <span>Synced with Outlook & Google Calendar</span>
              </div>
            </div>
          </div>

          {/* Right - Integration Icons */}
          <div className="mc-header-right">
            {/* Outlook Integration */}
            <button 
              className="integration-btn"
              onClick={() => alert('Outlook integration settings - Coming soon!')}
              title="Outlook • Connected"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M24 7.875v8.282a2.101 2.101 0 0 1-1.031 1.81l-7.969 4.657a2.094 2.094 0 0 1-2.063.031l-7.968-4.657A2.1 2.1 0 0 1 3.937 16.22V7.875l7.969 4.625a2.094 2.094 0 0 0 2.063 0zm0-2.156L16.032.062a2.093 2.093 0 0 0-2.063 0L6.001 4.719l7.968 4.656a2.094 2.094 0 0 0 2.063 0zM3.937 5.719 11.906.062a2.093 2.093 0 0 1 2.063 0l7.969 4.657v.969l-9.875 5.75a2.094 2.094 0 0 1-2.063 0L3.937 6.688z"/>
              </svg>
              <div className="status-indicator connected"></div>
            </button>

            {/* Google Suite Integration */}
            <button 
              className="integration-btn"
              onClick={() => alert('Google Suite integration settings - Coming soon!')}
              title="Google Suite • Connected"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              <div className="status-indicator connected"></div>
            </button>

            <div className="header-divider-vertical"></div>

            <button 
              className="btn-ghost btn-icon"
              onClick={() => window.close()}
              title="Minimize"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
            </button>
          </div>
        </div>
        
        <div className="header-divider"></div>
      </div>

      {/* Tab Navigation */}
      <div className="mc-tabs">
        <button 
          className={`mc-tab ${activeTab === 'calendar' ? 'active' : ''}`}
          onClick={() => setActiveTab('calendar')}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
            <line x1="16" y1="2" x2="16" y2="6"></line>
            <line x1="8" y1="2" x2="8" y2="6"></line>
            <line x1="3" y1="10" x2="21" y2="10"></line>
          </svg>
          Calendar
        </button>
        <button 
          className={`mc-tab ${activeTab === 'email' ? 'active' : ''}`}
          onClick={() => setActiveTab('email')}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
            <polyline points="22,6 12,13 2,6"></polyline>
          </svg>
          Email
        </button>
      </div>

      {/* Main Content */}
      <div className="mc-content">
        {activeTab === 'calendar' ? (
          <div className="calendar-view">
            {/* Date Header */}
            <div className="date-header">
              <h2 className="current-date">{formatDate(selectedDate)}</h2>
              <button 
                className="btn-primary"
                onClick={() => setShowNewMeetingModal(true)}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19"></line>
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                </svg>
                New Meeting
              </button>
            </div>

            {/* Calendar Grid */}
            <div className="calendar-grid">
              {/* Today's Events */}
              <div className="events-section">
                <div className="section-header">
                  <h3 className="section-title">Today's Schedule</h3>
                  <span className="event-count">{mockEvents.length} events</span>
                </div>
                
                <div className="events-list">
                  {mockEvents.map(event => (
                    <div key={event.id} className={`event-card ${event.status}`}>
                      <div className="event-time-bar" style={{ backgroundColor: event.color }}></div>
                      <div className="event-content">
                        <div className="event-header">
                          <h4 className="event-title">{event.title}</h4>
                          {event.status === 'suggested' && (
                            <span className="ai-badge">AI Suggested</span>
                          )}
                        </div>
                        <div className="event-meta">
                          <span className="event-time">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <circle cx="12" cy="12" r="10"></circle>
                              <polyline points="12 6 12 12 16 14"></polyline>
                            </svg>
                            {event.time} • {event.duration}
                          </span>
                          <span className="event-location">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M15 10l-4 4 6 6 4-4-6-6z"></path>
                              <path d="M2 10l6-6 4 4-6 6-4-4z"></path>
                            </svg>
                            {event.location}
                          </span>
                        </div>
                        <div className="event-attendees">
                          {event.attendees.slice(0, 3).map((attendee, idx) => (
                            <div key={idx} className="attendee-avatar" title={attendee}>
                              {attendee.split(' ').map(n => n[0]).join('')}
                            </div>
                          ))}
                          {event.attendees.length > 3 && (
                            <div className="attendee-more">+{event.attendees.length - 3}</div>
                          )}
                        </div>
                      </div>
                      {event.status === 'suggested' && (
                        <div className="event-actions">
                          <button className="btn-accept">Accept</button>
                          <button className="btn-dismiss">Dismiss</button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* AI Suggestions */}
              <div className="suggestions-section">
                <div className="section-header">
                  <h3 className="section-title">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
                    </svg>
                    AI Suggestions
                  </h3>
                </div>

                <div className="suggestions-list">
                  {suggestedMeetings.map(suggestion => (
                    <div key={suggestion.id} className="suggestion-card">
                      <div className={`priority-indicator ${suggestion.priority}`}></div>
                      <div className="suggestion-content">
                        <h4 className="suggestion-title">{suggestion.title}</h4>
                        <p className="suggestion-reason">{suggestion.reason}</p>
                        <div className="suggestion-meta">
                          <span className="suggested-time">{suggestion.suggestedTime}</span>
                          <span className="suggested-attendees">with {suggestion.attendees.join(', ')}</span>
                        </div>
                      </div>
                      <button className="btn-schedule">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="12" y1="5" x2="12" y2="19"></line>
                          <line x1="5" y1="12" x2="19" y2="12"></line>
                        </svg>
                        Schedule
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="email-view">
            {/* Intelligence Bar */}
            <div className="email-intelligence-bar">
              <div className="intelligence-pills">
                <button className="pill-filter active">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"></circle>
                  </svg>
                  Drafts
                </button>
                <button className="pill-filter">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                  </svg>
                  Starred
                </button>
                <button className="pill-filter">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
                  </svg>
                  High Priority
                </button>
              </div>
              <div className="smart-hint">
                {draftedEmails.length} AI-generated drafts ready to send
              </div>
            </div>

            {/* Three-Zone Layout */}
            <div className="email-layout">
              {/* Inbox List Zone */}
              <div className="inbox-zone">
                <div className="inbox-header">
                  <div className="inbox-title">
                    <h3>AI Drafts</h3>
                    <span className="inbox-count">{draftedEmails.length}</span>
                  </div>
                  <button 
                    className="btn-primary btn-compose"
                    onClick={() => setShowNewEmailModal(true)}
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
                    </svg>
                    Compose
                  </button>
                </div>

                <div className="inbox-list">
                  {draftedEmails.map((email, index) => (
                    <div key={email.id} className={`email-row ${index === 0 ? 'selected' : ''}`}>
                      {/* Unread indicator */}
                      <div className="unread-indicator"></div>
                      
                      <div className="email-row-content">
                        {/* Sender & Status */}
                        <div className="email-row-header">
                          <div className="email-sender">
                            <div className="sender-avatar">AI</div>
                            <span className="sender-name">AI Assistant</span>
                          </div>
                          <span className="email-time">Just now</span>
                        </div>

                        {/* Subject */}
                        <div className="email-subject-line">{email.subject}</div>

                        {/* Preview snippet */}
                        <div className="email-snippet">{email.preview}</div>

                        {/* Meta tags */}
                        <div className="email-meta-tags">
                          <span className="meta-tag ai">AI Generated</span>
                          <span className="meta-tag context">{email.context}</span>
                        </div>
                      </div>

                    </div>
                  ))}
                </div>
              </div>

              {/* Detail/Reader Zone */}
              <div className="email-reader-zone">
                <div className="reader-container">
                  {/* Email Header */}
                  <div className="reader-header">
                    <h2 className="reader-subject">{draftedEmails[0].subject}</h2>
                    
                    <div className="reader-meta">
                      <div className="reader-sender-block">
                        <div className="sender-avatar large">AI</div>
                        <div className="sender-info">
                          <div className="sender-name-large">AI Assistant</div>
                          <div className="sender-email">To: {draftedEmails[0].to}</div>
                        </div>
                      </div>
                      <div className="reader-actions">
                        <button className="reader-action-btn" title="Reply">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="9 14 4 9 9 4"></polyline>
                            <path d="M20 20v-7a4 4 0 0 0-4-4H4"></path>
                          </svg>
                        </button>
                        <button className="reader-action-btn" title="Forward">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="15 14 20 9 15 4"></polyline>
                            <path d="M4 20v-7a4 4 0 0 1 4-4h12"></path>
                          </svg>
                        </button>
                        <button className="reader-action-btn" title="Archive">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="21 8 21 21 3 21 3 8"></polyline>
                            <rect x="1" y="3" width="22" height="5"></rect>
                            <line x1="10" y1="12" x2="14" y2="12"></line>
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Email Body */}
                  <div className="reader-body">
                    <div className="email-message-container">
                      <p>{draftedEmails[0].preview}</p>
                      <p>I wanted to follow up on our previous discussion regarding this topic. Based on the action items we identified, I believe we should schedule some time to review the progress and align on next steps.</p>
                      <p>Please let me know your availability for a quick sync this week.</p>
                      <br />
                      <p>Best regards,<br />Your Name</p>
                    </div>

                    {/* AI Context Badge */}
                    <div className="email-ai-context">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
                      </svg>
                      <span>{draftedEmails[0].context}</span>
                    </div>
                  </div>

                  {/* Send Footer */}
                  <div className="reader-footer">
                    <div className="footer-left">
                      <button className="footer-action">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                        </svg>
                        Edit Draft
                      </button>
                      <div className="auto-save-indicator">Saved · just now</div>
                    </div>
                    <div className="footer-right">
                      <button className="btn-send-primary">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="22" y1="2" x2="11" y2="13"></line>
                          <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                        </svg>
                        Send
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

