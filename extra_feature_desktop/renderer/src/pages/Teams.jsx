import React, { useState, useEffect } from 'react';
import TeamsManagementModal from '../components/TeamsManagementModal';
import TeamDataAssignment from '../components/TeamDataAssignment';
import './Teams.css';

function Teams({ user }) {
  const [teams, setTeams] = useState([]);
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showManagementModal, setShowManagementModal] = useState(false);
  const [showAssignmentModal, setShowAssignmentModal] = useState(false);
  const [editingTeam, setEditingTeam] = useState(null);
  
  // Team context state
  const [teamContext, setTeamContext] = useState(null);
  const [contextLoading, setContextLoading] = useState(false);
  
  // Chat state
  const [question, setQuestion] = useState('');
  const [chatHistory, setChatHistory] = useState([]);
  const [asking, setAsking] = useState(false);

  useEffect(() => {
    if (user) {
      loadTeams();
    }
  }, [user]);

  useEffect(() => {
    // Auto-refresh current times every minute
    const interval = setInterval(() => {
      if (teams.length > 0) {
        loadTeams();
      }
    }, 60000); // 60 seconds

    return () => clearInterval(interval);
  }, [teams]);

  useEffect(() => {
    if (selectedTeam) {
      loadTeamContext();
    } else {
      setTeamContext(null);
      setChatHistory([]);
    }
  }, [selectedTeam]);

  const loadTeams = async () => {
    setLoading(true);
    try {
      const result = await window.electronAPI.teams.list();
      if (result.success) {
        setTeams(result.teams || []);
      } else {
        console.error('Failed to load teams:', result.error);
      }
    } catch (error) {
      console.error('Error loading teams:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadTeamContext = async () => {
    if (!selectedTeam) return;
    
    setContextLoading(true);
    try {
      const result = await window.electronAPI.teams.getContext(selectedTeam.id);
      if (result.success) {
        setTeamContext(result);
      } else {
        console.error('Failed to load team context:', result.error);
      }
    } catch (error) {
      console.error('Error loading team context:', error);
    } finally {
      setContextLoading(false);
    }
  };

  const handleCreateTeam = () => {
    setEditingTeam(null);
    setShowManagementModal(true);
  };

  const handleEditTeam = (team) => {
    setEditingTeam(team);
    setShowManagementModal(true);
  };

  const handleDeleteTeam = async (team) => {
    if (!confirm(`Delete team "${team.name}"? This will unassign all data but won't delete it.`)) {
      return;
    }

    try {
      const result = await window.electronAPI.teams.delete(team.id);
      if (result.success) {
        await loadTeams();
        if (selectedTeam?.id === team.id) {
          setSelectedTeam(null);
        }
      } else {
        alert('Failed to delete team: ' + result.error);
      }
    } catch (error) {
      alert('Error: ' + error.message);
    }
  };

  const handleTeamSaved = async () => {
    setShowManagementModal(false);
    await loadTeams();
  };

  const handleAssignmentComplete = async () => {
    setShowAssignmentModal(false);
    await loadTeamContext();
  };

  const handleAskQuestion = async () => {
    if (!question.trim() || !selectedTeam) return;

    const userMessage = {
      role: 'user',
      content: question
    };

    setChatHistory(prev => [...prev, userMessage]);
    setQuestion('');
    setAsking(true);

    try {
      const result = await window.electronAPI.teams.askQuestion(
        selectedTeam.id,
        question.trim(),
        { includeCode: true }
      );

      const assistantMessage = {
        role: 'assistant',
        content: result.answer || 'Sorry, I could not generate an answer.',
        context_used: result.context_used,
        success: result.success
      };

      setChatHistory(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Error asking question:', error);
      const errorMessage = {
        role: 'assistant',
        content: 'Error: ' + error.message,
        success: false
      };
      setChatHistory(prev => [...prev, errorMessage]);
    } finally {
      setAsking(false);
    }
  };

  const getWorkingHoursStatusColor = (status) => {
    switch (status) {
      case 'working': return '#10B981'; // green
      case 'available': return '#F59E0B'; // yellow
      case 'offline': return '#6B7280'; // gray
      default: return '#9CA3AF'; // light gray
    }
  };

  const getWorkingHoursLabel = (status) => {
    switch (status) {
      case 'working': return 'Working Hours';
      case 'available': return 'Extended Hours';
      case 'offline': return 'Offline';
      default: return 'Unknown';
    }
  };

  const renderTeamCard = (team) => {
    const isSelected = selectedTeam?.id === team.id;
    
    return (
      <div
        key={team.id}
        className={`team-card ${isSelected ? 'selected' : ''}`}
        onClick={() => setSelectedTeam(team)}
        style={{ borderLeftColor: team.color || '#3B82F6' }}
      >
        <div className="team-header">
          <div className="team-name-section">
            <h3 className="team-name">{team.name}</h3>
            <div 
              className="working-hours-indicator"
              style={{ backgroundColor: getWorkingHoursStatusColor(team.workingHoursStatus) }}
              title={getWorkingHoursLabel(team.workingHoursStatus)}
            />
          </div>
          <div className="team-actions">
            <button
              className="btn-icon"
              onClick={(e) => {
                e.stopPropagation();
                handleEditTeam(team);
              }}
              title="Edit team"
            >
              ✏️
            </button>
            <button
              className="btn-icon"
              onClick={(e) => {
                e.stopPropagation();
                handleDeleteTeam(team);
              }}
              title="Delete team"
            >
              🗑️
            </button>
          </div>
        </div>

        {team.description && (
          <p className="team-description">{team.description}</p>
        )}

        <div className="team-timezone">
          <span className="timezone-icon">🌍</span>
          <span className="timezone-info">
            {team.currentTime} {team.timezoneAbbr}
          </span>
        </div>

        <div className="team-stats">
          <span className="stat-item">📅 {team.meetings_count || 0} meetings</span>
          <span className="stat-item">📋 {team.tasks_count || 0} tasks</span>
          <span className="stat-item">💻 {team.repos_count || 0} repos</span>
        </div>
      </div>
    );
  };

  const renderTeamContextChat = () => {
    if (!selectedTeam) {
      return (
        <div className="no-team-selected">
          <div className="empty-icon">👥</div>
          <h3>No Team Selected</h3>
          <p>Select a team from the left to view their context and ask questions</p>
        </div>
      );
    }

    return (
      <div className="team-context-chat">
        <div className="team-context-header">
          <div className="header-left">
            <h2>{selectedTeam.name}</h2>
            <div className="team-timezone-badge">
              🌍 {selectedTeam.currentTime} {selectedTeam.timezoneAbbr}
              <span
                className="status-dot"
                style={{ backgroundColor: getWorkingHoursStatusColor(selectedTeam.workingHoursStatus) }}
              />
            </div>
          </div>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => setShowAssignmentModal(true)}
          >
            📎 Assign Data
          </button>
        </div>

        {contextLoading ? (
          <div className="context-loading">
            <div className="spinner"></div>
            <p>Loading team context...</p>
          </div>
        ) : teamContext ? (
          <>
            <div className="context-summary">
              <h3>Team Context</h3>
              <div className="context-stats">
                <div className="context-stat">
                  <span className="stat-icon">📅</span>
                  <span className="stat-value">{teamContext.meetings?.length || 0}</span>
                  <span className="stat-label">Meetings</span>
                </div>
                <div className="context-stat">
                  <span className="stat-icon">📋</span>
                  <span className="stat-value">{teamContext.tasks?.length || 0}</span>
                  <span className="stat-label">Tasks</span>
                </div>
                <div className="context-stat">
                  <span className="stat-icon">💻</span>
                  <span className="stat-value">{teamContext.repositories?.length || 0}</span>
                  <span className="stat-label">Repositories</span>
                </div>
              </div>
            </div>

            <div className="chat-section">
              <h3>Ask Questions</h3>
              <p className="chat-description">
                Ask questions about this team's meetings, tasks, and code. 
                Answers are based only on their assigned context.
              </p>

              <div className="chat-history">
                {chatHistory.length === 0 ? (
                  <div className="chat-empty">
                    <p>💬 Start a conversation about {selectedTeam.name}'s work</p>
                    <div className="sample-questions">
                      <p>Try asking:</p>
                      <ul>
                        <li>"What were the key decisions in recent meetings?"</li>
                        <li>"What tasks are currently in progress?"</li>
                        <li>"What features are being worked on?"</li>
                      </ul>
                    </div>
                  </div>
                ) : (
                  chatHistory.map((message, index) => (
                    <div key={index} className={`chat-message ${message.role}`}>
                      <div className="message-header">
                        <span className="message-role">
                          {message.role === 'user' ? '👤 You' : '🤖 Assistant'}
                        </span>
                        {message.context_used && (
                          <span className="context-badge">
                            📊 Used {message.context_used.meetings} meetings, 
                            {message.context_used.jira} JIRA, 
                            {message.context_used.github} GitHub
                            {message.context_used.codeChunks && `, ${message.context_used.codeChunks} code chunks`}
                          </span>
                        )}
                      </div>
                      <div className="message-content">{message.content}</div>
                    </div>
                  ))
                )}
              </div>

              <div className="chat-input-section">
                <textarea
                  className="chat-input"
                  placeholder="Ask a question about this team's context..."
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleAskQuestion();
                    }
                  }}
                  disabled={asking}
                  rows="3"
                />
                <button
                  className="btn btn-primary"
                  onClick={handleAskQuestion}
                  disabled={!question.trim() || asking}
                >
                  {asking ? '🤔 Thinking...' : '🚀 Ask Question'}
                </button>
                <small className="input-hint">Press Enter to send, Shift+Enter for new line</small>
              </div>
            </div>
          </>
        ) : (
          <div className="context-empty">
            <p>No context loaded</p>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="teams-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">👥 Teams</h1>
          <p className="page-subtitle">Manage teams with timezone-aware context isolation</p>
        </div>
        <button className="btn btn-primary" onClick={handleCreateTeam}>
          ➕ Create Team
        </button>
      </div>

      <div className="teams-layout">
        <div className="teams-sidebar">
          <div className="sidebar-header">
            <h2>Your Teams</h2>
            <span className="teams-count">{teams.length} teams</span>
          </div>

          {loading ? (
            <div className="loading-state">
              <div className="spinner"></div>
              <p>Loading teams...</p>
            </div>
          ) : teams.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">👥</div>
              <p>No teams yet</p>
              <small>Create your first team to get started</small>
            </div>
          ) : (
            <div className="teams-list">
              {teams.map(renderTeamCard)}
            </div>
          )}
        </div>

        <div className="teams-content">
          {renderTeamContextChat()}
        </div>
      </div>

      {showManagementModal && (
        <TeamsManagementModal
          team={editingTeam}
          onClose={() => setShowManagementModal(false)}
          onSave={handleTeamSaved}
        />
      )}

      {showAssignmentModal && selectedTeam && (
        <TeamDataAssignment
          team={selectedTeam}
          onClose={() => setShowAssignmentModal(false)}
          onComplete={handleAssignmentComplete}
        />
      )}
    </div>
  );
}

export default Teams;

