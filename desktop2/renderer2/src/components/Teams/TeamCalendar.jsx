import { useState, useEffect } from 'react';
import './TeamCalendar.css';

// SVG Icons as components
const CalendarIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
    <line x1="16" y1="2" x2="16" y2="6"></line>
    <line x1="8" y1="2" x2="8" y2="6"></line>
    <line x1="3" y1="10" x2="21" y2="10"></line>
  </svg>
);

const ClockIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"></circle>
    <polyline points="12 6 12 12 16 14"></polyline>
  </svg>
);

const UsersIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
    <circle cx="9" cy="7" r="4"></circle>
    <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
    <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
  </svg>
);

const VideoIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="23 7 16 12 23 17 23 7"></polygon>
    <rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
  </svg>
);

export default function TeamCalendar({ selectedTeam }) {
  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!selectedTeam?.id) {
      setMeetings([]);
      setLoading(false);
      return;
    }

    loadUpcomingMeetings();
  }, [selectedTeam]);

  const loadUpcomingMeetings = async () => {
    setLoading(true);
    try {
      console.log('Loading upcoming meetings for team:', selectedTeam.name, 'ID:', selectedTeam.id);
      
      const result = await window.electronAPI.teamChat.getUpcomingMeetings(selectedTeam.id);
      
      console.log('Meetings result:', result);
      
      if (result.success) {
        console.log(`Loaded ${result.meetings?.length || 0} upcoming meetings`);
        setMeetings(result.meetings || []);
      } else {
        console.error('Failed to load meetings:', result.error);
        setMeetings([]);
      }
    } catch (error) {
      console.error('Error loading meetings:', error);
      setMeetings([]);
    } finally {
      setLoading(false);
    }
  };

  const formatMeetingTime = (startTime) => {
    const date = new Date(startTime);
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    // Check if today
    if (date.toDateString() === now.toDateString()) {
      return {
        day: 'Today',
        time: date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
      };
    }
    
    // Check if tomorrow
    if (date.toDateString() === tomorrow.toDateString()) {
      return {
        day: 'Tomorrow',
        time: date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
      };
    }
    
    // This week
    const daysDiff = Math.ceil((date - now) / (1000 * 60 * 60 * 24));
    if (daysDiff <= 7) {
      return {
        day: date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' }),
        time: date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
      };
    }
    
    // Future
    return {
      day: date.toLocaleDateString([], { month: 'short', day: 'numeric' }),
      time: date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    };
  };

  const getMeetingDuration = (startTime, endTime) => {
    if (!endTime) return '';
    const start = new Date(startTime);
    const end = new Date(endTime);
    const minutes = Math.round((end - start) / (1000 * 60));
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  const getInitials = (names) => {
    if (!names || names.length === 0) return [];
    return names.slice(0, 3).map(name => 
      name.split(' ').map(n => n[0]).join('').toUpperCase()
    );
  };

  if (!selectedTeam) {
    return (
      <div className="team-calendar-empty">
        <div className="empty-icon"><CalendarIcon /></div>
        <p>Select a team to view their calendar</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="team-calendar-loading">
        <div className="spinner"></div>
        <span>Loading calendar...</span>
      </div>
    );
  }

  return (
    <div className="team-calendar">
      <div className="calendar-header">
        <div className="calendar-icon"><CalendarIcon /></div>
        <h3>Upcoming Meetings</h3>
      </div>

      {meetings.length === 0 ? (
        <div className="no-meetings">
          <p>No upcoming meetings scheduled</p>
        </div>
      ) : (
        <div className="meetings-list">
          {meetings.map((meeting, idx) => {
            const timeInfo = formatMeetingTime(meeting.start_time);
            const duration = getMeetingDuration(meeting.start_time, meeting.end_time);
            const attendeeInitials = getInitials(meeting.attendees);
            
            return (
              <div key={meeting.id || idx} className="meeting-card">
                <div className="meeting-card-header">
                  <div className="meeting-time-badge">
                    <span className="meeting-day">{timeInfo.day}</span>
                    <span className="meeting-time">{timeInfo.time}</span>
                  </div>
                  <span className="meeting-type-badge">
                    {meeting.metadata?.platform === 'Google Meet' ? 'Google Meet' : 'Zoom'}
                  </span>
                </div>
                
                <h4 className="meeting-title">{meeting.title}</h4>
                
                <div className="meeting-details">
                  <div className="detail-row">
                    <ClockIcon />
                    <span className="detail-text">{duration || 'Duration TBD'}</span>
                  </div>
                  
                  {meeting.attendees && meeting.attendees.length > 0 && (
                    <div className="detail-row">
                      <UsersIcon />
                      <div className="attendees-container">
                        <div className="attendee-avatars">
                          {attendeeInitials.map((initial, idx) => (
                            <div key={idx} className="attendee-avatar" title={meeting.attendees[idx]}>
                              {initial}
                            </div>
                          ))}
                          {meeting.attendees.length > 3 && (
                            <div className="attendee-avatar attendee-more">
                              +{meeting.attendees.length - 3}
                            </div>
                          )}
                        </div>
                        <span className="attendee-text">
                          {meeting.attendees.length} {meeting.attendees.length === 1 ? 'attendee' : 'attendees'}
                        </span>
                      </div>
                    </div>
                  )}
                  
                  {meeting.metadata?.platform && (
                    <div className="detail-row">
                      <VideoIcon />
                      <span className="detail-text">{meeting.metadata.platform}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

