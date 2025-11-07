import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import './CalendarEmail.css';

/**
 * CalendarEmail Component - Right Panel in Mission Control
 * Modern, elegant design with Calendar, Email, and AI Suggestions
 * Pulls AI suggestions directly from TDL (tasks with work_type: calendar, email, outreach)
 */
export default function CalendarEmail({ user, tasks = [] }) {
  const [activeTab, setActiveTab] = useState('calendar'); // 'calendar' or 'email'
  const [calendarView, setCalendarView] = useState('week'); // 'day', 'week', 'month'
  const [events, setEvents] = useState([]);
  const [emails, setEmails] = useState([]);
  const [loading, setLoading] = useState(false);
  const [microsoftConnected, setMicrosoftConnected] = useState(false);
  const [googleConnected, setGoogleConnected] = useState(false);
  const [showNewMeetingModal, setShowNewMeetingModal] = useState(false);
  const [selectedSuggestion, setSelectedSuggestion] = useState(null);
  const [showComposeModal, setShowComposeModal] = useState(false);
  const [selectedEmailTask, setSelectedEmailTask] = useState(null);
  const [showEmailReader, setShowEmailReader] = useState(false);
  const [selectedEmail, setSelectedEmail] = useState(null);
  const [preferredCalendarService, setPreferredCalendarService] = useState('microsoft'); // 'microsoft' or 'google'
  const [preferredEmailService, setPreferredEmailService] = useState('microsoft'); // 'microsoft' or 'google'

  // Track selected date for week overview
  const [selectedDate, setSelectedDate] = useState(new Date());

  // Filter AI suggestions from tasks based on work_type
  const aiSuggestions = activeTab === 'calendar'
    ? tasks
        .filter(task => task.work_type === 'calendar' && task.status !== 'completed')
        .map(task => ({
          id: task.id,
          type: 'meeting',
          icon: 'slack', // Use Slack logo
          title: task.title || task.session_title,
          description: task.description || 'AI-detected meeting suggestion',
          action: 'Schedule',
          taskData: task
        }))
    : tasks
        .filter(task => (task.work_type === 'email' || task.work_type === 'outreach') && task.status !== 'completed')
        .map(task => ({
          id: task.id,
          type: 'email',
          icon: 'slack', // Use Slack logo
          title: task.title || task.session_title,
          description: task.description || 'AI-detected email task',
          action: 'Draft Email',
          taskData: task
        }));

  // Check integration status on mount
  useEffect(() => {
    checkIntegrations();
  }, []);

  // Load data when tab changes
  useEffect(() => {
    if (activeTab === 'calendar' && (microsoftConnected || googleConnected)) {
      loadCalendarEvents();
    } else if (activeTab === 'email' && (microsoftConnected || googleConnected)) {
      loadEmails();
    }
  }, [activeTab, microsoftConnected, googleConnected]);

  const checkIntegrations = async () => {
    try {
      // Check Microsoft connection
      if (window.electronAPI?.microsoft?.checkConnection) {
        const msResult = await window.electronAPI.microsoft.checkConnection();
        setMicrosoftConnected(msResult?.connected === true);
      }

      // Check Google connection
      if (window.electronAPI?.google?.checkConnection) {
        const googleResult = await window.electronAPI.google.checkConnection();
        setGoogleConnected(googleResult?.connected === true);
      }
    } catch (error) {
      console.error('Failed to check integrations:', error);
    }
  };

  const loadCalendarEvents = async () => {
    try {
      setLoading(true);
      const today = new Date();
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const endOfWeek = new Date(startOfDay.getTime() + 7 * 24 * 60 * 60 * 1000);

      let allEvents = [];

      // Load Microsoft events
      if (microsoftConnected && window.electronAPI?.microsoft?.getUpcomingEvents) {
        const msResult = await window.electronAPI.microsoft.getUpcomingEvents({
          startDateTime: startOfDay.toISOString(),
          endDateTime: endOfWeek.toISOString()
        });
        if (msResult.success && msResult.events) {
          allEvents = [...allEvents, ...msResult.events.map(e => ({ ...e, source: 'microsoft' }))];
        }
      }

      // Load Google events
      if (googleConnected && window.electronAPI?.google?.getUpcomingEvents) {
        const googleResult = await window.electronAPI.google.getUpcomingEvents({
          timeMin: startOfDay.toISOString(),
          timeMax: endOfWeek.toISOString()
        });
        if (googleResult.success && googleResult.events) {
          allEvents = [...allEvents, ...googleResult.events.map(e => ({ ...e, source: 'google' }))];
        }
      }

      // Sort by start time
      allEvents.sort((a, b) => {
        const aTime = new Date(a.start?.dateTime || a.start?.date);
        const bTime = new Date(b.start?.dateTime || b.start?.date);
        return aTime - bTime;
      });

      setEvents(allEvents);
    } catch (error) {
      console.error('Failed to load calendar events:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadEmails = async () => {
    try {
      setLoading(true);

      if (window.electronAPI?.inbox?.getUnified) {
        const result = await window.electronAPI.inbox.getUnified({
          maxResults: 20,
          includeSources: ['gmail', 'outlook']
        });

        if (result.success && result.emails) {
          setEmails(result.emails);
        }
      }
    } catch (error) {
      console.error('Failed to load emails:', error);
    } finally {
      setLoading(false);
    }
  };


  const handleNewMeeting = () => {
    setSelectedSuggestion(null);
    setShowNewMeetingModal(true);
  };

  const handleCreateMeeting = async (formData) => {
    try {
      const startTime = new Date(formData.startTime);
      const endTime = new Date(formData.endTime);
      const attendeesList = formData.attendees
        ? formData.attendees.split(',').map(email => email.trim()).filter(Boolean)
        : [];

      const useService = preferredCalendarService === 'microsoft' && microsoftConnected ? 'microsoft' : 
                         preferredCalendarService === 'google' && googleConnected ? 'google' :
                         microsoftConnected ? 'microsoft' : 'google';

      if (useService === 'microsoft' && window.electronAPI?.microsoft?.createEvent) {
        const meetingData = {
          subject: formData.title,
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
          attendees: attendeesList,
          isOnlineMeeting: formData.includeTeamsLink,
          body: formData.description || '',
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
        };

        const result = await window.electronAPI.microsoft.createEvent(meetingData);
        
        if (result.success) {
          setShowNewMeetingModal(false);
          loadCalendarEvents(); // Refresh calendar
          alert('Meeting created successfully in Outlook!');
        } else {
          console.error('Failed to create meeting:', result.error);
          alert('Failed to create meeting: ' + result.error);
        }
      } else if (useService === 'google' && window.electronAPI?.google?.createEvent) {
        // Format datetime in RFC3339 format with timezone offset (not UTC)
        const formatLocalDateTime = (date) => {
          const year = date.getFullYear();
          const month = String(date.getMonth() + 1).padStart(2, '0');
          const day = String(date.getDate()).padStart(2, '0');
          const hours = String(date.getHours()).padStart(2, '0');
          const minutes = String(date.getMinutes()).padStart(2, '0');
          const seconds = String(date.getSeconds()).padStart(2, '0');
          
          // Get timezone offset in format +HH:MM or -HH:MM
          const tzOffset = -date.getTimezoneOffset();
          const tzHours = String(Math.floor(Math.abs(tzOffset) / 60)).padStart(2, '0');
          const tzMinutes = String(Math.abs(tzOffset) % 60).padStart(2, '0');
          const tzSign = tzOffset >= 0 ? '+' : '-';
          
          return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}${tzSign}${tzHours}:${tzMinutes}`;
        };

        const eventData = {
          summary: formData.title,
          description: formData.description || '',
          start: {
            dateTime: formatLocalDateTime(startTime)
          },
          end: {
            dateTime: formatLocalDateTime(endTime)
          },
          attendees: attendeesList.map(email => ({ email })),
          conferenceData: formData.includeTeamsLink ? {
            createRequest: {
              requestId: `meet-${Date.now()}`,
              conferenceSolutionKey: { type: 'hangoutsMeet' }
            }
          } : undefined
        };

        const result = await window.electronAPI.google.createEvent(eventData);
        
        if (result.success) {
          setShowNewMeetingModal(false);
          loadCalendarEvents(); // Refresh calendar
          alert('Meeting created successfully in Google Calendar!');
    } else {
          console.error('Failed to create event:', result.error);
          alert('Failed to create event: ' + result.error);
        }
      }
    } catch (error) {
      console.error('Failed to create meeting:', error);
      alert('Failed to create meeting: ' + error.message);
    }
  };

  const handleNewEmail = () => {
    setSelectedEmailTask(null);
    setShowComposeModal(true);
  };

  const handleSendEmail = async (emailData) => {
    try {
      // Parse recipients into array
      const recipients = emailData.to.split(',').map(email => email.trim()).filter(Boolean);
      
      if (recipients.length === 0) {
        alert('Please enter at least one recipient');
        return;
      }

      const useService = preferredEmailService === 'microsoft' && microsoftConnected ? 'microsoft' : 
                         preferredEmailService === 'google' && googleConnected ? 'google' :
                         microsoftConnected ? 'microsoft' : 'google';

      if (useService === 'microsoft' && window.electronAPI?.microsoft?.sendEmail) {
        // Ensure body is a string and convert plain text to HTML format
        const bodyText = String(emailData.body || '');
        const htmlBody = bodyText.replace(/\n/g, '<br>');
        
        const result = await window.electronAPI.microsoft.sendEmail({
          subject: String(emailData.subject || ''),
          body: htmlBody, // Must be a string
          to: recipients, // Array of email addresses
          isHtml: true // Flag to indicate HTML content
        });

        if (result.success) {
          setShowComposeModal(false);
          setShowEmailReader(false);
          alert('Email sent successfully via Outlook!');
          if (selectedEmailTask?.taskData?.id) {
            // TODO: Mark task as completed
          }
        } else {
          console.error('Failed to send email:', result.error);
          alert('Failed to send email: ' + result.error);
        }
      } else if (useService === 'google' && window.electronAPI?.google?.sendEmail) {
        const result = await window.electronAPI.google.sendEmail({
          to: recipients.join(', '), // Comma-separated string for Gmail
          subject: String(emailData.subject || ''),
          body: String(emailData.body || ''), // Must be a string
          isHtml: false // Plain text for Gmail
        });

        if (result.success) {
          setShowComposeModal(false);
          setShowEmailReader(false);
          alert('Email sent successfully via Gmail!');
          if (selectedEmailTask?.taskData?.id) {
            // TODO: Mark task as completed
          }
        } else {
          console.error('Failed to send email:', result.error);
          alert('Failed to send email: ' + result.error);
        }
      }
    } catch (error) {
      console.error('Failed to send email:', error);
      alert('Failed to send email: ' + error.message);
    }
  };

  const handleSuggestionAction = (suggestion) => {
    if (suggestion.type === 'meeting') {
      // Open meeting creation with pre-filled data from suggestion
      setSelectedSuggestion(suggestion);
      setShowNewMeetingModal(true);
    } else if (suggestion.type === 'email') {
      // Open email composition with pre-filled data
      setSelectedEmailTask(suggestion);
      setShowComposeModal(true);
    }
  };

  const formatEventTime = (event) => {
    const start = new Date(event.start?.dateTime || event.start?.date);
    const today = new Date();
    const isToday = start.toDateString() === today.toDateString();
    const isTomorrow = start.toDateString() === new Date(today.getTime() + 86400000).toDateString();

    const timeStr = start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

    if (isToday) return `Today, ${timeStr}`;
    if (isTomorrow) return `Tomorrow, ${timeStr}`;
    return start.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  };

  const formatEmailTime = (email) => {
    const date = new Date(email.date || email.receivedDateTime);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  // Get events for a specific date
  const getEventsForDate = (date) => {
    return events.filter(event => {
      const eventDate = new Date(event.start?.dateTime || event.start?.date || event.start);
      return eventDate.toDateString() === date.toDateString();
    });
  };

  // Get day events grouped by hour for day view
  const getDayEventsByHour = () => {
    const dayEvents = getEventsForDate(selectedDate);
    const hours = {};
    for (let i = 9; i <= 18; i++) {
      hours[i] = [];
    }
    dayEvents.forEach(event => {
      const eventDate = new Date(event.start?.dateTime || event.start?.date);
      const hour = eventDate.getHours();
      if (hour >= 9 && hour <= 18) {
        hours[hour].push(event);
      }
    });
    return hours;
  };

  // Get all days in month
  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();
    return { daysInMonth, startingDayOfWeek, year, month };
  };

  if (!microsoftConnected && !googleConnected) {
    return (
      <div className="calendar-email-container">
        <div className="connection-required">
          <div className="connection-icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
            </svg>
          </div>
          <h3>Connect Your Calendar</h3>
          <p>Connect Microsoft or Google to unlock calendar and email features</p>
          <button className="btn-connect-primary" onClick={() => window.location.href = '#/settings'}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="16"></line>
              <line x1="8" y1="12" x2="16" y2="12"></line>
            </svg>
            Connect Account
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="calendar-email-container">
      {/* Header with Tabs and Actions */}
      <div className="ce-header-section">
        <div className="ce-tabs">
          <button
            className={`ce-tab ${activeTab === 'calendar' ? 'active' : ''}`}
            onClick={() => setActiveTab('calendar')}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
              <line x1="16" y1="2" x2="16" y2="6"></line>
              <line x1="8" y1="2" x2="8" y2="6"></line>
              <line x1="3" y1="10" x2="21" y2="10"></line>
            </svg>
            Calendar
          </button>
          <button
            className={`ce-tab ${activeTab === 'email' ? 'active' : ''}`}
            onClick={() => setActiveTab('email')}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
              <polyline points="22,6 12,13 2,6"></polyline>
            </svg>
            Email
          </button>
        </div>

        {/* Service Selector & Action Buttons */}
        <div className="ce-actions">
          {activeTab === 'calendar' ? (
            <>
              <select 
                className="service-selector"
                value={preferredCalendarService}
                onChange={(e) => setPreferredCalendarService(e.target.value)}
                style={{ marginRight: '8px', padding: '6px 10px', borderRadius: '6px', border: '1px solid #e0e0e0' }}
              >
                {microsoftConnected && <option value="microsoft">Outlook</option>}
                {googleConnected && <option value="google">Google</option>}
              </select>
              <button className="action-btn action-btn-primary" onClick={handleNewMeeting}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="12" y1="5" x2="12" y2="19"></line>
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                </svg>
                New Meeting
              </button>
            </>
          ) : (
            <>
              <select 
                className="service-selector"
                value={preferredEmailService}
                onChange={(e) => setPreferredEmailService(e.target.value)}
                style={{ marginRight: '8px', padding: '6px 10px', borderRadius: '6px', border: '1px solid #e0e0e0' }}
              >
                {microsoftConnected && <option value="microsoft">Outlook</option>}
                {googleConnected && <option value="google">Gmail</option>}
              </select>
            <button className="action-btn action-btn-primary" onClick={handleNewEmail}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                <polyline points="22,6 12,13 2,6"></polyline>
              </svg>
                Compose
            </button>
            </>
          )}
        </div>
      </div>

      {/* AI Suggestions Section - Top */}
      {aiSuggestions.length > 0 && (
        <div className="ai-suggestions-section">
          <div className="suggestions-header">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
            </svg>
            <span>AI Suggestions</span>
          </div>
          <div className="suggestions-list">
            {aiSuggestions.map((suggestion) => (
              <div key={suggestion.id} className="suggestion-card">
                <div className="suggestion-icon">
                  <img 
                    src="/Slack_icon_2019.svg.png" 
                    alt="Slack" 
                    className="slack-logo-icon"
                  />
                </div>
                <div className="suggestion-content">
                  <div className="suggestion-title">{suggestion.title}</div>
                  <div className="suggestion-description">{suggestion.description}</div>
                </div>
                <button 
                  className="suggestion-action-btn"
                  onClick={() => handleSuggestionAction(suggestion)}
                >
                  {suggestion.action}
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                    <polyline points="12 5 19 12 12 19"></polyline>
                  </svg>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Calendar View Selector */}
      {activeTab === 'calendar' && (
        <div className="calendar-view-selector">
          <button
            className={`view-btn ${calendarView === 'day' ? 'active' : ''}`}
            onClick={() => setCalendarView('day')}
          >
            Day
          </button>
          <button
            className={`view-btn ${calendarView === 'week' ? 'active' : ''}`}
            onClick={() => setCalendarView('week')}
          >
            Week
          </button>
          <button
            className={`view-btn ${calendarView === 'month' ? 'active' : ''}`}
            onClick={() => setCalendarView('month')}
          >
            Month
          </button>
        </div>
      )}

      {/* Content Section */}
      <div className="ce-content-section">
        {loading ? (
          <div className="ce-loading-state">
            <div className="loading-spinner"></div>
            <p>Loading {activeTab === 'calendar' ? 'events' : 'emails'}...</p>
          </div>
        ) : activeTab === 'calendar' ? (
          <div className="calendar-content">
            {calendarView === 'day' && (
              <div className="day-view">
                <div className="day-view-header">
                  <h3>{selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</h3>
                </div>
                <div className="day-timeline">
                  {Array.from({ length: 10 }, (_, i) => {
                    const hour = 9 + i;
                    const hourEvents = getDayEventsByHour()[hour] || [];
                    const timeStr = hour > 12 ? `${hour - 12}:00 PM` : hour === 12 ? '12:00 PM' : `${hour}:00 AM`;
                    
                    return (
                      <div key={hour} className="hour-slot">
                        <div className="hour-label">{timeStr}</div>
                        <div className="hour-content">
                          {hourEvents.map((event, idx) => (
                            <div key={idx} className="timeline-event">
                              <div className="event-time">
                                {new Date(event.start?.dateTime || event.start?.date).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                              </div>
                              <div className="event-title">{event.subject || event.summary}</div>
                              {event.location && (
                                <div className="event-location">
                                  {event.location.displayName || event.location}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {calendarView === 'week' && (
              <div className="week-view">
                <div className="week-grid-full">
                  {Array.from({ length: 7 }, (_, i) => {
                    const date = new Date();
                    date.setDate(date.getDate() + i);
                    const dayName = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][date.getDay()];
                    const dayNum = date.getDate();
                    const dayEvents = getEventsForDate(date);
                    const isToday = new Date().toDateString() === date.toDateString();
                    const isSelected = selectedDate.toDateString() === date.toDateString();

                    return (
                      <div 
                        key={i} 
                        className={`week-day-col ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''}`}
                        onClick={() => setSelectedDate(date)}
                      >
                        <div className="day-header">
                          <div className="day-name-week">{dayName}</div>
                          <div className="day-num-week">{dayNum}</div>
                        </div>
                        <div className="day-events-week">
                          {dayEvents.slice(0, 3).map((event, idx) => (
                            <div key={idx} className="week-event-badge">
                              {event.subject || event.summary}
                            </div>
                          ))}
                          {dayEvents.length > 3 && (
                            <div className="week-event-more">+{dayEvents.length - 3} more</div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {calendarView === 'month' && (
              <div className="month-view">
                <div className="month-header">
                  <h3>{selectedDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</h3>
                </div>
                <div className="month-grid">
                  {['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].map(day => (
                    <div key={day} className="month-day-header">{day}</div>
                  ))}
                  {(() => {
                    const { daysInMonth, startingDayOfWeek, year, month } = getDaysInMonth(selectedDate);
                    const days = [];
                    
                    for (let i = 0; i < startingDayOfWeek; i++) {
                      days.push(<div key={`empty-${i}`} className="month-day empty"></div>);
                    }
                    
                    for (let day = 1; day <= daysInMonth; day++) {
                      const date = new Date(year, month, day);
                      const dayEvents = getEventsForDate(date);
                      const isToday = new Date().toDateString() === date.toDateString();
                      
                      days.push(
                        <div 
                          key={day} 
                          className={`month-day ${isToday ? 'today' : ''}`}
                          onClick={() => setSelectedDate(date)}
                        >
                          <div className="month-day-num">{day}</div>
                          <div className="month-day-events">
                            {dayEvents.slice(0, 2).map((event, idx) => (
                              <div key={idx} className="month-event-dot"></div>
                            ))}
                          </div>
                        </div>
                      );
                    }
                    
                    return days;
                  })()}
                </div>
              </div>
            )}

            {/* Empty State */}
            {events.length === 0 && aiSuggestions.length === 0 && (
                <div className="empty-state">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                    <line x1="16" y1="2" x2="16" y2="6"></line>
                    <line x1="8" y1="2" x2="8" y2="6"></line>
                    <line x1="3" y1="10" x2="21" y2="10"></line>
                  </svg>
                <p>No upcoming events</p>
                  <button className="btn-add-event" onClick={handleNewMeeting}>Schedule Meeting</button>
                </div>
            )}
          </div>
        ) : (
          <div className="email-content">
            <div className="content-header">
              <h4>Recent Emails</h4>
              <span className="item-count">{emails.length} unread</span>
            </div>
            <div className="emails-list">
              {emails.length === 0 ? (
                <div className="empty-state">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                    <polyline points="22,6 12,13 2,6"></polyline>
                  </svg>
                  <p>Inbox Zero! 🎉</p>
                </div>
              ) : (
                emails.map((email, index) => (
                  <div 
                    key={index} 
                    className="email-card-modern" 
                    onClick={() => {
                      setSelectedEmail(email);
                      setShowEmailReader(true);
                    }}
                    style={{ cursor: 'pointer' }}
                  >
                    <div className="email-sender-avatar">
                      {(email.from?.emailAddress?.name || email.from?.name || email.from || 'U')[0].toUpperCase()}
                    </div>
                    <div className="email-content-wrapper">
                      <div className="email-header-row">
                        <div className="email-sender-name">
                          {email.from?.emailAddress?.name || email.from?.name || email.from}
                        </div>
                        <div className="email-time-badge">{formatEmailTime(email)}</div>
                      </div>
                      <div className="email-subject-modern">{email.subject}</div>
                      <div className="email-preview-modern">{email.bodyPreview || email.snippet}</div>
                      <div className="email-source-badge">
                        {email.source === 'outlook' ? 'Outlook' : 'Gmail'}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* New Meeting Modal - Rendered via Portal */}
      {showNewMeetingModal && createPortal(
        <NewMeetingModal
          onClose={() => {
            setShowNewMeetingModal(false);
            setSelectedSuggestion(null);
          }}
          onCreate={handleCreateMeeting}
          serviceConnected={microsoftConnected || googleConnected}
          serviceName={microsoftConnected ? 'Microsoft Teams' : 'Google Meet'}
          initialData={selectedSuggestion}
        />,
        document.body
      )}

      {/* Compose Email Modal - Rendered via Portal */}
      {showComposeModal && createPortal(
        <ComposeEmailModal
          onClose={() => {
            setShowComposeModal(false);
            setSelectedEmailTask(null);
          }}
          onSend={handleSendEmail}
          initialData={selectedEmailTask}
        />,
        document.body
      )}

      {/* Email Reader Modal - Rendered via Portal */}
      {showEmailReader && selectedEmail && createPortal(
        <EmailReaderModal
          email={selectedEmail}
          onClose={() => {
            setShowEmailReader(false);
            setSelectedEmail(null);
          }}
          onGenerateFollowUp={async () => {
            // Generate AI follow-up
            if (window.electronAPI?.ai?.generateEmailDraft) {
              try {
                const prompt = `Generate a professional follow-up email response to:\n\nFrom: ${selectedEmail.from?.emailAddress?.name || selectedEmail.from?.name || selectedEmail.from}\nSubject: ${selectedEmail.subject}\n\n${selectedEmail.body?.content || selectedEmail.bodyPreview || selectedEmail.snippet}`;
                
                const result = await window.electronAPI.ai.generateEmailDraft(prompt);
                
                if (result.success) {
                  // Open compose modal with AI-generated content
                  setSelectedEmailTask({
                    title: `Re: ${selectedEmail.subject}`,
                    description: result.draft,
                    taskData: {
                      to: selectedEmail.from?.emailAddress?.address || selectedEmail.from?.email || selectedEmail.from,
                      subject: `Re: ${selectedEmail.subject}`,
                      body: result.draft
                    }
                  });
                  setShowEmailReader(false);
                  setShowComposeModal(true);
                } else {
                  alert('Failed to generate AI follow-up: ' + result.error);
                }
              } catch (error) {
                console.error('Failed to generate AI follow-up:', error);
                alert('Failed to generate AI follow-up: ' + error.message);
              }
            } else {
              alert('AI service not available');
            }
          }}
        />,
        document.body
      )}
    </div>
  );
}

// New Meeting Modal Component
function NewMeetingModal({ onClose, onCreate, serviceConnected, serviceName, initialData }) {
  const [formData, setFormData] = useState({
    title: initialData?.title || '',
    startTime: '',
    endTime: '',
    attendees: initialData?.attendees?.join(', ') || '',
    description: initialData?.description || '',
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
  useEffect(() => {
    const now = new Date();
    const start = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour from now
    const end = new Date(start.getTime() + 30 * 60 * 1000); // 30 min duration
    
    setFormData(prev => ({
      ...prev,
      startTime: start.toISOString().slice(0, 16),
      endTime: end.toISOString().slice(0, 16)
    }));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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

// Compose Email Modal Component
function ComposeEmailModal({ onClose, onSend, initialData }) {
  const [emailData, setEmailData] = useState({
    to: '',
    subject: initialData?.title || '',
    body: ''
  });
  const [generatingDraft, setGeneratingDraft] = useState(false);
  const [hasGenerated, setHasGenerated] = useState(false);

  const handleChange = (e) => {
    setEmailData({
      ...emailData,
      [e.target.name]: e.target.value
    });
  };

  const handleGenerateAI = async () => {
    if (!emailData.to || !emailData.subject) {
      alert('Please enter recipient and subject first');
      return;
    }

    setGeneratingDraft(true);
    try {
      // Call AI to generate email content
      if (window.electronAPI?.ai?.generateEmail) {
        const result = await window.electronAPI.ai.generateEmail({
          to: emailData.to,
          subject: emailData.subject,
          context: initialData?.description || ''
        });

        if (result.success && result.content) {
          setEmailData(prev => ({
            ...prev,
            body: result.content
          }));
          setHasGenerated(true);
        }
      } else {
        // Fallback: Generate a simple template
        const template = `Hi,

I wanted to reach out regarding ${emailData.subject}.

${initialData?.description || 'Please let me know your thoughts on this matter.'}

Best regards`;
        
        setEmailData(prev => ({
          ...prev,
          body: template
        }));
        setHasGenerated(true);
      }
    } catch (error) {
      console.error('Failed to generate email:', error);
      alert('Failed to generate email content');
    } finally {
      setGeneratingDraft(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!emailData.body.trim()) {
      alert('Please generate or write email content');
      return;
    }
    onSend(emailData);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content ai-follow-up-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '8px', verticalAlign: 'middle' }}>
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
              <polyline points="22,6 12,13 2,6"></polyline>
            </svg>
            Compose Email
          </h2>
          <button className="modal-close" onClick={onClose}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          {/* Context from AI suggestion */}
          {initialData?.description && (
            <div className="original-email-context">
              <div className="context-label">Task Context:</div>
              <div className="context-subject">{initialData.description}</div>
            </div>
          )}

          {/* Recipient */}
          <div className="form-group">
            <label>To *</label>
            <input
              type="text"
              name="to"
              value={emailData.to}
              onChange={handleChange}
              placeholder="recipient@example.com, another@example.com"
              required
            />
            <small style={{ color: '#86868b', fontSize: '11px', marginTop: '4px', display: 'block' }}>
              Separate multiple recipients with commas
            </small>
          </div>

          {/* Subject */}
          <div className="form-group">
            <label>Subject *</label>
            <input
              type="text"
              name="subject"
              value={emailData.subject}
              onChange={handleChange}
              placeholder="Email subject"
              required
            />
          </div>

          {/* AI Generate Button */}
          {!hasGenerated && (
            <div className="form-group">
              <button
                type="button"
                className="btn-ai-generate"
                onClick={handleGenerateAI}
                disabled={generatingDraft || !emailData.to || !emailData.subject}
                style={{
                  width: '100%',
                  padding: '12px',
                  background: 'linear-gradient(135deg, #007aff 0%, #5856d6 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '10px',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: generatingDraft ? 'wait' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  opacity: (!emailData.to || !emailData.subject) ? 0.5 : 1
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
                </svg>
                {generatingDraft ? 'Generating AI Draft...' : 'Generate AI Draft'}
              </button>
            </div>
          )}

          {/* Email Body */}
          <div className="form-group draft-editor">
            <label>Message *</label>
            {generatingDraft ? (
              <div className="generating-draft">
                <div className="spinner-container">
                  <div className="spinner"></div>
                </div>
                <p>AI is drafting your email...</p>
              </div>
            ) : (
              <textarea
                name="body"
                value={emailData.body}
                onChange={handleChange}
                placeholder="Write your email or generate AI content..."
                rows="12"
                className="draft-textarea"
                required
              />
            )}
          </div>

          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn-send-primary"
              disabled={generatingDraft || !emailData.body.trim()}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13"></line>
                <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
              </svg>
              Send Email
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Email Reader Modal Component
function EmailReaderModal({ email, onClose, onGenerateFollowUp }) {
  const [generatingFollowUp, setGeneratingFollowUp] = useState(false);

  const handleGenerateFollowUp = async () => {
    setGeneratingFollowUp(true);
    try {
      await onGenerateFollowUp();
    } finally {
      setGeneratingFollowUp(false);
    }
  };

  // Extract email body content
  const getEmailBody = () => {
    if (email.body?.content) {
      // Microsoft email with HTML body
      return email.body.content;
    } else if (email.bodyPreview) {
      // Microsoft email preview
      return email.bodyPreview;
    } else if (email.snippet) {
      // Gmail snippet
      return email.snippet;
    }
    return 'No content available';
  };

  const emailBody = getEmailBody();
  const isHtml = email.body?.contentType === 'html' || email.body?.contentType === 'HTML';

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content email-reader-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '800px', maxHeight: '90vh' }}>
        {/* Header */}
        <div className="modal-header" style={{ borderBottom: '1px solid #e0e0e0', paddingBottom: '16px' }}>
          <div style={{ flex: 1 }}>
            <h2 style={{ fontSize: '20px', fontWeight: 600, color: '#1d1d1f', marginBottom: '8px' }}>
              {email.subject}
            </h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '13px', color: '#86868b' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div className="email-sender-avatar" style={{ width: '32px', height: '32px', fontSize: '14px' }}>
                  {(email.from?.emailAddress?.name || email.from?.name || email.from || 'U')[0].toUpperCase()}
                </div>
                <div>
                  <div style={{ fontWeight: 500, color: '#1d1d1f' }}>
                    {email.from?.emailAddress?.name || email.from?.name || email.from}
                  </div>
                  <div style={{ fontSize: '12px' }}>
                    {email.from?.emailAddress?.address || email.from?.email || ''}
                  </div>
                </div>
              </div>
              <span>•</span>
              <span>{new Date(email.receivedDateTime || email.internalDate).toLocaleString()}</span>
            </div>
          </div>
          <button onClick={onClose} className="modal-close-btn">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        {/* Email Body */}
        <div className="email-reader-body" style={{ 
          flex: 1, 
          overflowY: 'auto', 
          padding: '24px 0',
          fontSize: '14px',
          lineHeight: '1.6',
          color: '#1d1d1f'
        }}>
          {isHtml ? (
            <div dangerouslySetInnerHTML={{ __html: emailBody }} />
          ) : (
            <div style={{ whiteSpace: 'pre-wrap' }}>{emailBody}</div>
          )}
        </div>

        {/* Actions */}
        <div className="modal-actions" style={{ 
          borderTop: '1px solid #e0e0e0', 
          paddingTop: '16px',
          display: 'flex',
          gap: '12px'
        }}>
          <button
            onClick={handleGenerateFollowUp}
            disabled={generatingFollowUp}
            style={{
              flex: 1,
              padding: '12px 24px',
              background: 'linear-gradient(135deg, #007aff 0%, #5856d6 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '10px',
              fontSize: '14px',
              fontWeight: 600,
              cursor: generatingFollowUp ? 'wait' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
            </svg>
            {generatingFollowUp ? 'Generating AI Follow-up...' : 'Generate AI Follow-up'}
          </button>
          <button
            onClick={onClose}
            style={{
              padding: '12px 24px',
              background: '#f5f5f7',
              color: '#1d1d1f',
              border: 'none',
              borderRadius: '10px',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
