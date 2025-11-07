import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './CalendarCarousel.css';
import SlimHeader from '../common/SlimHeader';

/**
 * CalendarCarousel - Displays unified calendar with AI suggestions
 * Shows events from Google Calendar and Outlook
 */
export default function CalendarCarousel({ onSelectEvent, user }) {
  const navigate = useNavigate();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [viewMode, setViewMode] = useState('week'); // 'day', 'week', 'month'
  const [aiSuggestions, setAiSuggestions] = useState([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showNewMeetingModal, setShowNewMeetingModal] = useState(false);
  const [lastFetchTime, setLastFetchTime] = useState({});
  const [cachedEvents, setCachedEvents] = useState({});

  // Cache duration: 3 minutes for calendar (shorter since events change more frequently)
  const CACHE_DURATION = 3 * 60 * 1000;

  useEffect(() => {
    loadEvents();
    loadSlackSuggestions(); // Load Slack-based calendar suggestions
  }, [viewMode, currentDate]);

  const loadSlackSuggestions = async () => {
    try {
      setLoadingSuggestions(true);
      console.log('🤖 Loading Slack calendar suggestions...');
      
      // Fetch user tasks from Slack with calendar work_type
      if (window.electronAPI?.tasks?.getAll) {
        const result = await window.electronAPI.tasks.getAll();
        
        console.log('🤖 Tasks result:', result);
        
        if (result && Array.isArray(result)) {
          // Filter for calendar tasks that aren't completed
          const calendarTasks = result
            .filter(task => {
              const isCalendar = task.work_type === 'calendar';
              const notCompleted = task.status !== 'completed';
              console.log('🤖 Task:', task.title, 'work_type:', task.work_type, 'status:', task.status, 'include?', isCalendar && notCompleted);
              return isCalendar && notCompleted;
            })
            .map(task => ({
              id: task.id,
              type: 'meeting',
              priority: task.priority || 'medium',
              title: task.title || task.session_title || 'Schedule meeting',
              description: task.description || 'AI-detected meeting suggestion from Slack',
              action: 'Schedule',
              icon: '📅',
              taskData: task
            }));
          
          console.log('🤖 Loaded', calendarTasks.length, 'Slack calendar suggestions:', calendarTasks);
          setAiSuggestions(calendarTasks);
        } else {
          console.warn('🤖 No tasks array returned');
        }
      } else {
        console.warn('🤖 tasks.getAll API not available');
      }
    } catch (error) {
      console.error('🤖 Error loading Slack calendar suggestions:', error);
      setAiSuggestions([]);
    } finally {
      setLoadingSuggestions(false);
    }
  };

  const loadEvents = async (forceRefresh = false) => {
    try {
      const { startDate, endDate } = getDateRange();
      const cacheKey = `${viewMode}-${startDate.toISOString()}-${endDate.toISOString()}`;

      // Check cache validity
      const now = Date.now();
      const cacheValid = lastFetchTime[cacheKey] && (now - lastFetchTime[cacheKey]) < CACHE_DURATION;

      if (cacheValid && cachedEvents[cacheKey] && !forceRefresh) {
        console.log('📅 CalendarCarousel: Using cached events for', cacheKey);
        setEvents(cachedEvents[cacheKey]);
        setLoading(false);
        return;
      }

      setLoading(true);
      console.log('📅 CalendarCarousel: Loading events for', viewMode, 'view');

      const result = await window.electronAPI.missionControl.getCalendar({
        startDateTime: startDate.toISOString(),
        endDateTime: endDate.toISOString()
      });

      console.log('📅 CalendarCarousel: Result:', result);

      if (result.success && result.events) {
        console.log('📅 CalendarCarousel: Loaded', result.events.length, 'events');
        setEvents(result.events);

        // Update cache
        setCachedEvents(prev => ({ ...prev, [cacheKey]: result.events }));
        setLastFetchTime(prev => ({ ...prev, [cacheKey]: now }));
      }
    } catch (error) {
      console.error('📅 CalendarCarousel: Error loading events:', error);
    } finally {
      setLoading(false);
    }
  };

  const getDateRange = () => {
    const start = new Date(currentDate);
    let end = new Date(currentDate);

    if (viewMode === 'day') {
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
    } else if (viewMode === 'week') {
      // Start of week (Sunday)
      const day = start.getDay();
      start.setDate(start.getDate() - day);
      start.setHours(0, 0, 0, 0);
      
      // End of week (Saturday)
      end.setDate(start.getDate() + 6);
      end.setHours(23, 59, 59, 999);
    } else if (viewMode === 'month') {
      // Start of month
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      
      // End of month
      end.setMonth(start.getMonth() + 1);
      end.setDate(0);
      end.setHours(23, 59, 59, 999);
    }

    return { startDate: start, endDate: end };
  };

  // Get events for a specific date
  const getEventsForDate = (date) => {
    return events.filter(event => {
      const eventDate = new Date(event.start?.dateTime || event.start?.date);
      return eventDate.toDateString() === date.toDateString();
    }).sort((a, b) => {
      const aTime = new Date(a.start?.dateTime || a.start?.date);
      const bTime = new Date(b.start?.dateTime || b.start?.date);
      return aTime - bTime;
    });
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

  // Filter events based on search query and date range
  const filteredEvents = events.filter(event => {
    // Get event start time
    const eventStart = new Date(event.start?.dateTime || event.start?.date);
    const now = new Date();
    
    // Only show events that haven't ended yet (future or ongoing)
    const eventEnd = new Date(event.end?.dateTime || event.end?.date);
    if (eventEnd < now) {
      return false; // Skip past events
    }
    
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        event.subject?.toLowerCase().includes(query) ||
        event.summary?.toLowerCase().includes(query) ||
        event.organizer?.emailAddress?.name?.toLowerCase().includes(query) ||
        event.organizer?.email?.toLowerCase().includes(query)
      );
    }
    
    return true;
  });

  const getProviderIcon = (event) => {
    const source = event.source?.toLowerCase();
    
    // Google Calendar
    if (source === 'google') {
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <path d="M12 0C5.383 0 0 5.383 0 12s5.383 12 12 12 12-5.383 12-12S18.617 0 12 0z" fill="#4285F4"/>
          <path d="M19.5 12c0 .34-.03.67-.08 1H12v-3h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57C20.88 14.48 21.5 13.34 21.5 12z" fill="#FFF"/>
          <path d="M12 22c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 19.53 7.7 22 12 22z" fill="#34A853"/>
          <path d="M5.84 13.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V6.07H2.18C1.43 7.55 1 9.22 1 11s.43 3.45 1.18 4.93l2.85-2.21.81-.63z" fill="#FBBC05"/>
          <path d="M12 4.75c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 1.09 14.97 0 12 0 7.7 0 3.99 2.47 2.18 6.07l3.66 2.84c.87-2.6 3.3-4.16 6.16-4.16z" fill="#EA4335"/>
        </svg>
      );
    }
    
    // Outlook Calendar
    if (source === 'microsoft' || source === 'outlook') {
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
    
    // Default calendar icon
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
        <line x1="16" y1="2" x2="16" y2="6"></line>
        <line x1="8" y1="2" x2="8" y2="6"></line>
        <line x1="3" y1="10" x2="21" y2="10"></line>
      </svg>
    );
  };

  const formatEventTime = (event) => {
    const start = new Date(event.start?.dateTime || event.start?.date);
    const end = new Date(event.end?.dateTime || event.end?.date);
    
    const timeFormat = { hour: 'numeric', minute: '2-digit', hour12: true };
    const startTime = start.toLocaleTimeString('en-US', timeFormat);
    const endTime = end.toLocaleTimeString('en-US', timeFormat);
    
    return `${startTime} - ${endTime}`;
  };

  const formatEventDate = (event) => {
    const start = new Date(event.start?.dateTime || event.start?.date);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    if (start.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (start.toDateString() === tomorrow.toDateString()) {
      return 'Tomorrow';
    } else {
      return start.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    }
  };

  const handleEventClick = (event) => {
    console.log('📅 Event clicked:', event);
    setSelectedEvent(event);
    if (onSelectEvent) {
      onSelectEvent(event);
    }
  };

  const handleBackToList = () => {
    setSelectedEvent(null);
  };

  const navigateDate = (direction) => {
    const newDate = new Date(currentDate);
    
    if (viewMode === 'day') {
      newDate.setDate(newDate.getDate() + direction);
    } else if (viewMode === 'week') {
      newDate.setDate(newDate.getDate() + (direction * 7));
    } else if (viewMode === 'month') {
      newDate.setMonth(newDate.getMonth() + direction);
    }
    
    setCurrentDate(newDate);
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const getDateRangeLabel = () => {
    const { startDate, endDate } = getDateRange();
    
    if (viewMode === 'day') {
      return currentDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    } else if (viewMode === 'week') {
      return `${startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
    } else if (viewMode === 'month') {
      return currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    }
  };

  // If an event is selected, show the event detail view
  if (selectedEvent) {
    return (
      <div className="calendar-view">
        <div className="event-detail-view">
          {/* Header */}
          <div className="event-detail-header">
            <button className="back-btn" onClick={handleBackToList}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="15 18 9 12 15 6"></polyline>
              </svg>
              Back to Calendar
            </button>
            
            <div className="event-actions">
              <button className="action-btn">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                </svg>
                Edit
              </button>
              <button className="action-btn primary">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M15.05 5A5 5 0 0 1 19 8.95M15.05 1A9 9 0 0 1 23 8.94m-1 7.98v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
                </svg>
                Join Meeting
              </button>
            </div>
          </div>

          {/* Event Content */}
          <div className="event-detail-content">
            <div className="event-detail-meta">
              <div className="event-detail-header-info">
                <div className="event-provider-icon">
                  {getProviderIcon(selectedEvent)}
                </div>
                <div>
                  <div className="event-detail-title">{selectedEvent.subject || selectedEvent.summary}</div>
                  <div className="event-detail-organizer">
                    {selectedEvent.organizer?.emailAddress?.name || selectedEvent.organizer?.email || 'Unknown'}
                  </div>
                </div>
              </div>
              
              <div className="event-detail-time">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"></circle>
                  <polyline points="12 6 12 12 16 14"></polyline>
                </svg>
                <div>
                  <div className="event-time-primary">{formatEventDate(selectedEvent)}</div>
                  <div className="event-time-secondary">{formatEventTime(selectedEvent)}</div>
                </div>
              </div>

              {selectedEvent.location && (
                <div className="event-detail-location">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                    <circle cx="12" cy="10" r="3"></circle>
                  </svg>
                  <span>{selectedEvent.location}</span>
                </div>
              )}

              {selectedEvent.attendees && selectedEvent.attendees.length > 0 && (
                <div className="event-detail-attendees">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                    <circle cx="9" cy="7" r="4"></circle>
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                    <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                  </svg>
                  <div>
                    <div className="attendees-count">{selectedEvent.attendees.length} attendees</div>
                    <div className="attendees-list">
                      {selectedEvent.attendees.slice(0, 5).map((attendee, idx) => (
                        <span key={idx}>{attendee.emailAddress?.name || attendee.email}</span>
                      ))}
                      {selectedEvent.attendees.length > 5 && (
                        <span>+{selectedEvent.attendees.length - 5} more</span>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {selectedEvent.body?.content || selectedEvent.bodyPreview || selectedEvent.description ? (
              <div className="event-detail-body">
                <h4>Description</h4>
                <div className="event-description-content">
                  {selectedEvent.body?.content || selectedEvent.bodyPreview || selectedEvent.description}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="calendar-view">
        <div className="calendar-loading">
          <div className="spinner"></div>
          <p>Loading calendar...</p>
        </div>
      </div>
    );
  }

  const handleTeamsClick = () => {
    // Navigate to Mission Control in team mode
    navigate('/mission-control?mode=team');
  };

  const handleSettingsClick = () => {
    // Navigate to Settings page
    navigate('/settings');
  };

  return (
    <div className="calendar-view">
      {/* Slim Header Bar */}
      <SlimHeader
        title="Calendar"
        onTeamsClick={handleTeamsClick}
        onSettingsClick={handleSettingsClick}
      />

      {/* Header */}
      <div className="calendar-header">
        <div className="calendar-header-top">
          <h1>Calendar</h1>
          <button className="new-meeting-btn" onClick={() => setShowNewMeetingModal(true)}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            New Meeting
          </button>
        </div>
        
        {/* View Mode Toggle */}
        <div className="view-mode-toggle">
          <button 
            className={`view-btn ${viewMode === 'day' ? 'active' : ''}`}
            onClick={() => setViewMode('day')}
          >
            Day
          </button>
          <button 
            className={`view-btn ${viewMode === 'week' ? 'active' : ''}`}
            onClick={() => setViewMode('week')}
          >
            Week
          </button>
          <button 
            className={`view-btn ${viewMode === 'month' ? 'active' : ''}`}
            onClick={() => setViewMode('month')}
          >
            Month
          </button>
        </div>
      </div>

      {/* Date Navigation */}
      <div className="date-navigation">
        <button className="nav-btn" onClick={() => navigateDate(-1)}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="15 18 9 12 15 6"></polyline>
          </svg>
        </button>
        <div className="date-range-label">{getDateRangeLabel()}</div>
        <button className="nav-btn" onClick={() => navigateDate(1)}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="9 18 15 12 9 6"></polyline>
          </svg>
        </button>
        <button className="today-btn" onClick={goToToday}>Today</button>
      </div>

      {/* AI Suggestions Section */}
      {aiSuggestions.length > 0 && (
        <div className="ai-suggestions-section">
          <div className="suggestions-header">
            <div className="suggestions-title">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2L2 7l10 5 10-5-10-5z"></path>
                <path d="M2 17l10 5 10-5"></path>
                <path d="M2 12l10 5 10-5"></path>
              </svg>
              <h3>AI Suggestions</h3>
              <span className="suggestions-count">{aiSuggestions.length}</span>
            </div>
          </div>
          
          <div className="suggestions-list">
            {aiSuggestions.map((suggestion) => (
              <div 
                key={suggestion.id} 
                className={`suggestion-card priority-${suggestion.priority}`}
                onClick={() => {
                  // For Slack tasks, we can show task details or open scheduling modal
                  console.log('📅 Slack calendar suggestion clicked:', suggestion.taskData);
                  // You can add a handler here to open a scheduling modal
                }}
              >
                <div className="suggestion-icon">{suggestion.icon}</div>
                <div className="suggestion-content">
                  <div className="suggestion-title">{suggestion.title}</div>
                  <div className="suggestion-description">{suggestion.description}</div>
                </div>
                <button className="suggestion-action-btn" onClick={(e) => {
                  e.stopPropagation();
                  console.log('📅 Schedule action for:', suggestion.taskData);
                  // You can add a handler here to open a scheduling modal
                }}>
                  {suggestion.action}
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="9 18 15 12 9 6"></polyline>
                  </svg>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Calendar Content - Different Views */}
      <div className="calendar-content" data-view={viewMode}>
        {viewMode === 'week' && (
          <div className="week-grid-view">
            {Array.from({ length: 7 }, (_, i) => {
              const date = new Date(currentDate);
              date.setDate(date.getDate() + i - date.getDay());
              const dayName = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][date.getDay()];
              const dayNum = date.getDate();
              const dayEvents = getEventsForDate(date);
              const isToday = new Date().toDateString() === date.toDateString();

              return (
                <div 
                  key={i} 
                  className={`week-day-card ${isToday ? 'today' : ''}`}
                  onClick={() => setCurrentDate(date)}
                >
                  <div className="week-day-header">
                    <div className="week-day-name">{dayName}</div>
                    <div className="week-day-number">{dayNum}</div>
                  </div>
                  <div className="week-day-events">
                    {dayEvents.slice(0, 2).map((event, idx) => (
                      <div 
                        key={idx} 
                        className="week-event-item"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEventClick(event);
                        }}
                      >
                        {event.subject || event.summary}
                      </div>
                    ))}
                    {dayEvents.length > 2 && (
                      <div className="week-event-count">+{dayEvents.length - 2} more</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {viewMode === 'month' && (
          <div className="month-grid-view">
            <div className="month-calendar-grid">
              {['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].map(day => (
                <div key={day} className="month-day-header">{day}</div>
              ))}
              {(() => {
                const { daysInMonth, startingDayOfWeek, year, month } = getDaysInMonth(currentDate);
                const days = [];
                
                for (let i = 0; i < startingDayOfWeek; i++) {
                  days.push(<div key={`empty-${i}`} className="month-day-cell empty"></div>);
                }
                
                for (let day = 1; day <= daysInMonth; day++) {
                  const date = new Date(year, month, day);
                  const dayEvents = getEventsForDate(date);
                  const isToday = new Date().toDateString() === date.toDateString();
                  
                  days.push(
                    <div 
                      key={day} 
                      className={`month-day-cell ${isToday ? 'today' : ''}`}
                      onClick={() => setCurrentDate(date)}
                    >
                      <div className="month-day-number">{day}</div>
                      <div className="month-day-events-list">
                        {dayEvents.slice(0, 3).map((_, idx) => (
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

        {viewMode === 'day' && (
          <div className="day-timeline-view">
            <div className="day-timeline">
              <div className="timeline-hours">
                {Array.from({ length: 10 }, (_, i) => {
                  const hour = 9 + i;
                  const timeStr = hour > 12 ? `${hour - 12}P` : hour === 12 ? '12P' : `${hour}A`;
                  return <div key={hour} className="timeline-hour">{timeStr}</div>;
                })}
              </div>
              <div className="timeline-events">
                {Array.from({ length: 10 }, (_, i) => {
                  const hour = 9 + i;
                  const hourEvents = getEventsForDate(currentDate).filter(event => {
                    const eventHour = new Date(event.start?.dateTime || event.start?.date).getHours();
                    return eventHour === hour;
                  });
                  
                  return (
                    <div key={hour} className="timeline-event-slot">
                      {hourEvents.map((event, idx) => (
                        <div 
                          key={idx}
                          className="timeline-event-block"
                          onClick={() => handleEventClick(event)}
                        >
                          {event.subject || event.summary}
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Fallback: Event List */}
        {!viewMode || (viewMode !== 'day' && viewMode !== 'week' && viewMode !== 'month') && (
          <>
            <div className="calendar-section-header">
              <h3>Upcoming Events</h3>
              <span className="event-count">{filteredEvents.length} events</span>
            </div>
            {filteredEvents.length === 0 ? (
              <div className="calendar-empty">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                  <line x1="16" y1="2" x2="16" y2="6"></line>
                  <line x1="8" y1="2" x2="8" y2="6"></line>
                  <line x1="3" y1="10" x2="21" y2="10"></line>
                </svg>
                <p>No events found</p>
                <span>Try adjusting your filters or date range</span>
              </div>
            ) : (
              <div className="event-list">
                {filteredEvents.map((event) => (
                  <div 
                    key={event.id} 
                    className="event-item"
                    onClick={() => handleEventClick(event)}
                  >
                    {/* Time indicator */}
                    <div className="event-time-indicator">
                      <div className="event-date">{formatEventDate(event)}</div>
                      <div className="event-time">{formatEventTime(event)}</div>
                    </div>

                    {/* Provider Icon */}
                    <div className="event-provider-icon">
                      {getProviderIcon(event)}
                    </div>

                    {/* Content */}
                    <div className="event-content">
                      <div className="event-title">{event.subject || event.summary}</div>
                      <div className="event-organizer">
                        {event.organizer?.emailAddress?.name || event.organizer?.email || 'Unknown organizer'}
                      </div>
                      {event.location && (
                        <div className="event-location">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                            <circle cx="12" cy="10" r="3"></circle>
                          </svg>
                          {event.location}
                        </div>
                      )}
                    </div>

                    {/* Attendees count */}
                    {event.attendees && event.attendees.length > 0 && (
                      <div className="event-attendees-badge">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                          <circle cx="9" cy="7" r="4"></circle>
                          <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                          <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                        </svg>
                        {event.attendees.length}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* New Meeting Modal */}
      {showNewMeetingModal && (
        <div className="modal-overlay" onClick={() => setShowNewMeetingModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>New Meeting</h2>
              <button className="modal-close" onClick={() => setShowNewMeetingModal(false)}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
            <div className="modal-body">
              <p>New meeting modal coming soon! This will allow you to:</p>
              <ul>
                <li>Schedule meetings with Google Calendar or Outlook</li>
                <li>Add attendees and meeting details</li>
                <li>Generate meeting links automatically</li>
                <li>Set reminders and notifications</li>
              </ul>
              <p style={{ marginTop: '20px', color: '#64748b', fontSize: '14px' }}>
                For now, you can click on the "Schedule" button in AI Suggestions to schedule meetings from Slack tasks.
              </p>
            </div>
            <div className="modal-footer">
              <button className="modal-btn-secondary" onClick={() => setShowNewMeetingModal(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
