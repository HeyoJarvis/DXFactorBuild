import React, { useState, useEffect } from 'react';
import { formatInLocalTimezone } from '../utils/timezone';
import UpdatesFeed from '../components/UpdatesFeed';
import './Dashboard.css';

function Dashboard({ user }) {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    meetings: 0,
    jiraUpdates: 0,
    githubUpdates: 0,
    importantMeetings: 0
  });
  const [recentUpdates, setRecentUpdates] = useState([]);
  const [recentMeetings, setRecentMeetings] = useState([]);

  useEffect(() => {
    loadDashboardData();
    
    // Listen for real-time sync completion events
    const unsubscribe = window.electronAPI.events.onSyncCompleted((data) => {
      console.log('🔄 Sync completed, auto-refreshing dashboard...', data);
      loadDashboardData();  // Auto-refresh when sync completes!
    });
    
    // Cleanup listener on unmount
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [user]);

  const loadDashboardData = async (forceSync = false) => {
    try {
      setLoading(true);

      // Fetch recent and upcoming meetings (last 7 days + next 7 days)
      const meetingsResult = await window.electronAPI.meeting.getSummaries({
        startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      });

      // Load updates:
      // - Fast: Read from database (instant load)
      // - Slow: Fetch from APIs (only when clicking "Sync Now")
      const updatesResult = forceSync 
        ? await window.electronAPI.sync.fetchAll({ days: 7 })  // Fetch from GitHub/JIRA APIs
        : await window.electronAPI.sync.getUpdates({ days: 7 });  // Read from database (fast!)

      if (meetingsResult.success) {
        setRecentMeetings(meetingsResult.meetings || []);
        setStats(prev => ({
          ...prev,
          meetings: meetingsResult.meetings?.length || 0,
          importantMeetings: meetingsResult.meetings?.filter(m => m.is_important).length || 0
        }));
      }

      if (updatesResult.success) {
        setRecentUpdates(updatesResult.updates || []);
        setStats(prev => ({
          ...prev,
          jiraUpdates: updatesResult.stats?.jira || 0,
          githubUpdates: updatesResult.stats?.github || 0
        }));
      }

    } catch (error) {
      console.error('Failed to load dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    try {
      setLoading(true);
      
      // 1. Sync meetings from Outlook
      await window.electronAPI.meeting.getUpcoming({ 
        days: 30,
        saveToDatabase: true 
      });
      
      // 2. Sync JIRA/GitHub updates
      await window.electronAPI.sync.fetchAll({ days: 7 });
      
      // 3. Reload dashboard with fresh data
      await loadDashboardData(false); // Use false to read from DB (already updated)
      
    } catch (error) {
      console.error('Sync failed:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="page-container">
        <div className="loading-container">
          <div className="loading-spinner"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Team Intelligence Dashboard</h1>
          <p className="page-subtitle">Stay up to date with meetings, tasks, and code changes</p>
        </div>
        <button className="btn btn-primary" onClick={handleSync}>
          🔄 Sync Now
        </button>
      </div>

      {/* Stats Cards */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon">📅</div>
          <div className="stat-info">
            <div className="stat-value">{stats.meetings}</div>
            <div className="stat-label">Meetings (7 days)</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">⭐</div>
          <div className="stat-info">
            <div className="stat-value">{stats.importantMeetings}</div>
            <div className="stat-label">Important Meetings</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">🎯</div>
          <div className="stat-info">
            <div className="stat-value">{stats.jiraUpdates}</div>
            <div className="stat-label">JIRA Updates</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">💻</div>
          <div className="stat-info">
            <div className="stat-value">{stats.githubUpdates}</div>
            <div className="stat-label">GitHub Activity</div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="dashboard-content">
        {/* Recent Meetings */}
        <div className="dashboard-section">
          <div className="card">
            <div className="card-header">
              <h2 className="card-title">📅 Recent Meetings</h2>
              <a href="/meetings" className="btn btn-ghost btn-sm">View All</a>
            </div>
            
            {recentMeetings.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">📭</div>
                <h3 className="empty-state-title">No meetings yet</h3>
                <p className="empty-state-text">
                  Meetings from your calendar will appear here
                </p>
              </div>
            ) : (
              <div className="meetings-list">
                {recentMeetings.slice(0, 5).map(meeting => (
                  <div key={meeting.id} className="meeting-item">
                    <div className="meeting-header">
                      <h3 className="meeting-title">
                        {meeting.is_important && <span className="badge badge-important">Important</span>}
                        {meeting.title}
                      </h3>
                      <span className="meeting-date">
                        {formatInLocalTimezone(meeting.start_time, { 
                          dateStyle: 'medium',
                          showRelative: true 
                        })}
                      </span>
                    </div>
                    {meeting.ai_summary && (
                      <p className="meeting-summary">{meeting.ai_summary}</p>
                    )}
                    {meeting.key_decisions && meeting.key_decisions.length > 0 && (
                      <div className="meeting-decisions">
                        <strong>Key Decisions:</strong>
                        <ul>
                          {meeting.key_decisions.slice(0, 2).map((decision, i) => (
                            <li key={i}>{decision}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Recent Updates */}
        <div className="dashboard-section">
          <div className="card">
            <div className="card-header">
              <h2 className="card-title">🔔 Recent Updates</h2>
            </div>
            <UpdatesFeed updates={recentUpdates} />
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;


