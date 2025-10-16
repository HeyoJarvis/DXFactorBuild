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

  // Integration state
  const [microsoftConnected, setMicrosoftConnected] = useState(false);
  const [googleConnected, setGoogleConnected] = useState(false);
  const [authenticating, setAuthenticating] = useState(null); // 'microsoft' | 'google' | null
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [calendarView, setCalendarView] = useState('daily'); // 'daily' or 'weekly'

  // AI-suggested meetings (detected from action items)
  // TODO: Implement AI detection from Slack/Teams/JIRA activity
  const suggestedMeetings = [];

  // Drafted emails
  // TODO: Implement AI-generated email drafts
  const draftedEmails = [];

  // Check integration status on mount
  useEffect(() => {
    checkIntegrations();
  }, []);

  // Reload events when calendar view changes
  useEffect(() => {
    const reloadEvents = async () => {
      setLoading(true);
      if (microsoftConnected) {
        await loadMicrosoftEvents();
      }
      if (googleConnected) {
        await loadGoogleEvents();
      }
      setLoading(false);
    };
    
    // Only reload if we're already connected (not on initial mount)
    if (microsoftConnected || googleConnected) {
      reloadEvents();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calendarView]);

  // Check if Microsoft and Google are connected
  const checkIntegrations = async () => {
    try {
      setLoading(true);
      
      // Check Microsoft connection
      if (window.electronAPI?.microsoft) {
        const msResult = await window.electronAPI.microsoft.checkConnection();
        setMicrosoftConnected(msResult.connected || false);
        
        if (msResult.connected) {
          await loadMicrosoftEvents();
        }
      }
      
      // Check Google connection
      if (window.electronAPI?.google) {
        const googleResult = await window.electronAPI.google.checkConnection();
        setGoogleConnected(googleResult.connected || false);
        
        if (googleResult.connected) {
          await loadGoogleEvents();
        }
      }
      
      // If neither connected, no events to show
      if (!microsoftConnected && !googleConnected) {
        setEvents([]);
      }
      
    } catch (error) {
      console.error('Failed to check integrations:', error);
      setError('Failed to check integration status');
      setEvents([]); // Clear events on error
    } finally {
      setLoading(false);
    }
  };

  // Authenticate with Microsoft
  const handleMicrosoftAuth = async () => {
    try {
      setAuthenticating('microsoft');
      setError(null);
      
      const result = await window.electronAPI.microsoft.authenticate();
      
      if (result.success) {
        setMicrosoftConnected(true);
        await loadMicrosoftEvents();
      } else {
        setError(result.error || 'Failed to authenticate with Microsoft');
      }
    } catch (error) {
      console.error('Microsoft authentication error:', error);
      setError(error.message || 'Failed to authenticate with Microsoft');
    } finally {
      setAuthenticating(null);
    }
  };

  // Authenticate with Google
  const handleGoogleAuth = async () => {
    try {
      setAuthenticating('google');
      setError(null);
      
      const result = await window.electronAPI.google.authenticate();
      
      if (result.success) {
        setGoogleConnected(true);
        await loadGoogleEvents();
      } else {
        setError(result.error || 'Failed to authenticate with Google');
      }
    } catch (error) {
      console.error('Google authentication error:', error);
      setError(error.message || 'Failed to authenticate with Google');
    } finally {
      setAuthenticating(null);
    }
  };

  // Load Microsoft calendar events
  const loadMicrosoftEvents = async () => {
    try {
      // Calculate date range based on view
      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const endDate = calendarView === 'daily' 
        ? new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000) // End of today
        : new Date(startOfDay.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days from now
      
      const result = await window.electronAPI.microsoft.getUpcomingEvents({
        startDateTime: startOfDay.toISOString(),
        endDateTime: endDate.toISOString()
      });
      
      if (result.success && result.events) {
        // Debug: Log the first event to see the exact format
        if (result.events.length > 0) {
          console.log('Microsoft event sample:', JSON.stringify(result.events[0], null, 2));
        }
        
        // Transform Microsoft events to our format
        const transformedEvents = result.events.map(event => {
          // Microsoft Graph API now returns times in local timezone (America/Denver)
          // With Prefer header: { dateTime: "2025-10-16T09:00:00.0000000", timeZone: "America/Denver" }
          // Parse these as local times (no timezone conversion needed)
          
          let startDate, endDate;
          
          if (event.start.timeZone === 'UTC') {
            // If still UTC, append Z to parse correctly
            startDate = new Date(event.start.dateTime + (event.start.dateTime.endsWith('Z') ? '' : 'Z'));
            endDate = new Date(event.end.dateTime + (event.end.dateTime.endsWith('Z') ? '' : 'Z'));
          } else {
            // For local timezone, parse the datetime directly
            // Remove trailing zeros and parse
            const startStr = event.start.dateTime.replace(/\.0+$/, '');
            const endStr = event.end.dateTime.replace(/\.0+$/, '');
            startDate = new Date(startStr);
            endDate = new Date(endStr);
          }
          
          // Format the date and time
          const eventDate = startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
          const eventTime = startDate.toLocaleTimeString('en-US', { 
            hour: 'numeric', 
            minute: '2-digit',
            hour12: true 
          });
          
          // Check if event is today
          const today = new Date();
          const isToday = startDate.toDateString() === today.toDateString();
          const isTomorrow = startDate.toDateString() === new Date(today.getTime() + 86400000).toDateString();
          
          let displayTime = eventTime;
          if (!isToday) {
            if (isTomorrow) {
              displayTime = `Tomorrow, ${eventTime}`;
            } else {
              displayTime = `${eventDate}, ${eventTime}`;
            }
          }
          
          return {
            id: event.id,
            title: event.subject,
            time: displayTime,
            rawDate: startDate, // Store raw date for sorting
            duration: calculateDuration(event.start.dateTime, event.end.dateTime),
            attendees: event.attendees?.map(a => a.emailAddress.name || a.emailAddress.address) || [],
      type: 'meeting',
      status: 'confirmed',
            location: event.isOnlineMeeting ? 'Teams' : (event.location?.displayName || 'Not specified'),
            color: '#0078d4',
            source: 'microsoft',
            meetingLink: event.onlineMeeting?.joinUrl
          };
        });
        
        setEvents(prev => [...prev.filter(e => e.source !== 'microsoft'), ...transformedEvents]);
      }
    } catch (error) {
      console.error('Failed to load Microsoft events:', error);
    }
  };

  // Load Google calendar events
  const loadGoogleEvents = async () => {
    try {
      // Calculate date range based on view
      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const endDate = calendarView === 'daily' 
        ? new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000) // End of today
        : new Date(startOfDay.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days from now
      
      const result = await window.electronAPI.google.getUpcomingEvents({
        timeMin: startOfDay.toISOString(),
        timeMax: endDate.toISOString()
      });
      
      if (result.success && result.events) {
        // Debug: Log the first event to see format
        if (result.events.length > 0) {
          console.log('Google event sample:', JSON.stringify(result.events[0], null, 2));
        }
        
        // Transform Google events to our format
        const transformedEvents = result.events.map(event => {
          // Google Calendar returns times with timezone info
          // Parse the datetime correctly
          const startDate = new Date(event.start.dateTime || event.start.date);
          const endDate = new Date(event.end.dateTime || event.end.date);
          
          // Format the date and time
          const eventDate = startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
          const eventTime = startDate.toLocaleTimeString('en-US', { 
            hour: 'numeric', 
            minute: '2-digit',
            hour12: true 
          });
          
          // Check if event is today
          const today = new Date();
          const isToday = startDate.toDateString() === today.toDateString();
          const isTomorrow = startDate.toDateString() === new Date(today.getTime() + 86400000).toDateString();
          
          let displayTime = eventTime;
          if (!isToday) {
            if (isTomorrow) {
              displayTime = `Tomorrow, ${eventTime}`;
            } else {
              displayTime = `${eventDate}, ${eventTime}`;
            }
          }
          
          return {
            id: event.id,
            title: event.summary,
            time: displayTime,
            rawDate: startDate,
            duration: calculateDuration(event.start.dateTime || event.start.date, event.end.dateTime || event.end.date),
            attendees: event.attendees?.map(a => a.displayName || a.email) || [],
            type: 'meeting',
            status: 'confirmed',
            location: event.hangoutLink ? 'Google Meet' : (event.location || 'Not specified'),
            color: '#4285f4',
            source: 'google',
            meetingLink: event.hangoutLink || event.conferenceData?.entryPoints?.[0]?.uri
          };
        });
        
        setEvents(prev => [...prev.filter(e => e.source !== 'google'), ...transformedEvents]);
      }
    } catch (error) {
      console.error('Failed to load Google events:', error);
    }
  };

  // Calculate duration between two times
  const calculateDuration = (start, end) => {
    const startTime = new Date(start);
    const endTime = new Date(end);
    const diffMs = endTime - startTime;
    const diffMins = Math.round(diffMs / 60000);
    
    if (diffMins < 60) {
      return `${diffMins} min`;
    } else {
      const hours = Math.floor(diffMins / 60);
      const mins = diffMins % 60;
      return mins > 0 ? `${hours}h ${mins}m` : `${hours} hour${hours > 1 ? 's' : ''}`;
    }
  };

  // Create new meeting
  const handleCreateMeeting = async (meetingData) => {
    try {
      setError(null);
      
      // Parse the datetime-local input (which is in local time without timezone info)
      // and format as ISO string for the API
      const startDate = new Date(meetingData.startTime);
      const endDate = new Date(meetingData.endTime);
      
      const eventData = {
        subject: meetingData.title,
        startTime: startDate.toISOString(),
        endTime: endDate.toISOString(),
        attendees: meetingData.attendees.split(',').map(email => email.trim()).filter(e => e),
        isOnlineMeeting: meetingData.includeTeamsLink,
        body: meetingData.description || '',
        timeZone: 'America/Denver'
      };
      
      // Use the connected service
      const result = microsoftConnected 
        ? await window.electronAPI.microsoft.createEvent(eventData)
        : await window.electronAPI.google.createEvent(eventData);
      
      if (result.success) {
        // Close modal
        setShowNewMeetingModal(false);
        
        // Reload events
        if (microsoftConnected) {
          await loadMicrosoftEvents();
        }
        if (googleConnected) {
          await loadGoogleEvents();
        }
        
        // Show success message
        alert(`Meeting created successfully!${result.meetingLink ? '\n\nMeeting link: ' + result.meetingLink : ''}`);
      } else {
        setError(result.error || 'Failed to create meeting');
      }
    } catch (error) {
      console.error('Failed to create meeting:', error);
      setError(error.message || 'Failed to create meeting');
    }
  };

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
                {microsoftConnected || googleConnected ? (
                  <>
                <div className="status-dot active"></div>
                    <span>
                      {microsoftConnected && googleConnected ? 'Synced with Outlook & Google Calendar' :
                       microsoftConnected ? 'Synced with Outlook' :
                       'Synced with Google Calendar'}
                    </span>
                  </>
                ) : (
                  <>
                    <div className="status-dot" style={{ background: '#86868b' }}></div>
                    <span>Connect Outlook or Google to sync calendar</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Right - Integration Icons */}
          <div className="mc-header-right">
            {/* Outlook Integration */}
            <button 
              className="integration-btn"
              onClick={handleMicrosoftAuth}
              title={microsoftConnected ? "Outlook • Connected" : "Connect to Outlook"}
              disabled={authenticating === 'microsoft'}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M24 7.875v8.282a2.101 2.101 0 0 1-1.031 1.81l-7.969 4.657a2.094 2.094 0 0 1-2.063.031l-7.968-4.657A2.1 2.1 0 0 1 3.937 16.22V7.875l7.969 4.625a2.094 2.094 0 0 0 2.063 0zm0-2.156L16.032.062a2.093 2.093 0 0 0-2.063 0L6.001 4.719l7.968 4.656a2.094 2.094 0 0 0 2.063 0zM3.937 5.719 11.906.062a2.093 2.093 0 0 1 2.063 0l7.969 4.657v.969l-9.875 5.75a2.094 2.094 0 0 1-2.063 0L3.937 6.688z"/>
              </svg>
              {authenticating === 'microsoft' ? (
                <div className="status-indicator authenticating"></div>
              ) : (
                <div className={`status-indicator ${microsoftConnected ? 'connected' : 'disconnected'}`}></div>
              )}
            </button>

            {/* Google Suite Integration */}
            <button 
              className="integration-btn"
              onClick={handleGoogleAuth}
              title={googleConnected ? "Google Suite • Connected" : "Connect to Google"}
              disabled={authenticating === 'google'}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              {authenticating === 'google' ? (
                <div className="status-indicator authenticating"></div>
              ) : (
                <div className={`status-indicator ${googleConnected ? 'connected' : 'disconnected'}`}></div>
              )}
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
              {/* Upcoming Events */}
              <div className="events-section">
                <div className="section-header">
                  <h3 className="section-title">Upcoming Events</h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    {/* View Toggle */}
                    <div className="view-toggle">
                      <button 
                        className={`toggle-option ${calendarView === 'daily' ? 'active' : ''}`}
                        onClick={() => setCalendarView('daily')}
                      >
                        Daily
                      </button>
                      <button 
                        className={`toggle-option ${calendarView === 'weekly' ? 'active' : ''}`}
                        onClick={() => setCalendarView('weekly')}
                      >
                        Weekly
                      </button>
                    </div>
                    <span className="event-count">{events.length} events</span>
                  </div>
                </div>
                
                {error && (
                  <div style={{ padding: '12px', background: '#fff3cd', borderRadius: '8px', marginBottom: '12px', fontSize: '13px', color: '#856404' }}>
                    {error}
                  </div>
                )}
                
                <div className="events-list">
                  {loading && (
                    <div style={{ padding: '20px', textAlign: 'center', color: '#86868b' }}>
                      Loading calendar events...
                    </div>
                  )}
                  
                  {!loading && events.length === 0 && (
                    <div style={{ padding: '20px', textAlign: 'center', color: '#86868b' }}>
                      {microsoftConnected || googleConnected 
                        ? 'No upcoming events scheduled'
                        : 'Connect Microsoft or Google to see your calendar'}
                    </div>
                  )}
                  
                  {events.map(event => (
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
                  {suggestedMeetings.length === 0 && (
                    <div style={{ padding: '20px', textAlign: 'center', color: '#86868b', fontSize: '13px' }}>
                      AI will suggest meetings based on your Slack, Teams, and JIRA activity
                    </div>
                  )}
                  
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
                  {draftedEmails.length === 0 && (
                    <div style={{ padding: '40px 20px', textAlign: 'center', color: '#86868b' }}>
                      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ margin: '0 auto 12px', opacity: 0.3 }}>
                        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
                      </svg>
                      <p style={{ margin: '0 0 8px', fontSize: '14px' }}>No AI-generated drafts yet</p>
                      <p style={{ margin: 0, fontSize: '12px', opacity: 0.7 }}>
                        AI will draft emails based on your tasks and meetings
                      </p>
                    </div>
                  )}
                  
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
                {draftedEmails.length > 0 ? (
                  <>
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
                </>
                ) : (
                  <div style={{ 
                    display: 'flex', 
                    flexDirection: 'column',
                    alignItems: 'center', 
                    justifyContent: 'center',
                    height: '100%',
                    color: '#86868b',
                    padding: '40px'
                  }}>
                    <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: '16px', opacity: 0.3 }}>
                      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                      <polyline points="22,6 12,13 2,6"></polyline>
                    </svg>
                    <p style={{ margin: '0 0 8px', fontSize: '16px', fontWeight: 600 }}>Select an email to read</p>
                    <p style={{ margin: 0, fontSize: '13px', opacity: 0.7 }}>
                      No emails selected
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* New Meeting Modal */}
      {showNewMeetingModal && (
        <NewMeetingModal
          onClose={() => setShowNewMeetingModal(false)}
          onCreate={handleCreateMeeting}
          serviceConnected={microsoftConnected || googleConnected}
          serviceName={microsoftConnected ? 'Microsoft Teams' : 'Google Meet'}
        />
      )}
    </div>
  );
}

// New Meeting Modal Component
function NewMeetingModal({ onClose, onCreate, serviceConnected, serviceName }) {
  const [formData, setFormData] = useState({
    title: '',
    startTime: '',
    endTime: '',
    attendees: '',
    description: '',
    includeTeamsLink: true
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onCreate(formData);
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  // Set default times (1 hour from now, 30 min duration)
  const getDefaultTimes = () => {
    const now = new Date();
    const start = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour from now
    const end = new Date(start.getTime() + 30 * 60 * 1000); // 30 min duration
    
    return {
      startTime: start.toISOString().slice(0, 16),
      endTime: end.toISOString().slice(0, 16)
    };
  };

  // Initialize with default times if not set
  if (!formData.startTime && !formData.endTime) {
    const defaults = getDefaultTimes();
    setFormData({
      ...formData,
      ...defaults
    });
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>New Meeting</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-group">
            <label>Meeting Title *</label>
            <input
              type="text"
              name="title"
              value={formData.title}
              onChange={handleChange}
              placeholder="e.g., Team Standup"
              required
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Start Time *</label>
              <input
                type="datetime-local"
                name="startTime"
                value={formData.startTime}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-group">
              <label>End Time *</label>
              <input
                type="datetime-local"
                name="endTime"
                value={formData.endTime}
                onChange={handleChange}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label>Attendees (comma-separated emails)</label>
            <input
              type="text"
              name="attendees"
              value={formData.attendees}
              onChange={handleChange}
              placeholder="sarah@example.com, mike@example.com"
            />
            <small style={{ color: '#86868b', fontSize: '11px', marginTop: '4px', display: 'block' }}>
              Separate multiple email addresses with commas
            </small>
          </div>

          <div className="form-group">
            <label>Description</label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              placeholder="Add meeting agenda or notes..."
              rows="3"
            />
          </div>

          <div className="form-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                name="includeTeamsLink"
                checked={formData.includeTeamsLink}
                onChange={(e) => setFormData({ ...formData, includeTeamsLink: e.target.checked })}
              />
              <span>Include {serviceName} link</span>
            </label>
          </div>

          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-primary">
              Create Meeting
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

