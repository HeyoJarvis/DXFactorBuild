import { useState, useEffect } from 'react';
import './TeamContext.css';

export default function TeamContext({ selectedTeam, onContextChange }) {
  const [contextDetails, setContextDetails] = useState(null);
  const [expandedSections, setExpandedSections] = useState({
    meetings: true,
    tasks: true,
    codebase: true
  });
  const [contextSummary, setContextSummary] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  
  // State for selected context items
  const [selectedMeetings, setSelectedMeetings] = useState(new Set());
  const [selectedTasks, setSelectedTasks] = useState(new Set());
  const [selectedRepos, setSelectedRepos] = useState(new Set());

  // Repository management state
  const [showRepoSelector, setShowRepoSelector] = useState(false);
  const [availableRepositories, setAvailableRepositories] = useState([]);
  const [loadingRepos, setLoadingRepos] = useState(false);
  const [indexingRepo, setIndexingRepo] = useState(null);

  // Load team context when team changes
  useEffect(() => {
    if (selectedTeam) {
      // Clear previous team's data immediately when switching teams
      setIsLoading(true);
      setContextDetails(null);
      setContextSummary(null);
      loadTeamContext(selectedTeam.id);
    }
  }, [selectedTeam]);

  const loadTeamContext = async (teamId) => {
    try {
      if (!window.electronAPI?.teamChat?.loadTeamContext) {
        console.error('Team Chat API not available');
        setIsLoading(false);
        return;
      }

      console.log('🔍 Loading team context for team:', teamId);
      const result = await window.electronAPI.teamChat.loadTeamContext(teamId);
      console.log('📦 Team context result:', result);

      if (result.success) {
        console.log('✅ Context details for team', teamId, ':', {
          meetings: result.context?.meetings?.length || 0,
          tasks: result.context?.tasks?.length || 0,
          repos: result.context?.code_repos?.length || 0
        });
        console.log('📋 Task details:', result.context?.tasks?.map(t => ({
          title: t.title,
          source: t.source,
          assignee: t.assignee
        })));
        setContextDetails(result.context);
        setContextSummary(result.summary);
        
        // Auto-select all context items
        if (result.context?.meetings) {
          const meetingIndices = new Set(result.context.meetings.map((_, idx) => idx));
          setSelectedMeetings(meetingIndices);
        }
        if (result.context?.tasks) {
          const taskIndices = new Set(result.context.tasks.map((_, idx) => idx));
          setSelectedTasks(taskIndices);
        }
        if (result.context?.code_repos) {
          const repoIndices = new Set(result.context.code_repos.map((_, idx) => idx));
          setSelectedRepos(repoIndices);
        }
      } else {
        console.error('❌ Failed to load team context:', result.error);
      }
    } catch (error) {
      console.error('💥 Error loading team context:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  // Toggle meeting selection
  const toggleMeetingSelection = (idx) => {
    const newSelected = new Set(selectedMeetings);
    if (newSelected.has(idx)) {
      newSelected.delete(idx);
    } else {
      newSelected.add(idx);
    }
    setSelectedMeetings(newSelected);
    onContextChange?.({ meetings: newSelected, tasks: selectedTasks, repos: selectedRepos });
  };

  // Toggle task selection
  const toggleTaskSelection = (idx) => {
    const newSelected = new Set(selectedTasks);
    if (newSelected.has(idx)) {
      newSelected.delete(idx);
    } else {
      newSelected.add(idx);
    }
    setSelectedTasks(newSelected);
    onContextChange?.({ meetings: selectedMeetings, tasks: newSelected, repos: selectedRepos });
  };

  // Toggle repository selection
  const toggleRepoSelection = (idx) => {
    const newSelected = new Set(selectedRepos);
    if (newSelected.has(idx)) {
      newSelected.delete(idx);
    } else {
      newSelected.add(idx);
    }
    setSelectedRepos(newSelected);
    onContextChange?.({ meetings: selectedMeetings, tasks: selectedTasks, repos: newSelected });
  };

  // Load available GitHub repositories
  const loadAvailableRepositories = async () => {
    if (!window.electronAPI?.codeIndexer?.listRepositories) {
      console.error('❌ Code Indexer API not available');
      alert('Code Indexer API not available. Please restart the app.');
      return;
    }

    console.log('🔄 Loading GitHub repositories...');
    setLoadingRepos(true);
    try {
      const response = await window.electronAPI.codeIndexer.listRepositories({
        per_page: 100
      });

      console.log('📦 Repository response:', response);

      if (response.success && response.repositories) {
        setAvailableRepositories(response.repositories);
        console.log('✅ Loaded', response.repositories.length, 'repositories:', response.repositories.map(r => r.full_name));
      } else {
        console.error('❌ Failed to load repositories:', response.error);
        alert(`Failed to load repositories: ${response.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('💥 Error loading repositories:', error);
      alert(`Error loading repositories: ${error.message}`);
    } finally {
      setLoadingRepos(false);
    }
  };

  // Index a repository
  const handleIndexRepository = async (repo) => {
    if (!window.electronAPI?.codeIndexer?.indexRepository) {
      console.error('Code Indexer API not available');
      return;
    }

    setIndexingRepo(repo.full_name);
    try {
      const [owner, name] = repo.full_name.split('/');

      console.log('🔄 Indexing repository:', repo.full_name);

      const response = await window.electronAPI.codeIndexer.indexRepository({
        owner,
        repo: name,
        branch: repo.default_branch || 'main'
      });

      if (response.success) {
        console.log('✅ Repository indexed successfully:', repo.full_name);
        // Reload team context to show the new repo
        await loadTeamContext(selectedTeam.id);
      } else {
        console.error('Failed to index repository:', response.error);
        alert(`Failed to index ${repo.full_name}: ${response.error}`);
      }
    } catch (error) {
      console.error('Error indexing repository:', error);
      alert(`Error indexing repository: ${error.message}`);
    } finally {
      setIndexingRepo(null);
    }
  };

  // Open repository selector
  const handleAddRepository = () => {
    setShowRepoSelector(true);
    loadAvailableRepositories();
  };

  if (!selectedTeam) {
    return (
      <div className="team-context-empty">
        <p>Select a team to view context</p>
      </div>
    );
  }

  return (
    <div className="team-context-container">
      <div className="team-context-header">
        <h3>Team Context</h3>
      </div>

      <div className="team-context-content">
        {/* Meetings Section */}
        <div className="context-section">
          <div 
            className="context-section-header" 
            onClick={() => toggleSection('meetings')}
          >
            <div className="context-header-left">
              <span className="context-label">Recent Meeting Notes</span>
            </div>
            <div className="context-header-right">
              {contextDetails?.meetings && Array.isArray(contextDetails.meetings) && (
                <span className="context-count">{contextDetails.meetings.length}</span>
              )}
              <svg
                className={`chevron-icon ${expandedSections.meetings ? 'expanded' : ''}`}
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </div>
          </div>
          {expandedSections.meetings && contextDetails?.meetings && (
            <div className="context-items-list">
              {Array.isArray(contextDetails.meetings) && contextDetails.meetings.length > 0 ? (
                contextDetails.meetings.map((meeting, idx) => (
                  <div key={idx} className={`meeting-card ${selectedMeetings.has(idx) ? 'selected' : ''}`} onClick={() => toggleMeetingSelection(idx)}>
                    <input
                      type="checkbox"
                      className="context-checkbox"
                      checked={selectedMeetings.has(idx)}
                      onChange={(e) => {
                        e.stopPropagation();
                        toggleMeetingSelection(idx);
                      }}
                    />
                    <div className="card-content">
                      <div className="card-title-link">
                        <a href="#" onClick={(e) => { e.preventDefault(); console.log('View meeting:', meeting?.title); }}>
                          {String(meeting?.title || 'Untitled Meeting')}
                        </a>
                      </div>
                      <div className="card-meta">{meeting?.meeting_date ? new Date(meeting.meeting_date).toLocaleDateString() : 'No date'}</div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="context-empty-message">No meeting notes yet</div>
              )}
            </div>
          )}
        </div>

        {/* Tasks Section */}
        <div className="context-section">
          <div 
            className="context-section-header"
            onClick={() => toggleSection('tasks')}
          >
            <div className="context-header-left">
              <span className="context-label">Tasks (JIRA & Slack)</span>
            </div>
            <div className="context-header-right">
              {!isLoading && contextDetails?.tasks && Array.isArray(contextDetails.tasks) && (
                <span className="context-count">{contextDetails.tasks.length}</span>
              )}
              <svg
                className={`chevron-icon ${expandedSections.tasks ? 'expanded' : ''}`}
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </div>
          </div>
          {expandedSections.tasks && !isLoading && contextDetails?.tasks && (
            <div className="context-items-list">
              {Array.isArray(contextDetails.tasks) && contextDetails.tasks.length > 0 ? (
                contextDetails.tasks.map((task, idx) => (
                  <div key={idx} className={`task-card ${selectedTasks.has(idx) ? 'selected' : ''}`} onClick={() => toggleTaskSelection(idx)}>
                    <input
                      type="checkbox"
                      className="context-checkbox"
                      checked={selectedTasks.has(idx)}
                      onChange={(e) => {
                        e.stopPropagation();
                        toggleTaskSelection(idx);
                      }}
                    />
                    <div className="card-content">
                      <div className="card-header">
                        <div className="card-title">{String(task?.title || 'Untitled Task')}</div>
                        {task?.external_key && task?.source === 'jira' && (
                          <span className="task-key">{String(task.external_key)}</span>
                        )}
                      </div>
                      {task?.source && (
                        <div className="card-meta">
                          <span className="source-badge">{task.source === 'jira' ? 'JIRA' : task.source === 'teams' ? 'Teams' : 'Slack'}</span>
                          <span className="status-badge">{String(task.status || 'Open')}</span>
                          {task?.assignee && task.assignee !== 'Unassigned' && (
                            <span className="assignee">{String(task.assignee)}</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="context-empty-message">No tasks yet</div>
              )}
            </div>
          )}
        </div>

        {/* Codebase Section */}
        <div className="context-section">
          <div 
            className="context-section-header"
            onClick={() => toggleSection('codebase')}
          >
            <div className="context-header-left">
              <span className="context-label">Connected Repositories</span>
            </div>
            <div className="context-header-right">
              {contextDetails?.code_repos && Array.isArray(contextDetails.code_repos) && (
                <span className="context-count">{contextDetails.code_repos.length}</span>
              )}
              <svg
                className={`chevron-icon ${expandedSections.codebase ? 'expanded' : ''}`}
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </div>
          </div>
          {expandedSections.codebase && contextDetails?.code_repos && (
            <div className="context-items-list">
              {Array.isArray(contextDetails.code_repos) && contextDetails.code_repos.length > 0 ? (
                <>
                  {contextDetails.code_repos.map((repo, idx) => (
                    <div key={idx} className={`repo-card ${selectedRepos.has(idx) ? 'selected' : ''}`} onClick={() => toggleRepoSelection(idx)}>
                      <input
                        type="checkbox"
                        className="context-checkbox"
                        checked={selectedRepos.has(idx)}
                        onChange={(e) => {
                          e.stopPropagation();
                          toggleRepoSelection(idx);
                        }}
                      />
                      <div className="card-content">
                        <div className="card-title">{String(repo?.name || repo?.path || 'Unknown Repo')}</div>
                        <div className="card-meta">
                          <span>{repo?.file_count || 0} files</span>
                          <span>•</span>
                          <span>{String(repo?.branch || 'main')}</span>
                        </div>
                        <span className="repo-status indexed">Indexed</span>
                      </div>
                    </div>
                  ))}
                  <button className="add-repo-button" onClick={handleAddRepository}>
                    + Add Repository
                  </button>
                </>
              ) : (
                <div className="context-empty-state">
                  <div className="context-empty-message">
                    No repositories indexed yet
                  </div>
                  <button className="add-repo-button primary" onClick={handleAddRepository}>
                    Index Your First Repository
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Repository Selector Modal */}
      {showRepoSelector && (
        <div className="repo-selector-modal-overlay" onClick={() => setShowRepoSelector(false)}>
          <div className="repo-selector-modal" onClick={(e) => e.stopPropagation()}>
            <div className="repo-selector-header">
              <h3>Select Repository to Index</h3>
              <button className="close-button" onClick={() => setShowRepoSelector(false)}>×</button>
            </div>
            <div className="repo-selector-body">
              {loadingRepos ? (
                <div className="loading-repos">
                  <div className="spinner"></div>
                  <p>Loading repositories from GitHub...</p>
                </div>
              ) : availableRepositories.length > 0 ? (
                <div className="repo-list">
                  {availableRepositories.map((repo) => {
                    const isIndexed = contextDetails?.code_repos?.some(r =>
                      r.path === repo.full_name || r.name === repo.name
                    );
                    const isIndexing = indexingRepo === repo.full_name;

                    return (
                      <div key={repo.id} className="repo-list-item">
                        <div className="repo-info">
                          <div>
                            <div className="repo-name">{repo.full_name}</div>
                            {repo.description && (
                              <div className="repo-description">{repo.description}</div>
                            )}
                          </div>
                        </div>
                        {isIndexed ? (
                          <span className="repo-badge indexed">Indexed</span>
                        ) : (
                          <button
                            className="index-button"
                            onClick={() => handleIndexRepository(repo)}
                            disabled={isIndexing}
                          >
                            {isIndexing ? (
                              <>
                                <div className="spinner-small"></div>
                                Indexing...
                              </>
                            ) : (
                              'Index'
                            )}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="no-repos">
                  <p>No repositories found in your GitHub account.</p>
                  <p>Make sure the GitHub App is properly configured.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

