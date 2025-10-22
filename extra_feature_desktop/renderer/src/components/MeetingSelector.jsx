import React, { useState } from 'react';
import { formatMeetingTimeRange, getMeetingDuration, formatDuration, getUserTimezone } from '../utils/timezone';
import './MeetingSelector.css';

function MeetingSelector({ meetings, onMarkImportant, onUploadNotes, processingMeeting }) {
  const [expandedMeeting, setExpandedMeeting] = useState(null);
  const [uploadingNotes, setUploadingNotes] = useState(null);
  const [notesText, setNotesText] = useState('');
  const userTimezone = getUserTimezone();

  if (!meetings || meetings.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">📅</div>
        <h3 className="empty-state-title">No upcoming meetings</h3>
        <p className="empty-state-text">
          Your calendar meetings will appear here
        </p>
      </div>
    );
  }

  const handleToggleExpand = (meetingId) => {
    setExpandedMeeting(expandedMeeting === meetingId ? null : meetingId);
  };

  const handleStartUpload = (meeting) => {
    setUploadingNotes(meeting.meeting_id);
    setNotesText('');
  };

  const handleCancelUpload = () => {
    setUploadingNotes(null);
    setNotesText('');
  };

  const handleSaveNotes = (meeting) => {
    if (notesText.trim()) {
      onUploadNotes(meeting, notesText);
      setUploadingNotes(null);
      setNotesText('');
    }
  };

  const getImportanceColor = (score) => {
    if (score >= 70) return '#10b981'; // green
    if (score >= 50) return '#f59e0b'; // orange
    return '#6b7280'; // gray
  };

  return (
    <div className="meeting-selector">
      {meetings.map(meeting => (
        <div 
          key={meeting.meeting_id} 
          className="meeting-card"
        >
          <div className="meeting-card-main">
            <div className="meeting-info">
              <div className="meeting-header-row">
                <div>
                  <h3 className="meeting-name">{meeting.title}</h3>
                  <div className="meeting-details">
                    <span className="meeting-time">
                      📅 {formatMeetingTimeRange(meeting.start_time, meeting.end_time, { 
                        includeTimezone: true,
                        showRelative: true 
                      })}
                    </span>
                    <span className="meeting-duration" title="Duration">
                      ⏱️ {formatDuration(getMeetingDuration(meeting.start_time, meeting.end_time))}
                    </span>
                    {meeting.attendees && meeting.attendees.length > 0 && (
                      <span className="meeting-attendees">
                        👥 {meeting.attendees.length} attendees
                      </span>
                    )}
                    {meeting.online_meeting_url && (
                      <span className="meeting-online">🎥 Online</span>
                    )}
                  </div>
                  {meeting.start_timezone && meeting.start_timezone !== 'UTC' && (
                    <div className="meeting-timezone-info">
                      <small style={{ color: '#666' }}>
                        Original timezone: {meeting.start_timezone} • Your timezone: {userTimezone}
                      </small>
                    </div>
                  )}
                </div>
                
                <div className="meeting-actions">
                  <div 
                    className="importance-score"
                    style={{ 
                      borderColor: getImportanceColor(meeting.importance_score),
                      color: getImportanceColor(meeting.importance_score)
                    }}
                    title="AI Importance Score"
                  >
                    ⭐ {meeting.importance_score}
                  </div>
                  
                  <button
                    className={`btn ${meeting.is_important ? 'btn-primary' : 'btn-ghost'}`}
                    onClick={() => onMarkImportant(meeting, !meeting.is_important)}
                    disabled={processingMeeting === meeting.meeting_id}
                  >
                    {meeting.is_important ? '✓ Important' : 'Mark Important'}
                  </button>
                </div>
              </div>
              
              {expandedMeeting === meeting.meeting_id && (
                <div className="meeting-expanded">
                  {meeting.body && (
                    <div className="meeting-description">
                      <strong>Description:</strong>
                      <p>{meeting.body}</p>
                    </div>
                  )}
                  
                  {meeting.attendees && meeting.attendees.length > 0 && (
                    <div className="attendees-list">
                      <strong>Attendees:</strong>
                      <ul>
                        {meeting.attendees.slice(0, 5).map((attendee, i) => (
                          <li key={i}>{attendee.name || attendee.email}</li>
                        ))}
                        {meeting.attendees.length > 5 && (
                          <li className="attendees-more">
                            +{meeting.attendees.length - 5} more
                          </li>
                        )}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
            
            <div className="meeting-footer">
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => handleToggleExpand(meeting.meeting_id)}
              >
                {expandedMeeting === meeting.meeting_id ? 'Show Less' : 'Show More'}
              </button>
              
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => handleStartUpload(meeting)}
              >
                📝 Add Notes
              </button>
            </div>
          </div>
          
          {uploadingNotes === meeting.meeting_id && (
            <div className="notes-upload-panel">
              <h4>Add Meeting Notes</h4>
              <textarea
                className="notes-textarea"
                value={notesText}
                onChange={(e) => setNotesText(e.target.value)}
                placeholder="Paste or type your meeting notes here...&#10;&#10;AI will automatically generate a summary with key decisions and action items."
                rows={8}
              />
              <div className="notes-actions">
                <button
                  className="btn btn-ghost"
                  onClick={handleCancelUpload}
                >
                  Cancel
                </button>
                <button
                  className="btn btn-primary"
                  onClick={() => handleSaveNotes(meeting)}
                  disabled={!notesText.trim() || processingMeeting === meeting.meeting_id}
                >
                  {processingMeeting === meeting.meeting_id ? 'Saving...' : 'Save & Generate Summary'}
                </button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export default MeetingSelector;


