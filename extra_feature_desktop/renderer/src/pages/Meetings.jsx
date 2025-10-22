import React, { useState, useEffect } from 'react';
import MeetingSelector from '../components/MeetingSelector';
import MeetingSummary from '../components/MeetingSummary';
import './Meetings.css';

function Meetings({ user }) {
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('upcoming'); // 'upcoming' or 'summaries'
  const [upcomingMeetings, setUpcomingMeetings] = useState([]);
  const [meetingSummaries, setMeetingSummaries] = useState([]);
  const [selectedMeeting, setSelectedMeeting] = useState(null);
  const [processingMeeting, setProcessingMeeting] = useState(null);

  useEffect(() => {
    if (view === 'upcoming') {
      loadUpcomingMeetings();
    } else {
      loadMeetingSummaries();
    }
  }, [view, user]);

  const loadUpcomingMeetings = async () => {
    try {
      setLoading(true);
      
      // Fetch from database (not live API) for next 14 days
      const result = await window.electronAPI.meeting.getSummaries({
        startDate: new Date(),
        endDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
      });
      
      if (result.success) {
        setUpcomingMeetings(result.meetings || []);
      }
    } catch (error) {
      console.error('Failed to load upcoming meetings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSyncNow = async () => {
    try {
      setLoading(true);
      
      // Fetch fresh from Outlook and save to database
      const result = await window.electronAPI.meeting.getUpcoming({ 
        days: 14,
        saveToDatabase: true 
      });
      
      if (result.success) {
        // Reload from database to show updated data
        await loadUpcomingMeetings();
        alert('✅ Meetings synced successfully!');
      } else {
        alert('Failed to sync meetings: ' + (result.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Failed to sync meetings:', error);
      alert('Failed to sync meetings. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const loadMeetingSummaries = async () => {
    try {
      setLoading(true);
      const result = await window.electronAPI.meeting.getSummaries({
        startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // Include future meetings too
      });
      
      if (result.success) {
        // Filter to only show meetings that have notes or AI summaries
        const meetingsWithContent = (result.meetings || []).filter(m => 
          m.manual_notes || m.copilot_notes || m.ai_summary
        );
        setMeetingSummaries(meetingsWithContent);
      }
    } catch (error) {
      console.error('Failed to load meeting summaries:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkImportant = async (meeting, isImportant) => {
    try {
      setProcessingMeeting(meeting.meeting_id);
      
      // If marking as important, check Copilot readiness and show appropriate warnings/reminders
      if (isImportant) {
        // Check if Teams meeting from the meeting object directly
        const isTeamsMeeting = !!(meeting.online_meeting_url || meeting.metadata?.online_meeting_url);
        const meetingEnded = new Date(meeting.end_time) < new Date();
        
        if (!isTeamsMeeting && !meetingEnded) {
          // Not a Teams meeting - show warning
          const proceed = confirm(
            `⚠️ "${meeting.title}" is not a Teams meeting.\n\n` +
            `Copilot transcripts are only available for Teams meetings with recording enabled.\n\n` +
            `You can still mark this as important, but notes must be added manually after the meeting.\n\n` +
            `Continue marking as important?`
          );
          
          if (!proceed) {
            setProcessingMeeting(null);
            return;
          }
        } else if (isTeamsMeeting && !meetingEnded) {
          // Teams meeting - show recording reminder
          alert(
            `✅ "${meeting.title}" is a Teams meeting.\n\n` +
            `📝 Remember to start recording when the meeting begins!\n\n` +
            `Copilot transcripts are only generated for recorded meetings. ` +
            `The app will automatically fetch the transcript within minutes after the meeting ends.`
          );
        } else if (isTeamsMeeting && meetingEnded) {
          // Meeting already ended - will try to fetch immediately
          alert(
            `✅ "${meeting.title}" has already ended.\n\n` +
            `🔍 I'll check for Copilot transcripts immediately. ` +
            `If the meeting was recorded, the transcript should be available within a few minutes.`
          );
        }
      }
      
      const result = await window.electronAPI.meeting.save(
        user.id,
        meeting,
        { is_important: isImportant }
      );

      if (result.success) {
        // Refresh the list
        if (view === 'upcoming') {
          await loadUpcomingMeetings();
        } else {
          await loadMeetingSummaries();
        }
      }
    } catch (error) {
      console.error('Failed to mark meeting:', error);
      alert('Failed to mark meeting. Please try again.');
    } finally {
      setProcessingMeeting(null);
    }
  };

  const handleUploadNotes = async (meeting, notes) => {
    try {
      setProcessingMeeting(meeting.meeting_id);
      
      const result = await window.electronAPI.meeting.uploadNotes(
        user.id,
        meeting.meeting_id,
        notes
      );

      if (result.success) {
        // Refresh summaries
        await loadMeetingSummaries();
        setView('summaries');
      }
    } catch (error) {
      console.error('Failed to upload notes:', error);
    } finally {
      setProcessingMeeting(null);
    }
  };

  const handleViewSummary = (meeting) => {
    setSelectedMeeting(meeting);
  };

  if (selectedMeeting) {
    return (
      <div className="page-container">
        <div className="page-header">
          <button 
            className="btn btn-ghost" 
            onClick={() => setSelectedMeeting(null)}
          >
            ← Back
          </button>
        </div>
        <MeetingSummary meeting={selectedMeeting} />
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Meetings</h1>
          <p className="page-subtitle">Review and manage your meeting summaries</p>
        </div>
        
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          {view === 'upcoming' && (
            <button
              className="btn btn-secondary"
              onClick={handleSyncNow}
              disabled={loading}
              title="Sync meetings from Outlook"
            >
              🔄 Sync Now
            </button>
          )}
          
          <div className="view-toggle">
            <button
              className={`toggle-btn ${view === 'upcoming' ? 'active' : ''}`}
              onClick={() => setView('upcoming')}
            >
              📅 Upcoming
            </button>
            <button
              className={`toggle-btn ${view === 'summaries' ? 'active' : ''}`}
              onClick={() => setView('summaries')}
            >
              📝 Summaries
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="loading-container">
          <div className="loading-spinner"></div>
        </div>
      ) : (
        <>
          {view === 'upcoming' ? (
            <MeetingSelector
              meetings={upcomingMeetings}
              onMarkImportant={handleMarkImportant}
              onUploadNotes={handleUploadNotes}
              processingMeeting={processingMeeting}
            />
          ) : (
            <div className="meetings-summaries-grid">
              {meetingSummaries.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state-icon">📭</div>
                  <h3 className="empty-state-title">No meeting summaries yet</h3>
                  <p className="empty-state-text">
                    Mark meetings as important and add notes to generate summaries
                  </p>
                  <button 
                    className="btn btn-primary"
                    onClick={() => setView('upcoming')}
                  >
                    View Upcoming Meetings
                  </button>
                </div>
              ) : (
                meetingSummaries.map(meeting => (
                  <div 
                    key={meeting.id} 
                    className="meeting-summary-card"
                    onClick={() => handleViewSummary(meeting)}
                  >
                    <div className="meeting-card-header">
                      {meeting.is_important && (
                        <span className="badge badge-important">Important</span>
                      )}
                      <h3 className="meeting-card-title">{meeting.title}</h3>
                      <span className="meeting-card-date">
                        {new Date(meeting.start_time).toLocaleDateString()}
                      </span>
                    </div>
                    
                    {meeting.ai_summary && (
                      <p className="meeting-card-summary">{meeting.ai_summary}</p>
                    )}
                    
                    {meeting.key_decisions && meeting.key_decisions.length > 0 && (
                      <div className="meeting-card-highlights">
                        <strong>{meeting.key_decisions.length} decisions</strong>
                        {meeting.action_items && meeting.action_items.length > 0 && (
                          <span> • {meeting.action_items.length} action items</span>
                        )}
                      </div>
                    )}
                    
                    <div className="meeting-card-footer">
                      <span className="view-details">View Details →</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default Meetings;


