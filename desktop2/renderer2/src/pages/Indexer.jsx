import { useState, useEffect, useRef } from 'react';
import './Indexer.css';

/**
 * Code Indexer - AI-Powered Codebase Intelligence
 * Professional design with real GitHub integration
 */
export default function Indexer() {
  const [query, setQuery] = useState('');
  const [selectedRepo, setSelectedRepo] = useState('');
  const [selectedFeature, setSelectedFeature] = useState('');
  const [answer, setAnswer] = useState(null);
  const [loading, setLoading] = useState(false);
  const [repositories, setRepositories] = useState([]);
  const [reposLoading, setReposLoading] = useState(true);
  const [indexerStatus, setIndexerStatus] = useState(null);
  const [isQueryFocused, setIsQueryFocused] = useState(false);
  const queryInputRef = useRef(null);

  // Mock JIRA-linked features (would come from JIRA API in production)
  const jiraFeatures = [
    {
      id: 'PROJ-123',
      title: 'User Authentication System',
      status: 'In Progress',
      repository: 'heyjarvis/backend',
      assignee: 'Sarah Chen',
      priority: 'High',
      lastUpdated: '2 hours ago'
    },
    {
      id: 'PROJ-124',
      title: 'Real-time Slack Integration',
      status: 'In Review',
      repository: 'heyjarvis/integrations',
      assignee: 'Mike Johnson',
      priority: 'High',
      lastUpdated: '5 hours ago'
    },
    {
      id: 'PROJ-125',
      title: 'AI Task Recommendations',
      status: 'Done',
      repository: 'heyjarvis/ai-engine',
      assignee: 'Emma Davis',
      priority: 'Medium',
      lastUpdated: '1 day ago'
    },
    {
      id: 'PROJ-126',
      title: 'Dashboard Analytics',
      status: 'To Do',
      repository: 'heyjarvis/frontend',
      assignee: 'Alex Kumar',
      priority: 'Medium',
      lastUpdated: '3 days ago'
    }
  ];

  // Load repositories on mount
  useEffect(() => {
    loadRepositories();
    checkIndexerStatus();
  }, []);

  // Check if indexer is available
  const checkIndexerStatus = async () => {
    try {
      if (window.electronAPI?.codeIndexer) {
        const result = await window.electronAPI.codeIndexer.getStatus();
        setIndexerStatus(result);
        console.log('📊 Indexer status:', result);
      }
    } catch (error) {
      console.error('Failed to check indexer status:', error);
    }
  };

  // Load accessible repositories
  const loadRepositories = async () => {
    try {
      setReposLoading(true);
      
      if (window.electronAPI?.codeIndexer) {
        const result = await window.electronAPI.codeIndexer.listRepositories({
          per_page: 50
        });
        
        console.log('📚 Loaded repositories:', result);
        
        if (result.success && result.repositories) {
          setRepositories(result.repositories);
          
          // Auto-select first repo if available
          if (result.repositories.length > 0 && !selectedRepo) {
            const firstRepo = result.repositories[0];
            setSelectedRepo(`${firstRepo.owner}/${firstRepo.name}`);
          }
        }
      }
    } catch (error) {
      console.error('Failed to load repositories:', error);
    } finally {
      setReposLoading(false);
    }
  };

  // Ask a question about the codebase
  const askQuestion = async () => {
    if (!query.trim()) {
      return;
    }

    if (!selectedRepo) {
      alert('Please select a repository first');
      return;
    }

    try {
      setLoading(true);
      setAnswer(null);

      // Parse owner/repo from selected repo
      const [owner, repo] = selectedRepo.split('/');

      console.log('🔍 Querying codebase:', { query, owner, repo });

      const result = await window.electronAPI.codeIndexer.query({
        query,
        repository: { owner, repo }
      });

      console.log('📝 Query result:', result);

      if (result.success) {
        setAnswer(result.data);
      } else {
        setAnswer({
          summary: 'Query failed',
          error: result.error,
          technicalDetails: {
            error: result.error
          }
        });
      }
    } catch (error) {
      console.error('Failed to query codebase:', error);
      setAnswer({
        summary: 'Error processing query',
        error: error.message,
        technicalDetails: {
          error: error.message
        }
      });
    } finally {
      setLoading(false);
    }
  };

  // Handle enter key in query input
  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      askQuestion();
    }
  };

  // Handle feature selection
  const handleFeatureClick = (feature) => {
    setSelectedFeature(feature.id);
    setSelectedRepo(feature.repository);
    setQuery(`Explain the implementation of ${feature.title} in detail`);
    
    // Focus query input
    if (queryInputRef.current) {
      queryInputRef.current.focus();
    }
  };

  // Get status badge color
  const getStatusColor = (status) => {
    const colors = {
      'In Progress': '#3b82f6',
      'In Review': '#f59e0b',
      'Done': '#10b981',
      'To Do': '#6b7280'
    };
    return colors[status] || colors['To Do'];
  };

  // Get priority badge color
  const getPriorityColor = (priority) => {
    const colors = {
      'High': '#ef4444',
      'Medium': '#f59e0b',
      'Low': '#6b7280'
    };
    return colors[priority] || colors['Medium'];
  };

  return (
    <div className="indexer-page">
      {/* Professional Header */}
      <div className="indexer-header">
        <div className="header-container">
          {/* Left - Title and Status */}
          <div className="header-left">
            <div className="header-title-group">
              <h1 className="header-title">CODE INTELLIGENCE</h1>
              <div className="header-subtitle">
                {indexerStatus?.available ? (
                  <>
                    <div className="status-dot active"></div>
                    <span>AI-powered codebase analysis</span>
                  </>
                ) : (
                  <>
                    <div className="status-dot inactive"></div>
                    <span>Configuration required</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Right - Integration Icons & Controls */}
          <div className="header-right">
            {/* GitHub Integration */}
            <button 
              className="integration-btn"
              onClick={() => {
                // TODO: Open GitHub integration settings
                alert('GitHub integration settings - Coming soon!');
              }}
              title="GitHub Integration • Connected"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
              </svg>
              <div className="status-indicator connected"></div>
            </button>

            {/* JIRA Integration */}
            <button 
              className="integration-btn"
              onClick={() => {
                // TODO: Open JIRA integration settings
                alert('JIRA integration settings - Coming soon!');
              }}
              title="JIRA Integration • Connected"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M11.571 11.513H0a5.218 5.218 0 0 0 5.232 5.215h2.13v2.057A5.215 5.215 0 0 0 12.575 24V12.518a1.005 1.005 0 0 0-1.005-1.005zm5.723-5.756H5.736a5.215 5.215 0 0 0 5.215 5.214h2.129v2.058a5.218 5.218 0 0 0 5.215 5.214V6.758a1.001 1.001 0 0 0-1.001-1.001zM23.013 0H11.455a5.215 5.215 0 0 0 5.215 5.215h2.129v2.057A5.215 5.215 0 0 0 24 12.483V1.005A1.001 1.001 0 0 0 23.013 0Z"/>
              </svg>
              <div className="status-indicator connected"></div>
            </button>

            {/* Divider */}
            <div className="header-divider-vertical"></div>

            {/* Refresh Button */}
            <button 
              className="btn-ghost btn-icon"
              onClick={loadRepositories}
              disabled={reposLoading}
              title="Refresh repositories"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="23 4 23 10 17 10"></polyline>
                <polyline points="1 20 1 14 7 14"></polyline>
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
              </svg>
            </button>
            
            {/* Minimize Button */}
            <button 
              className="btn-ghost btn-icon"
              onClick={() => window.close()}
              title="Minimize"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
            </button>
          </div>
        </div>
        
        {/* Elegant divider */}
        <div className="header-divider"></div>
      </div>

      {/* Main Content */}
      <div className="indexer-content">
        {/* Query Section */}
        <div className="query-section">
          <div className="query-card">
            {/* Repository Selector */}
            <div className="repo-selector-group">
              <label className="input-label">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"></path>
                </svg>
                Repository
              </label>
              <select 
                className="repo-select"
                value={selectedRepo}
                onChange={(e) => setSelectedRepo(e.target.value)}
                disabled={reposLoading || repositories.length === 0}
              >
                {reposLoading ? (
                  <option>Loading repositories...</option>
                ) : repositories.length === 0 ? (
                  <option>No repositories available</option>
                ) : (
                  <>
                    <option value="">Select a repository...</option>
                    {repositories.map((repo) => (
                      <option key={repo.full_name} value={repo.full_name}>
                        {repo.full_name}
                        {repo.private && ' 🔒'}
                      </option>
                    ))}
                  </>
                )}
              </select>
            </div>

            {/* Query Input */}
            <div className="query-input-group">
              <label className="input-label">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8"></circle>
                  <path d="m21 21-4.35-4.35"></path>
                </svg>
                Ask a question
              </label>
              <div className={`query-input-wrapper ${isQueryFocused ? 'focused' : ''}`}>
                <textarea
                  ref={queryInputRef}
                  className="query-input"
                  placeholder="How does authentication work in this codebase?"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyPress={handleKeyPress}
                  onFocus={() => setIsQueryFocused(true)}
                  onBlur={() => setIsQueryFocused(false)}
                  rows={3}
                  disabled={!selectedRepo || !indexerStatus?.available}
                />
                <button 
                  className="query-submit-btn"
                  onClick={askQuestion}
                  disabled={!query.trim() || !selectedRepo || loading || !indexerStatus?.available}
                >
                  {loading ? (
                    <>
                      <div className="btn-spinner"></div>
                      Processing...
                    </>
                  ) : (
                    <>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10"></circle>
                        <polyline points="12 6 12 12 16 14"></polyline>
                      </svg>
                      Analyze
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* JIRA-Linked Features & Repositories */}
        <div className="features-section">
          <div className="features-header">
            <div className="features-title">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
                <line x1="12" y1="22.08" x2="12" y2="12"></line>
              </svg>
              Active Features & Repositories
            </div>
            <div className="features-subtitle">
              Linked from JIRA · Click to analyze
            </div>
          </div>

          <div className="features-grid">
            {jiraFeatures.map((feature) => (
              <div 
                key={feature.id}
                className={`feature-card ${selectedFeature === feature.id ? 'selected' : ''}`}
                onClick={() => handleFeatureClick(feature)}
              >
                {/* Feature Header */}
                <div className="feature-card-header">
                  <div className="feature-id">{feature.id}</div>
                  <div className="feature-badges">
                    <span 
                      className="feature-badge priority"
                      style={{ 
                        background: `${getPriorityColor(feature.priority)}15`,
                        color: getPriorityColor(feature.priority)
                      }}
                    >
                      {feature.priority}
                    </span>
                    <span 
                      className="feature-badge status"
                      style={{ 
                        background: `${getStatusColor(feature.status)}15`,
                        color: getStatusColor(feature.status)
                      }}
                    >
                      {feature.status}
                    </span>
                  </div>
                </div>

                {/* Feature Title */}
                <div className="feature-title">{feature.title}</div>

                {/* Feature Metadata */}
                <div className="feature-metadata">
                  <div className="metadata-item">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"></path>
                    </svg>
                    <span className="repo-name">{feature.repository}</span>
                  </div>
                  <div className="metadata-item">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                      <circle cx="12" cy="7" r="4"></circle>
                    </svg>
                    {feature.assignee}
                  </div>
                  <div className="metadata-item">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10"></circle>
                      <polyline points="12 6 12 12 16 14"></polyline>
                    </svg>
                    {feature.lastUpdated}
                  </div>
                </div>

                {/* Analyze Button */}
                <button className="feature-analyze-btn">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8"></circle>
                    <path d="m21 21-4.35-4.35"></path>
                  </svg>
                  Analyze Code
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Answer Section */}
        {(loading || answer) && (
          <div className="answer-section">
            {loading ? (
              <div className="loading-state">
                <div className="loading-spinner">
                  <div className="spinner-ring"></div>
                  <div className="spinner-ring"></div>
                  <div className="spinner-ring"></div>
                </div>
                <div className="loading-text">Analyzing codebase...</div>
                <div className="loading-subtext">This may take a few moments</div>
              </div>
            ) : answer ? (
              <>
                {/* Summary Card */}
                <div className="answer-card">
                  <div className="answer-header">
                    <div className="answer-title">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                        <polyline points="14 2 14 8 20 8"></polyline>
                        <line x1="16" y1="13" x2="8" y2="13"></line>
                        <line x1="16" y1="17" x2="8" y2="17"></line>
                        <polyline points="10 9 9 9 8 9"></polyline>
                      </svg>
                      Analysis Result
                    </div>
                  </div>
                  
                  {answer.error ? (
                    <div className="answer-error">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="12" y1="8" x2="12" y2="12"></line>
                        <line x1="12" y1="16" x2="12.01" y2="16"></line>
                      </svg>
                      <div>
                        <div className="error-title">Query Failed</div>
                        <div className="error-message">{answer.error}</div>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="answer-summary">{answer.summary}</div>
                      
                      {answer.businessImpact && (
                        <div className="answer-section-block">
                          <div className="section-block-header">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
                            </svg>
                            Business Impact
                          </div>
                          <div className="section-block-content">{answer.businessImpact}</div>
                        </div>
                      )}

                      {answer.actionItems && answer.actionItems.length > 0 && (
                        <div className="answer-section-block">
                          <div className="section-block-header">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="9 11 12 14 22 4"></polyline>
                              <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
                            </svg>
                            Action Items
                          </div>
                          <ul className="action-items-list">
                            {answer.actionItems.map((item, index) => (
                              <li key={index}>{item}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {answer.technicalDetails && (
                        <div className="answer-section-block technical">
                          <div className="section-block-header">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="16 18 22 12 16 6"></polyline>
                              <polyline points="8 6 2 12 8 18"></polyline>
                            </svg>
                            Technical Details
                          </div>
                          <div className="technical-details">
                            {Object.entries(answer.technicalDetails).map(([key, value]) => (
                              <div key={key} className="detail-row">
                                <span className="detail-key">{key}:</span>
                                <span className="detail-value">{JSON.stringify(value)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </>
            ) : null}
          </div>
        )}

        {/* Empty State */}
        {!loading && !answer && (
          <div className="empty-state">
            <div className="empty-icon">
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="16 18 22 12 16 6"></polyline>
                <polyline points="8 6 2 12 8 18"></polyline>
              </svg>
            </div>
            <div className="empty-title">Ready to analyze</div>
            <div className="empty-subtitle">
              Select a repository and ask a question about your codebase
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
