import { useState, useEffect } from 'react';
import './TeamCalendar.css';

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
      console.log('📅 Loading upcoming meetings for team:', selectedTeam.name, 'ID:', selectedTeam.id);
      
      const result = await window.electronAPI.teamChat.getUpcomingMeetings(selectedTeam.id);
      
      console.log('📅 Meetings result:', result);
      
      if (result.success) {
        console.log(`✅ Loaded ${result.meetings?.length || 0} upcoming meetings`);
        setMeetings(result.meetings || []);
      } else {
        console.error('❌ Failed to load meetings:', result.error);
        setMeetings([]);
      }
    } catch (error) {
      console.error('❌ Error loading meetings:', error);
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

  if (!selectedTeam) {
    return (
      <div className="team-calendar-empty">
        <div className="empty-icon">📅</div>
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
        <div className="calendar-icon">📅</div>
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
            
            return (
              <div key={meeting.id || idx} className="meeting-card">
                <div className="meeting-time-badge">
                  <span className="meeting-day">{timeInfo.day}</span>
                  <span className="meeting-time">{timeInfo.time}</span>
                </div>
                <div className="meeting-details">
                  <h4 className="meeting-title">{meeting.title}</h4>
                  {meeting.attendees && meeting.attendees.length > 0 && (
                    <div className="meeting-attendees">
                      👥 {meeting.attendees.slice(0, 3).join(', ')}
                      {meeting.attendees.length > 3 && ` +${meeting.attendees.length - 3}`}
                    </div>
                  )}
                  <div className="meeting-meta">
                    {duration && <span className="meeting-duration">⏱️ {duration}</span>}
                    {meeting.metadata?.platform && (
                      <span className="meeting-platform">
                        {meeting.metadata.platform === 'Google Meet' ? '📹' : '🎥'} {meeting.metadata.platform}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

