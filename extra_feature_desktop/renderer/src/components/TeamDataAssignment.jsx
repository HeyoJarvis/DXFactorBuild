import React, { useState, useEffect } from 'react';
import '../pages/Teams.css';

function TeamDataAssignment({ team, onClose, onComplete }) {
  const [activeTab, setActiveTab] = useState('meetings');
  const [loading, setLoading] = useState(false);
  const [assigning, setAssigning] = useState(false);

  // Data state
  const [meetings, setMeetings] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [repositories, setRepositories] = useState([]);

  // Selection state
  const [selectedMeetings, setSelectedMeetings] = useState([]);
  const [selectedTasks, setSelectedTasks] = useState([]);
  const [selectedRepo, setSelectedRepo] = useState(null);

  useEffect(() => {
    loadUnassignedData();
    loadRepositories();
  }, []);

  const loadUnassignedData = async () => {
    setLoading(true);
    try {
      const [meetingsResult, tasksResult] = await Promise.all([
        window.electronAPI.teams.getUnassignedMeetings(),
        window.electronAPI.teams.getUnassignedTasks()
      ]);

      if (meetingsResult.success) {
        setMeetings(meetingsResult.meetings || []);
      }

      if (tasksResult.success) {
        setTasks(tasksResult.tasks || []);
      }
    } catch (error) {
      console.error('Error loading unassigned data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadRepositories = async () => {
    try {
      const result = await window.electronAPI.github.listRepositories();
      if (result.success) {
        setRepositories(result.repositories || []);
      }
    } catch (error) {
      console.error('Error loading repositories:', error);
    }
  };

  const handleAssignMeetings = async () => {
    if (selectedMeetings.length === 0) {
      alert('Please select at least one meeting');
      return;
    }

    setAssigning(true);
    try {
      for (const meetingId of selectedMeetings) {
        await window.electronAPI.teams.assignMeeting(meetingId, team.id);
      }

      alert(`✅ Assigned ${selectedMeetings.length} meeting(s) to ${team.name}`);
      setSelectedMeetings([]);
      await loadUnassignedData();
      onComplete();
    } catch (error) {
      alert('Error: ' + error.message);
    } finally {
      setAssigning(false);
    }
  };

  const handleAssignTasks = async () => {
    if (selectedTasks.length === 0) {
      alert('Please select at least one task');
      return;
    }

    setAssigning(true);
    try {
      for (const taskId of selectedTasks) {
        await window.electronAPI.teams.assignTask(taskId, team.id);
      }

      alert(`✅ Assigned ${selectedTasks.length} task(s) to ${team.name}`);
      setSelectedTasks([]);
      await loadUnassignedData();
      onComplete();
    } catch (error) {
      alert('Error: ' + error.message);
    } finally {
      setAssigning(false);
    }
  };

  const handleAssignRepository = async () => {
    if (!selectedRepo) {
      alert('Please select a repository');
      return;
    }

    setAssigning(true);
    try {
      const result = await window.electronAPI.teams.assignRepository(
        team.id,
        selectedRepo.owner.login,
        selectedRepo.name
      );

      if (result.success) {
        alert(`✅ Assigned ${selectedRepo.full_name} to ${team.name}`);
        setSelectedRepo(null);
        onComplete();
      } else {
        alert('Failed to assign repository: ' + result.error);
      }
    } catch (error) {
      alert('Error: ' + error.message);
    } finally {
      setAssigning(false);
    }
  };

  const toggleMeeting = (meetingId) => {
    setSelectedMeetings(prev =>
      prev.includes(meetingId)
        ? prev.filter(id => id !== meetingId)
        : [...prev, meetingId]
    );
  };

  const toggleTask = (taskId) => {
    setSelectedTasks(prev =>
      prev.includes(taskId)
        ? prev.filter(id => id !== taskId)
        : [...prev, taskId]
    );
  };

  const renderMeetingsTab = () => (
    <div className="assignment-tab-content">
      <div className="tab-header">
        <h3>Unassigned Meetings</h3>
        <button
          className="btn btn-primary btn-sm"
          onClick={handleAssignMeetings}
          disabled={selectedMeetings.length === 0 || assigning}
        >
          {assigning ? 'Assigning...' : `Assign ${selectedMeetings.length} to ${team.name}`}
        </button>
      </div>

      {loading ? (
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading meetings...</p>
        </div>
      ) : meetings.length === 0 ? (
        <div className="empty-state">
          <p>No unassigned meetings</p>
          <small>All meetings are already assigned to teams</small>
        </div>
      ) : (
        <div className="data-list">
          {meetings.map(meeting => (
            <div key={meeting.meeting_id} className="data-item">
              <input
                type="checkbox"
                checked={selectedMeetings.includes(meeting.meeting_id)}
                onChange={() => toggleMeeting(meeting.meeting_id)}
              />
              <div className="data-item-content">
                <div className="data-item-title">{meeting.title}</div>
                <div className="data-item-meta">
                  📅 {new Date(meeting.start_time).toLocaleDateString()} at {' '}
                  {new Date(meeting.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderTasksTab = () => (
    <div className="assignment-tab-content">
      <div className="tab-header">
        <h3>Unassigned JIRA Issues</h3>
        <button
          className="btn btn-primary btn-sm"
          onClick={handleAssignTasks}
          disabled={selectedTasks.length === 0 || assigning}
        >
          {assigning ? 'Assigning...' : `Assign ${selectedTasks.length} to ${team.name}`}
        </button>
      </div>

      {loading ? (
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading tasks...</p>
        </div>
      ) : tasks.length === 0 ? (
        <div className="empty-state">
          <p>No unassigned JIRA issues</p>
          <small>All JIRA issues are already assigned to teams</small>
        </div>
      ) : (
        <div className="data-list">
          {tasks.map(task => (
            <div key={task.id} className="data-item">
              <input
                type="checkbox"
                checked={selectedTasks.includes(task.id)}
                onChange={() => toggleTask(task.id)}
              />
              <div className="data-item-content">
                <div className="data-item-title">
                  {task.external_key && <span className="task-key">{task.external_key}</span>}
                  {task.title}
                </div>
                <div className="data-item-meta">
                  📋 JIRA
                  {task.status && ` • Status: ${task.status}`}
                  {task.author && ` • ${task.author}`}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderRepositoriesTab = () => (
    <div className="assignment-tab-content">
      <div className="tab-header">
        <h3>Repositories</h3>
        <button
          className="btn btn-primary btn-sm"
          onClick={handleAssignRepository}
          disabled={!selectedRepo || assigning}
        >
          {assigning ? 'Assigning...' : 'Assign to ' + team.name}
        </button>
      </div>

      {repositories.length === 0 ? (
        <div className="empty-state">
          <p>No repositories found</p>
          <small>Connect GitHub to see available repositories</small>
        </div>
      ) : (
        <div className="data-list">
          {repositories.map(repo => (
            <div
              key={repo.id}
              className={`data-item ${selectedRepo?.id === repo.id ? 'selected' : ''}`}
              onClick={() => setSelectedRepo(selectedRepo?.id === repo.id ? null : repo)}
            >
              <div className="data-item-content">
                <div className="data-item-title">
                  {repo.full_name}
                  {repo.private && <span className="badge badge-private">🔒 Private</span>}
                </div>
                {repo.description && (
                  <div className="data-item-description">{repo.description}</div>
                )}
                <div className="data-item-meta">
                  {repo.language && `${repo.language} • `}
                  📌 {repo.default_branch}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content modal-large" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Assign Data to {team.name}</h2>
          <button className="btn-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          <div className="tabs">
            <button
              className={`tab ${activeTab === 'meetings' ? 'active' : ''}`}
              onClick={() => setActiveTab('meetings')}
            >
              📅 Meetings ({meetings.length})
            </button>
            <button
              className={`tab ${activeTab === 'tasks' ? 'active' : ''}`}
              onClick={() => setActiveTab('tasks')}
            >
              📋 JIRA Issues ({tasks.length})
            </button>
            <button
              className={`tab ${activeTab === 'repositories' ? 'active' : ''}`}
              onClick={() => setActiveTab('repositories')}
            >
              💻 Repositories ({repositories.length})
            </button>
          </div>

          <div className="tab-content">
            {activeTab === 'meetings' && renderMeetingsTab()}
            {activeTab === 'tasks' && renderTasksTab()}
            {activeTab === 'repositories' && renderRepositoriesTab()}
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default TeamDataAssignment;

