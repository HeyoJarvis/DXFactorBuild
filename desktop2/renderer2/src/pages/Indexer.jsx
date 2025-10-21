import { useState, useEffect, useRef } from 'react';
import DraggableHeader from '../components/common/DraggableHeader';
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
  const [jiraIssues, setJiraIssues] = useState([]);
  const [jiraLoading, setJiraLoading] = useState(true);
  const [jiraConnected, setJiraConnected] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState(null); // Selected JIRA ticket
  const [ticketRepoMapping, setTicketRepoMapping] = useState(new Map()); // JIRA ticket -> GitHub repo mapping
  const [assignedIssues, setAssignedIssues] = useState(new Set()); // Track locally assigned issues
  const [indexingStatus, setIndexingStatus] = useState(null); // Track indexing progress
  const [isIndexing, setIsIndexing] = useState(false); // Is currently indexing
  const [semanticUnderstanding, setSemanticUnderstanding] = useState(null); // Semantic intent understanding
  const [useSemanticParsing, setUseSemanticParsing] = useState(true); // Enable/disable semantic parsing
  const queryInputRef = useRef(null);

  // Load repositories and JIRA issues on mount
  useEffect(() => {
    loadRepositories();
    checkIndexerStatus();
    loadJiraIssues();
  }, []);

  // Auto-link JIRA tickets to GitHub repos when both are loaded
  useEffect(() => {
    if (jiraIssues.length > 0 && repositories.length > 0) {
      linkTicketsToRepos();
    }
  }, [jiraIssues, repositories]);

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

  // Load JIRA issues for the current user
  const loadJiraIssues = async () => {
    try {
      setJiraLoading(true);

      if (window.electronAPI?.jira) {
        // Check if JIRA is connected
        const connectionStatus = await window.electronAPI.jira.checkConnection();
        setJiraConnected(connectionStatus.connected);

        if (connectionStatus.connected) {
          // Fetch user's JIRA issues
          const result = await window.electronAPI.jira.getMyIssues({
            maxResults: 10,
            status: 'In Progress,To Do,Code Review,In Review'
          });

          console.log('📋 Loaded JIRA issues:', result);

          if (result.success && result.issues) {
            setJiraIssues(result.issues);
          }
        }
      }
    } catch (error) {
      console.error('Failed to load JIRA issues:', error);
    } finally {
      setJiraLoading(false);
    }
  };

  // Link JIRA tickets to GitHub repositories using ticket key pattern matching
  const linkTicketsToRepos = () => {
    const mapping = new Map();

    jiraIssues.forEach(issue => {
      // Extract ticket key (e.g., "PROJ-123")
      const ticketKey = issue.key;

      // Check if ticket description or summary mentions a repo
      const description = issue.description || '';
      const summary = issue.summary || '';
      const searchText = `${description} ${summary}`.toLowerCase();

      // Try to find matching repository
      const matchedRepo = repositories.find(repo => {
        const repoName = repo.name.toLowerCase();
        const fullName = repo.full_name.toLowerCase();

        // Check if repo name is mentioned in ticket
        return searchText.includes(repoName) || searchText.includes(fullName);
      });

      if (matchedRepo) {
        mapping.set(ticketKey, matchedRepo.full_name);
        console.log(`🔗 Linked ${ticketKey} to ${matchedRepo.full_name}`);
      } else {
        // Default to first repo if no match found
        if (repositories.length > 0) {
          mapping.set(ticketKey, repositories[0].full_name);
        }
      }
    });

    setTicketRepoMapping(mapping);
    console.log('📊 Ticket-to-Repo mapping complete:', mapping.size, 'tickets mapped');
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
      setSemanticUnderstanding(null);

      // Parse owner/repo from selected repo
      const [owner, repo] = selectedRepo.split('/');

      console.log('🔍 Querying codebase:', {
        query,
        owner,
        repo,
        ticket: selectedTicket?.key,
        useSemanticParsing
      });

      // Build context for the query
      const context = {
        ticket: selectedTicket ? {
          key: selectedTicket.key,
          summary: selectedTicket.summary,
          description: selectedTicket.description,
          status: selectedTicket.status?.name,
          priority: selectedTicket.priority?.name
        } : null,
        recentFiles: answer?.sources?.map(s => s.file) || []
      };

      const result = await window.electronAPI.codeIndexer.query({
        query,
        repository: { owner, repo },
        context,
        useSemanticParsing
      });

      console.log('📝 Query result:', result);

      // Store semantic understanding if available
      if (result.semanticContext) {
        setSemanticUnderstanding({
          businessGoal: result.semanticContext.businessGoal,
          capabilities: result.semanticContext.capabilities,
          confidence: result.semanticContext.confidence,
          filePatterns: result.semanticContext.filePatterns,
          searchTerms: result.semanticContext.searchTerms
        });
        console.log('🧠 Semantic understanding:', result.semanticContext);
      }

      if (result.success) {
        // Format the response to match expected structure
        const formattedAnswer = {
          summary: result.data.answer || result.data.summary || 'No answer provided',
          confidence: result.data.confidence || result.semanticContext?.confidence || 'medium',
          sources: result.data.sources || [],
          processingTime: result.data.processingTime,
          metadata: result.data.metadata,
          // Business-friendly sections
          businessImpact: extractBusinessImpact(result.data.answer),
          actionItems: extractActionItems(result.data.answer),
          technicalDetails: {
            repository: `${owner}/${repo}`,
            searchResults: result.data.sources?.length || 0,
            processingTimeMs: result.data.processingTime
          },
          // Include semantic understanding
          semanticUnderstanding: result.semanticContext
        };

        setAnswer(formattedAnswer);
      } else {
        setAnswer({
          summary: 'Query failed',
          error: result.error || 'Unknown error occurred',
          technicalDetails: {
            error: result.error,
            repository: `${owner}/${repo}`
          }
        });
      }
    } catch (error) {
      console.error('Failed to query codebase:', error);
      setAnswer({
        summary: 'Error processing query',
        error: error.message,
        technicalDetails: {
          error: error.message,
          stack: error.stack
        }
      });
    } finally {
      setLoading(false);
    }
  };

  // Helper to extract business impact from AI response
  const extractBusinessImpact = (answerText) => {
    if (!answerText) return null;

    // Look for business impact indicators in the response
    const businessKeywords = ['customer', 'user', 'business', 'value', 'benefit', 'impact'];
    const sentences = answerText.split(/[.!?]+/);

    const impactSentences = sentences.filter(sentence =>
      businessKeywords.some(keyword =>
        sentence.toLowerCase().includes(keyword)
      )
    );

    return impactSentences.length > 0
      ? impactSentences.slice(0, 2).join('. ').trim() + '.'
      : null;
  };

  // Helper to extract action items from AI response
  const extractActionItems = (answerText) => {
    if (!answerText) return [];

    // Look for bullet points, numbered lists, or action-oriented sentences
    const lines = answerText.split('\n');
    const actionItems = [];

    lines.forEach(line => {
      const trimmed = line.trim();
      // Match bullet points (-, *, •) or numbered lists (1., 2., etc.)
      if (/^[-*•]\s+/.test(trimmed) || /^\d+\.\s+/.test(trimmed)) {
        const item = trimmed.replace(/^[-*•]\s+/, '').replace(/^\d+\.\s+/, '');
        if (item.length > 10) { // Filter out very short items
          actionItems.push(item);
        }
      }
    });

    return actionItems.slice(0, 5); // Limit to 5 action items
  };

  // Handle enter key in query input
  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      askQuestion();
    }
  };

  // Handle feature selection
  const handleFeatureClick = (issue) => {
    setSelectedFeature(issue.id);
    setSelectedTicket(issue);

    // Auto-select linked repository for this ticket
    const linkedRepo = ticketRepoMapping.get(issue.key);
    if (linkedRepo) {
      setSelectedRepo(linkedRepo);
      console.log(`🎯 Auto-selected repo: ${linkedRepo} for ticket ${issue.key}`);
    } else if (repositories.length > 0) {
      setSelectedRepo(repositories[0].full_name);
    }

    setQuery(`Explain the implementation of ${issue.summary} in detail`);

    // Focus query input
    if (queryInputRef.current) {
      queryInputRef.current.focus();
    }
  };

  // Format relative time
  const formatRelativeTime = (dateString) => {
    if (!dateString) return 'Unknown';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 60) return `${diffMins} minutes ago`;
    if (diffHours < 24) return `${diffHours} hours ago`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  };

  // Extract description text (handles both string and object formats)
  const getDescriptionText = (description) => {
    if (!description) return '';
    if (typeof description === 'string') return description;
    // JIRA sometimes returns description as an object with content
    if (typeof description === 'object' && description.content) {
      // Extract text from ADF (Atlassian Document Format)
      const extractText = (content) => {
        if (Array.isArray(content)) {
          return content.map(extractText).join(' ');
        }
        if (content.text) return content.text;
        if (content.content) return extractText(content.content);
        return '';
      };
      return extractText(description.content);
    }
    return '';
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
      'Highest': '#dc2626',
      'Medium': '#f59e0b',
      'Low': '#6b7280',
      'Lowest': '#9ca3af'
    };
    return colors[priority] || colors['Medium'];
  };

  // Index the selected repository
  const indexRepository = async () => {
    if (!selectedRepo) {
      alert('Please select a repository first');
      return;
    }

    const [owner, repo] = selectedRepo.split('/');

    try {
      setIsIndexing(true);
      setIndexingStatus('Starting indexing...');

      console.log('🔨 Starting indexing:', { owner, repo });

      const result = await window.electronAPI.codeIndexer.indexRepository({
        owner,
        repo,
        branch: 'main'
      });

      console.log('📊 Indexing result:', result);

      if (result.success) {
        setIndexingStatus(`Indexing started! Job ID: ${result.jobId}`);

        // Show success message
        alert(`Repository indexing started!\n\n${result.message}\n\nThis may take a few minutes. You'll be able to query the code once indexing completes.`);
      } else {
        setIndexingStatus(`Error: ${result.error}`);
        alert(`Failed to start indexing: ${result.error}`);
      }

    } catch (error) {
      console.error('Failed to index repository:', error);
      setIndexingStatus(`Error: ${error.message}`);
      alert(`Failed to index repository: ${error.message}`);
    } finally {
      setIsIndexing(false);
      // Clear status after 5 seconds
      setTimeout(() => setIndexingStatus(null), 5000);
    }
  };

  // Handle assigning/unassigning a ticket to yourself
  const handleAssignTicket = async (issue, e) => {
    e.stopPropagation();

    const isAssigned = assignedIssues.has(issue.id);

    try {
      if (isAssigned) {
        // Unassign
        const result = await window.electronAPI.tasks.update(issue.id, {
          secondary_assignee: null
        });

        if (result.success) {
          setAssignedIssues(prev => {
            const newSet = new Set(prev);
            newSet.delete(issue.id);
            return newSet;
          });
          console.log('✅ Unassigned from ticket:', issue.key);
        }
      } else {
        // Assign to yourself
        const result = await window.electronAPI.tasks.update(issue.id, {
          secondary_assignee: user?.id
        });

        if (result.success) {
          setAssignedIssues(prev => new Set(prev).add(issue.id));
          console.log('✅ Assigned to ticket:', issue.key);
        }
      }
    } catch (error) {
      console.error('Failed to assign/unassign ticket:', error);
    }
  };

  return (
    <div className="indexer-page">
      {/* Draggable Window Controls */}
      <DraggableHeader title="Code Indexer" />

      {/* Professional Header - Matching Design */}
      <div className="indexer-header">
        <div className="header-container">
          {/* Left - Title and Status */}
          <div className="header-left">
            <div className="header-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="16 18 22 12 16 6"></polyline>
                <polyline points="8 6 2 12 8 18"></polyline>
              </svg>
            </div>
            <div className="header-title-group">
              <h1 className="header-title">Code Indexer</h1>
              <div className="header-subtitle">
                <div className={`status-dot ${indexerStatus?.available ? 'active' : 'inactive'}`}></div>
                <span>
                  {repositories.length > 0 
                    ? `${repositories.length.toLocaleString()} files indexed` 
                    : 'No repositories available'}
                </span>
                <span className="header-divider-dot">•</span>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="23 4 23 10 17 10"></polyline>
                  <polyline points="1 20 1 14 7 14"></polyline>
                  <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
                </svg>
                <span>Synced 2 hours ago</span>
              </div>
            </div>
          </div>

          {/* Right - Controls */}
          <div className="header-right">
            {/* Minimize Button */}
            <button 
              className="btn-ghost btn-icon"
              onClick={() => window.close()}
              title="Close window"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="indexer-content">
        {/* Unified Search Section - Repository + JIRA Ticket Selector */}
        <div className="unified-search-section">
          <div className="search-section-header">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"></circle>
              <path d="m21 21-4.35-4.35"></path>
            </svg>
            <span className="search-label">SEARCH CODEBASE</span>
          </div>

          <div className="search-controls">
            {/* Repository Selector with Index Button */}
            <div className="repo-selector-inline">
              <div className="selector-label">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"></path>
                </svg>
                Repository
              </div>
              <div className="repo-selector-with-button">
                <select
                  className="repo-select-compact"
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
                <button
                  className="btn-index-repo"
                  onClick={indexRepository}
                  disabled={!selectedRepo || isIndexing}
                  title={selectedRepo ? `Index ${selectedRepo}` : 'Select a repository first'}
                >
                  {isIndexing ? (
                    <>
                      <svg className="spinner" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="12" y1="2" x2="12" y2="6"></line>
                        <line x1="12" y1="18" x2="12" y2="22"></line>
                        <line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line>
                        <line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line>
                        <line x1="2" y1="12" x2="6" y2="12"></line>
                        <line x1="18" y1="12" x2="22" y2="12"></line>
                        <line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line>
                        <line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line>
                      </svg>
                      Indexing...
                    </>
                  ) : (
                    <>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                        <polyline points="7.5 4.21 12 6.81 16.5 4.21"></polyline>
                        <polyline points="7.5 19.79 7.5 14.6 3 12"></polyline>
                        <polyline points="21 12 16.5 14.6 16.5 19.79"></polyline>
                        <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
                        <line x1="12" y1="22.08" x2="12" y2="12"></line>
                      </svg>
                      Index Repo
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* OR Separator - Only show when JIRA is available */}
            {jiraConnected && jiraIssues.length > 0 && (
              <div className="or-separator">
                <div className="or-line"></div>
                <span className="or-text">OR</span>
                <div className="or-line"></div>
              </div>
            )}

            {/* JIRA Ticket Selector (Optional) */}
            {jiraConnected && jiraIssues.length > 0 && (
              <div className="ticket-selector-inline">
                <div className="selector-label">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                    <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
                    <line x1="12" y1="22.08" x2="12" y2="12"></line>
                  </svg>
                  JIRA Ticket (Optional)
                </div>
                <select
                  className="ticket-select-compact"
                  value={selectedFeature}
                  onChange={(e) => {
                    const issueId = e.target.value;
                    const issue = jiraIssues.find(i => i.id === issueId);
                    if (issue) {
                      handleFeatureClick(issue);
                    } else {
                      setSelectedFeature('');
                      setSelectedTicket(null);
                    }
                  }}
                  disabled={jiraLoading}
                >
                  <option value="">None (Search all code)</option>
                  {jiraIssues.map((issue) => (
                    <option key={issue.id} value={issue.id}>
                      {issue.key} - {issue.summary}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Show auto-linked repo hint */}
          {selectedTicket && ticketRepoMapping.has(selectedTicket.key) && (
            <div className="auto-link-hint">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
              </svg>
              <span>Auto-linked to <strong>{ticketRepoMapping.get(selectedTicket.key)}</strong></span>
            </div>
          )}
        </div>

        {/* Query Section - Always visible */}
        <div className="query-section">
          <div className="query-section-header">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"></circle>
              <path d="m21 21-4.35-4.35"></path>
            </svg>
            <span>ASK A QUESTION</span>
          </div>
          <div className="query-card">
            <div className={`query-input-wrapper ${isQueryFocused ? 'focused' : ''}`}>
              <input
                ref={queryInputRef}
                type="text"
                className="query-input-compact"
                placeholder="How does authentication work in this codebase?"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyPress={handleKeyPress}
                onFocus={() => setIsQueryFocused(true)}
                onBlur={() => setIsQueryFocused(false)}
                disabled={!selectedRepo || !indexerStatus?.available}
              />
              <button 
                className="query-analyze-btn"
                onClick={askQuestion}
                disabled={!query.trim() || !selectedRepo || loading || !indexerStatus?.available}
              >
                {loading ? (
                  <>
                    <div className="btn-spinner"></div>
                    Analyzing...
                  </>
                ) : (
                  <>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="16 18 22 12 16 6"></polyline>
                      <polyline points="8 6 2 12 8 18"></polyline>
                    </svg>
                    Analyze
                  </>
                )}
              </button>
            </div>
            <div className="query-suggestion">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"></path>
              </svg>
              <span>Try asking: <strong>Where is user authentication handled?</strong></span>
            </div>
          </div>
        </div>


        {/* JIRA Features List - Always visible for quick assignment */}
        <div className="features-section">
          <div className="features-header">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
              <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
              <line x1="12" y1="22.08" x2="12" y2="12"></line>
            </svg>
            <div className="features-title-group">
              <span className="features-title">Your JIRA Tickets</span>
              <span className="features-subtitle">Click + to assign yourself</span>
            </div>
          </div>

          <div className="features-grid">
            {jiraLoading ? (
              <div className="jira-loading-state">
                <div className="loading-spinner-small"></div>
                <span>Loading JIRA issues...</span>
              </div>
            ) : !jiraConnected ? (
              <div className="jira-not-connected">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M11.571 11.513H0a5.218 5.218 0 0 0 5.232 5.215h2.13v2.057A5.215 5.215 0 0 0 12.575 24V12.518a1.005 1.005 0 0 0-1.005-1.005zm5.723-5.756H5.736a5.215 5.215 0 0 0 5.215 5.214h2.129v2.058a5.218 5.218 0 0 0 5.215 5.214V6.758a1.001 1.001 0 0 0-1.001-1.001zM23.013 0H11.455a5.215 5.215 0 0 0 5.215 5.215h2.129v2.057A5.215 5.215 0 0 0 24 12.483V1.005A1.001 1.001 0 0 0 23.013 0Z"/>
                </svg>
                <h3>JIRA Not Connected</h3>
                <p>Connect your JIRA account to see your assigned issues here</p>
                <button className="connect-jira-btn" onClick={async () => {
                  if (window.electronAPI?.jira) {
                    await window.electronAPI.jira.authenticate();
                    loadJiraIssues();
                  }
                }}>
                  Connect JIRA
                </button>
              </div>
            ) : jiraIssues.length === 0 ? (
              <div className="jira-empty-state">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <polyline points="9 11 12 14 22 4"></polyline>
                  <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
                </svg>
                <h3>No Active Issues</h3>
                <p>You don't have any JIRA issues assigned to you</p>
              </div>
            ) : (
              jiraIssues.slice(0, 6).map((issue) => (
                <div 
                  key={issue.id}
                  className={`feature-card ${selectedFeature === issue.id ? 'selected' : ''}`}
                  onClick={() => handleFeatureClick(issue)}
                >
                  {/* Feature Header */}
                  <div className="feature-card-header">
                    <div className="feature-id-badge">
                      <span className="feature-id">{issue.key}</span>
                      {issue.priority?.name && (
                        <span 
                          className="feature-badge-inline"
                          style={{ 
                            background: `${getPriorityColor(issue.priority.name)}15`,
                            color: getPriorityColor(issue.priority.name)
                          }}
                        >
                          {issue.priority.name.toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div className="feature-header-actions">
                      {issue.status?.name && (
                        <span 
                          className="feature-status-badge"
                          style={{ 
                            background: `${getStatusColor(issue.status.name)}15`,
                            color: getStatusColor(issue.status.name)
                          }}
                        >
                          {issue.status.name.toUpperCase()}
                        </span>
                      )}
                      <button 
                        className={`assign-btn ${assignedIssues.has(issue.id) ? 'assigned' : ''}`}
                        onClick={(e) => handleAssignTicket(issue, e)}
                        title={assignedIssues.has(issue.id) ? 'Unassign from me' : 'Assign to me'}
                      >
                        {assignedIssues.has(issue.id) ? (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12"></polyline>
                          </svg>
                        ) : (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="12" y1="5" x2="12" y2="19"></line>
                            <line x1="5" y1="12" x2="19" y2="12"></line>
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Feature Title */}
                  <div className="feature-title">{issue.summary}</div>

                  {/* Feature Description */}
                  {(() => {
                    const descText = getDescriptionText(issue.description);
                    return descText && (
                      <div className="feature-description">
                        {descText.substring(0, 100)}
                        {descText.length > 100 ? '...' : ''}
                      </div>
                    );
                  })()}

                  {/* Feature Metadata */}
                  <div className="feature-metadata">
                    <div className="metadata-item">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                        <polyline points="14 2 14 8 20 8"></polyline>
                      </svg>
                      <span>{issue.issue_type?.name || 'Task'}</span>
                    </div>
                    {issue.assignee?.display_name && (
                      <div className="metadata-item">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                          <circle cx="12" cy="7" r="4"></circle>
                        </svg>
                        {issue.assignee.display_name}
                      </div>
                    )}
                    <div className="metadata-item">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10"></circle>
                        <polyline points="12 6 12 12 16 14"></polyline>
                      </svg>
                      {formatRelativeTime(issue.updated_at)}
                    </div>
                    {issue.labels && issue.labels.length > 0 && (
                      <div className="metadata-item">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path>
                          <line x1="7" y1="7" x2="7.01" y2="7"></line>
                        </svg>
                        {issue.labels.slice(0, 2).join(', ')}
                      </div>
                    )}
                  </div>

                  {/* Analyze Button */}
                  <button className="feature-analyze-btn" onClick={(e) => {
                    e.stopPropagation();
                    handleFeatureClick(issue);
                    askQuestion();
                  }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="11" cy="11" r="8"></circle>
                      <path d="m21 21-4.35-4.35"></path>
                    </svg>
                    Analyze Code
                  </button>
                </div>
              ))
            )}
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
