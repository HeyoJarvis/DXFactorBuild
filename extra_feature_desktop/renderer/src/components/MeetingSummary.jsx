import React from 'react';
import './MeetingSummary.css';

function MeetingSummary({ meeting }) {
  return (
    <div className="meeting-summary">
      <div className="card">
        <div className="meeting-summary-header">
          {meeting.is_important && (
            <span className="badge badge-important">Important</span>
          )}
          <h1 className="meeting-summary-title">{meeting.title}</h1>
          <div className="meeting-summary-meta">
            <span>📅 {new Date(meeting.start_time).toLocaleString()}</span>
            {meeting.attendees && meeting.attendees.length > 0 && (
              <span>👥 {meeting.attendees.length} attendees</span>
            )}
          </div>
        </div>

        {meeting.ai_summary && (
          <div className="summary-section">
            <h2 className="section-title">📝 Summary</h2>
            <p className="summary-text">{meeting.ai_summary}</p>
          </div>
        )}

        {meeting.key_decisions && meeting.key_decisions.length > 0 && (
          <div className="summary-section">
            <h2 className="section-title">✅ Key Decisions</h2>
            <ul className="decisions-list">
              {meeting.key_decisions.map((decision, i) => (
                <li key={i}>{decision}</li>
              ))}
            </ul>
          </div>
        )}

        {meeting.action_items && meeting.action_items.length > 0 && (
          <div className="summary-section">
            <h2 className="section-title">🎯 Action Items</h2>
            <div className="action-items-list">
              {meeting.action_items.map((item, i) => (
                <div key={i} className="action-item">
                  <div className="action-checkbox">
                    <input type="checkbox" id={`action-${i}`} />
                    <label htmlFor={`action-${i}`}>{item.task || item}</label>
                  </div>
                  {item.owner && (
                    <span className="action-owner">@{item.owner}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {meeting.topics && meeting.topics.length > 0 && (
          <div className="summary-section">
            <h2 className="section-title">💬 Topics Discussed</h2>
            <div className="topics-list">
              {meeting.topics.map((topic, i) => (
                <span key={i} className="topic-tag">{topic}</span>
              ))}
            </div>
          </div>
        )}

        {(meeting.manual_notes || meeting.copilot_notes) && (
          <div className="summary-section">
            <h2 className="section-title">📄 Full Notes</h2>
            <div className="notes-content">
              {meeting.manual_notes || meeting.copilot_notes}
            </div>
          </div>
        )}

        {meeting.attendees && meeting.attendees.length > 0 && (
          <div className="summary-section">
            <h2 className="section-title">👥 Attendees</h2>
            <div className="attendees-grid">
              {meeting.attendees.map((attendee, i) => (
                <div key={i} className="attendee-card">
                  <div className="attendee-avatar">
                    {(attendee.name || attendee.email || '?')[0].toUpperCase()}
                  </div>
                  <div className="attendee-info">
                    <div className="attendee-name">
                      {attendee.name || attendee.email}
                    </div>
                    {attendee.response && (
                      <div className="attendee-response">
                        {attendee.response === 'accepted' && '✓ Accepted'}
                        {attendee.response === 'declined' && '✗ Declined'}
                        {attendee.response === 'tentative' && '? Tentative'}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default MeetingSummary;


