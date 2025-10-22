import React, { useState, useEffect } from 'react';
import TaskChat from '../components/Tasks/TaskChat';
import DraggableHeader from '../components/common/DraggableHeader';
import './TasksDeveloper_New.css';
/**
 * Tasks (Developer) - JIRA & GitHub Focused
 * Features action items from JIRA with GitHub repository context
 */
function TasksDeveloper({ user }) {
  const [actionItems, setActionItems] = useState([]);
  const [selectedRepo, setSelectedRepo] = useState(null);
  const [selectedFeature, setSelectedFeature] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expandedCards, setExpandedCards] = useState({});
  const [chatTask, setChatTask] = useState(null);
  const [jiraConnected, setJiraConnected] = useState(false);
  const [jiraSiteUrl, setJiraSiteUrl] = useState('');
  const [syncStatus, setSyncStatus] = useState('');
  const [error, setError] = useState(null);
  
  // Inline editing states
  const [editingTitle, setEditingTitle] = useState(null); // taskId being edited
  const [editedTitleValue, setEditedTitleValue] = useState('');
  const [editingRepo, setEditingRepo] = useState(null); // taskId being edited
  const [editedRepoValue, setEditedRepoValue] = useState('');
  const [availableRepos, setAvailableRepos] = useState([]);
  const [savingTask, setSavingTask] = useState(null);

  // Mock JIRA feature progress items (epic-level with sub-tasks)
  const mockActionItems = [
    {
      id: 'PROJ-123',
      epicName: 'User Authentication System',
      title: 'Implement OAuth 2.0 with session management',
      userStory: {
        asA: 'User',
        whenI: 'Sign in with GitHub or Google',
        soThat: 'I can securely access the platform'
      },
      acceptanceCriteria: [
        'OAuth 2.0 flow implemented for GitHub and Google',
        'Token refresh mechanism working',
        'Session persistence across browser sessions',
        'Proper error handling for failed authentication'
      ],
      description: `As a user
When I sign in with GitHub or Google
So that I can securely access the platform

Acceptance Criteria:
• OAuth 2.0 flow implemented for GitHub and Google
• Token refresh mechanism working
• Session persistence across browser sessions
• Proper error handling for failed authentication`,
      assignees: ['Sarah Chen', 'Mike Johnson'],
      priority: 'High',
      status: 'In Progress',
      confidence: 'on-track', // on-track, at-risk, off-track
      progress: 61,
      storyPoints: { completed: 8, total: 13 },
      taskBreakdown: { todo: 2, inProgress: 3, done: 8 },
      repository: 'heyjarvis/backend',
      branch: 'feature/auth-system',
      prs: [
        { status: 'open', title: 'Add OAuth providers', reviewers: 2 },
        { status: 'merged', title: 'Session middleware', commits: 5 }
      ],
      commits: 15,
      lastUpdated: '2 hours ago',
      cycleTime: '2.1 days',
      sprint: 'Sprint 48'
    },
    {
      id: 'PROJ-124',
      epicName: 'Real-time Communication',
      title: 'WebSocket-based Slack integration',
      userStory: {
        asA: 'Team member',
        whenI: 'Send a Slack message',
        soThat: 'It appears in the app in real-time'
      },
      acceptanceCriteria: [
        'WebSocket connection established with Slack API',
        'Real-time message syncing functional',
        'Reconnection logic handles dropped connections',
        'Offline message queue implemented'
      ],
      description: `As a team member
When I send a Slack message
So that it appears in the app in real-time

Acceptance Criteria:
• WebSocket connection established with Slack API
• Real-time message syncing functional
• Reconnection logic handles dropped connections
• Offline message queue implemented`,
      assignees: ['Mike Johnson', 'Emma Davis'],
      priority: 'High',
      status: 'Code Review',
      confidence: 'on-track',
      progress: 72,
      storyPoints: { completed: 10, total: 13 },
      taskBreakdown: { todo: 0, inProgress: 2, done: 10 },
      repository: 'heyjarvis/integrations',
      branch: 'feature/slack-realtime',
      prs: [
        { status: 'review-requested', title: 'WebSocket client', reviewers: 3 }
      ],
      commits: 22,
      lastUpdated: '4 hours ago',
      cycleTime: '3.2 days',
      sprint: 'Sprint 48'
    },
    {
      id: 'PROJ-125',
      epicName: 'Analytics Dashboard',
      title: 'Real-time metrics aggregation engine',
      userStory: {
        asA: 'Product manager',
        whenI: 'View the analytics dashboard',
        soThat: 'I can see real-time performance metrics'
      },
      acceptanceCriteria: [
        'Data aggregation pipeline processes metrics in real-time',
        'Redis caching layer reduces database load',
        'Dashboard updates every 5 seconds',
        'Historical data available for 90 days'
      ],
      description: `As a product manager
When I view the analytics dashboard
So that I can see real-time performance metrics

Acceptance Criteria:
• Data aggregation pipeline processes metrics in real-time
• Redis caching layer reduces database load
• Dashboard updates every 5 seconds
• Historical data available for 90 days`,
      assignees: ['Emma Davis'],
      priority: 'Medium',
      status: 'Done',
      confidence: 'on-track',
      progress: 100,
      storyPoints: { completed: 11, total: 11 },
      taskBreakdown: { todo: 0, inProgress: 0, done: 11 },
      repository: 'heyjarvis/analytics',
      branch: 'feature/dashboard-metrics',
      prs: [
        { status: 'merged', title: 'Analytics engine', commits: 18 },
        { status: 'merged', title: 'Caching layer', commits: 7 }
      ],
      commits: 25,
      lastUpdated: '1 day ago',
      cycleTime: '4.5 days',
      sprint: 'Sprint 48'
    },
    {
      id: 'PROJ-126',
      epicName: 'API Security Layer',
      title: 'Rate limiting and throttling system',
      userStory: {
        asA: 'Platform admin',
        whenI: 'API endpoints receive excessive requests',
        soThat: 'The system remains stable and secure'
      },
      acceptanceCriteria: [
        'Redis-based rate limiting on all API endpoints',
        'Configurable limits per user tier (free/pro/enterprise)',
        'IP blocking for repeated violations',
        'Clear error messages when limits exceeded'
      ],
      description: `As a platform admin
When API endpoints receive excessive requests
So that the system remains stable and secure

Acceptance Criteria:
• Redis-based rate limiting on all API endpoints
• Configurable limits per user tier (free/pro/enterprise)
• IP blocking for repeated violations
• Clear error messages when limits exceeded`,
      assignees: ['Alex Kumar', 'Sarah Chen'],
      priority: 'High',
      status: 'Blocked',
      confidence: 'at-risk',
      progress: 23,
      storyPoints: { completed: 2, total: 8 },
      taskBreakdown: { todo: 5, inProgress: 1, done: 2 },
      repository: 'heyjarvis/backend',
      branch: 'feature/rate-limiting',
      prs: [],
      commits: 6,
      lastUpdated: '3 days ago',
      cycleTime: '6.8 days',
      sprint: 'Sprint 48',
      blockReason: 'Waiting on Redis cluster setup'
    }
  ];

  // Mock GitHub repositories
  const mockRepositories = [
    {
      name: 'heyjarvis/backend',
      description: 'Core backend services and API',
      stars: 127,
      language: 'Node.js',
      lastCommit: '2 hours ago',
      openPRs: 3,
      activeBranches: 8
    },
    {
      name: 'heyjarvis/integrations',
      description: 'Third-party integration services',
      stars: 84,
      language: 'TypeScript',
      lastCommit: '4 hours ago',
      openPRs: 2,
      activeBranches: 5
    },
    {
      name: 'heyjarvis/analytics',
      description: 'Analytics and reporting engine',
      stars: 56,
      language: 'Python',
      lastCommit: '1 day ago',
      openPRs: 1,
      activeBranches: 3
    }
  ];

  // Mock features linked to JIRA
  const mockFeatures = [
    {
      id: 'PROJ-123',
      title: 'User Authentication System',
      repository: 'heyjarvis/backend',
      branch: 'feature/auth-system',
      commits: 15,
      files: 23,
      additions: 1247,
      deletions: 89,
      tests: 12,
      coverage: 87,
      lastCommit: {
        author: 'Sarah Chen',
        message: 'Add OAuth token refresh logic',
        time: '2 hours ago'
      }
    },
    {
      id: 'PROJ-124',
      title: 'Real-time Slack Integration',
      repository: 'heyjarvis/integrations',
      branch: 'feature/slack-realtime',
      commits: 22,
      files: 18,
      additions: 2134,
      deletions: 156,
      tests: 18,
      coverage: 92,
      lastCommit: {
        author: 'Mike Johnson',
        message: 'Implement message queue for offline handling',
        time: '4 hours ago'
      }
    }
  ];

  // Check JIRA connection and load data on mount
  useEffect(() => {
    checkJIRAConnection();
    loadJIRAIssues();
    loadAvailableRepositories();
  }, []);
  
  // Load available GitHub repositories
  const loadAvailableRepositories = async () => {
    try {
      const response = await window.electronAPI.codeIndexer.listRepositories();
      if (response.success && response.repositories) {
        setAvailableRepos(response.repositories.map(repo => repo.name || repo.full_name));
      }
    } catch (error) {
      console.error('Failed to load repositories:', error);
    }
  };
  
  // Start editing title
  const startEditingTitle = (item) => {
    setEditingTitle(item.id);
    setEditedTitleValue(item.title);
  };
  
  // Save title
  const saveTitle = async (item) => {
    if (!editedTitleValue.trim()) {
      alert('Title cannot be empty');
      return;
    }
    
    setSavingTask(item.id);
    try {
      const response = await window.electronAPI.jira.updateIssue(item.id, {
        summary: editedTitleValue
      });
      
      if (response.success) {
        // Update local state
        setActionItems(prev => prev.map(task => 
          task.id === item.id ? { ...task, title: editedTitleValue } : task
        ));
        setEditingTitle(null);
      } else {
        alert('Failed to update title: ' + (response.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Failed to save title:', error);
      alert('Failed to update title');
    } finally {
      setSavingTask(null);
    }
  };
  
  // Cancel title edit
  const cancelTitleEdit = () => {
    setEditingTitle(null);
    setEditedTitleValue('');
  };
  
  // Start editing repository
  const startEditingRepo = (item) => {
    setEditingRepo(item.id);
    setEditedRepoValue(item.repository);
  };
  
  // Save repository
  const saveRepository = async (item) => {
    setSavingTask(item.id);
    try {
      // Update JIRA with repository link
      const response = await window.electronAPI.jira.updateIssue(item.id, {
        customFields: {
          repository: editedRepoValue
        }
      });
      
      if (response.success) {
        // Update local state
        setActionItems(prev => prev.map(task => 
          task.id === item.id ? { ...task, repository: editedRepoValue } : task
        ));
        setEditingRepo(null);
      } else {
        alert('Failed to update repository: ' + (response.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Failed to save repository:', error);
      alert('Failed to update repository');
    } finally {
      setSavingTask(null);
    }
  };
  
  // Cancel repository edit
  const cancelRepoEdit = () => {
    setEditingRepo(null);
    setEditedRepoValue('');
  };

  // Check JIRA connection status
  const checkJIRAConnection = async () => {
    try {
      if (!window.electronAPI?.jira) {
        console.log('JIRA API not available');
        return;
      }

      const result = await window.electronAPI.jira.checkConnection();
      
      if (result.success && result.connected) {
        setJiraConnected(true);
        setJiraSiteUrl(result.siteUrl || '');
      } else {
        setJiraConnected(false);
      }
    } catch (error) {
      console.error('Failed to check JIRA connection:', error);
      setJiraConnected(false);
    }
  };

  // Authenticate with JIRA
  const handleJIRAAuth = async () => {
    try {
      setSyncStatus('Authenticating with JIRA...');
      setError(null);

      const result = await window.electronAPI.jira.authenticate();
      
      if (result.success) {
        setJiraConnected(true);
        setJiraSiteUrl(result.siteUrl || '');
        setSyncStatus('Connected! Loading issues...');
        
        // Load issues after successful auth
        await loadJIRAIssues();
      } else {
        setError(result.error || 'Failed to authenticate with JIRA');
        setSyncStatus('');
      }
    } catch (error) {
      console.error('JIRA authentication error:', error);
      setError(error.message || 'Failed to authenticate with JIRA');
      setSyncStatus('');
    }
  };

  // Load JIRA issues
  const loadJIRAIssues = async () => {
    try {
      if (!window.electronAPI?.jira) {
        console.log('JIRA API not available, using mock data');
        setActionItems(mockActionItems);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      const result = await window.electronAPI.jira.getMyIssues({
        status: 'In Progress,To Do,Code Review,Testing,Blocked'
      });
      
      if (result.success && result.issues) {
        // Debug: Log first issue to see structure
        if (result.issues.length > 0) {
          console.log('First JIRA issue data:', JSON.stringify(result.issues[0], null, 2));
        }
        
        // Transform JIRA issues to action items format
        const transformedItems = result.issues.map(issue => transformJIRAIssue(issue));
        console.log('First transformed item:', transformedItems[0]);
        setActionItems(transformedItems);
        setSyncStatus(`Loaded ${result.issues.length} issues`);
        
        // Clear status after 3 seconds
        setTimeout(() => setSyncStatus(''), 3000);
      } else {
        console.log('No JIRA issues found or not connected, using mock data');
        setActionItems(mockActionItems);
      }
    } catch (error) {
      console.error('Failed to load JIRA issues:', error);
      setError('Failed to load issues. Using mock data.');
      setActionItems(mockActionItems);
    } finally {
      setLoading(false);
    }
  };

  // Transform JIRA issue to action item format
  const transformJIRAIssue = (issue) => {
    // Debug data
    console.log(`Issue ${issue.key}:`, {
      epic: issue.epic,
      labels: issue.labels,
      issue_type: issue.issue_type,
      key: issue.key
    });
    
    // Parse user story from description if available
    let userStory = null;
    let acceptanceCriteria = [];
    
    // For parsing, convert description to string if it's an object (ADF format)
    // But we'll keep the original for the task object
    const descriptionForParsing = typeof issue.description === 'string' ? issue.description : 
                                   (issue.description ? JSON.stringify(issue.description) : '');
    
    if (descriptionForParsing) {
      // Try to parse user story format (only works for plain text descriptions)
      const asAMatch = descriptionForParsing.match(/As a\s+(.+?)[\n\r]/i);
      const whenIMatch = descriptionForParsing.match(/(?:When I|I want to)\s+(.+?)[\n\r]/i);
      const soThatMatch = descriptionForParsing.match(/(?:So that|In order to)\s+(.+?)[\n\r]/i);
      
      if (asAMatch || whenIMatch || soThatMatch) {
        userStory = {
          asA: asAMatch ? asAMatch[1].trim() : '',
          whenI: whenIMatch ? whenIMatch[1].trim() : '',
          soThat: soThatMatch ? soThatMatch[1].trim() : ''
        };
      }

      // Parse acceptance criteria (only works for plain text descriptions)
      const acMatch = descriptionForParsing.match(/Acceptance Criteria:?\s*\n([\s\S]*?)(?:\n\n|\n[A-Z]|$)/i);
      if (acMatch) {
        acceptanceCriteria = acMatch[1]
          .split('\n')
          .map(line => line.replace(/^[•\-*]\s*/, '').trim())
          .filter(line => line.length > 0);
      }
    }

    return {
      id: issue.key,
      epicName: issue.epic?.name || (issue.labels && issue.labels.length > 0 ? issue.labels.join(', ') : null) || (issue.issue_type?.name && issue.issue_type.name !== 'Task' ? issue.issue_type.name : null) || issue.key?.split('-')[0] || 'General',
      title: issue.summary,
      userStory: userStory || {
        asA: 'Developer',
        whenI: issue.summary,
        soThat: 'The feature is implemented'
      },
      acceptanceCriteria: acceptanceCriteria.length > 0 ? acceptanceCriteria : [
        'Implementation completed',
        'Tests passing',
        'Code reviewed',
        'Documentation updated'
      ],
      description: issue.description || issue.summary, // Keep original description (ADF object or string)
      assignees: issue.assignee ? [issue.assignee.display_name || issue.assignee.name || 'Unassigned'] : ['Unassigned'],
      priority: issue.priority?.name || 'Medium',
      status: issue.status?.name || 'To Do',
      confidence: getConfidenceLevel(issue),
      progress: calculateProgress(issue),
      storyPoints: {
        completed: Math.floor((issue.story_points || 5) * (calculateProgress(issue) / 100)),
        total: issue.story_points || 5
      },
      taskBreakdown: {
        todo: issue.subtasks_todo || 0,
        inProgress: issue.subtasks_in_progress || 0,
        done: issue.subtasks_done || 0
      },
      repository: extractRepository(issue),
      branch: extractBranch(issue),
      prs: extractPRs(issue),
      commits: 0, // Would need GitHub integration
      lastUpdated: formatRelativeTime(issue.updated),
      cycleTime: calculateCycleTime(issue),
      sprint: issue.sprint || 'Backlog',
      blockReason: issue.status?.name === 'Blocked' ? (issue.blocked_reason || 'Waiting on dependencies') : null,
      jiraUrl: issue.url,
      external_source: 'jira', // Mark as JIRA task for inline editing
      external_url: issue.url,
      external_key: issue.key
    };
  };

  // Helper functions for transforming JIRA data
  const getConfidenceLevel = (issue) => {
    if (issue.status?.name === 'Blocked') return 'off-track';
    if (issue.priority?.name === 'Highest' && calculateProgress(issue) < 50) return 'at-risk';
    return 'on-track';
  };

  const calculateProgress = (issue) => {
    if (issue.status?.name === 'Done') return 100;
    if (issue.status?.name === 'Testing') return 80;
    if (issue.status?.name === 'Code Review') return 70;
    if (issue.status?.name === 'In Progress') return 40;
    return 10;
  };

  const extractRepository = (issue) => {
    // Try to find repo in labels or custom fields
    const repoLabel = issue.labels?.find(l => l.includes('/'));
    return repoLabel || 'heyjarvis/backend';
  };

  const extractBranch = (issue) => {
    // Try to find branch in custom fields or generate from issue key
    return issue.branch || `feature/${issue.key.toLowerCase()}`;
  };

  const extractPRs = (issue) => {
    // Would need GitHub integration to get real PRs
    return [];
  };

  const formatRelativeTime = (timestamp) => {
    if (!timestamp) return 'Never';
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffMins < 60) return `${diffMins} minutes ago`;
    if (diffHours < 24) return `${diffHours} hours ago`;
    if (diffDays === 1) return 'Yesterday';
    return `${diffDays} days ago`;
  };

  const calculateCycleTime = (issue) => {
    if (!issue.created || !issue.updated) return 'N/A';
    const created = new Date(issue.created);
    const updated = new Date(issue.updated);
    const diffMs = updated - created;
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    return `${diffDays.toFixed(1)} days`;
  };

  // Sync JIRA tasks
  const handleSyncJIRA = async () => {
    try {
      setSyncStatus('Syncing with JIRA...');
      setError(null);

      const result = await window.electronAPI.jira.syncTasks();
      
      if (result.success) {
        setSyncStatus(`Synced! Created: ${result.tasksCreated}, Updated: ${result.tasksUpdated}`);
        
        // Reload issues
        await loadJIRAIssues();
        
        // Clear status after 3 seconds
        setTimeout(() => setSyncStatus(''), 3000);
      } else {
        setError(result.error || 'Failed to sync with JIRA');
        setSyncStatus('');
      }
    } catch (error) {
      console.error('JIRA sync error:', error);
      setError(error.message || 'Failed to sync with JIRA');
      setSyncStatus('');
    }
  };

  const handleActionItemClick = (item) => {
    // Find related repo and feature
    const repo = mockRepositories.find(r => r.name === item.repository);
    const feature = mockFeatures.find(f => f.id === item.id);
    
    setSelectedRepo(repo);
    setSelectedFeature(feature);
  };

  const handleFieldEdit = (itemId, field, value) => {
    // Update action item field
    setActionItems(prev => prev.map(item => 
      item.id === itemId ? { ...item, [field]: value } : item
    ));
  };

  const handleStatusChange = (itemId, newStatus) => {
    handleFieldEdit(itemId, 'status', newStatus);
  };

  const handleAssigneeChange = (itemId, newAssignee) => {
    handleFieldEdit(itemId, 'assignee', newAssignee);
  };

  const handleProgressChange = (itemId, newProgress) => {
    handleFieldEdit(itemId, 'progress', parseInt(newProgress));
  };

  const getProgressColor = (progress) => {
    if (progress >= 80) return '#34C759';
    if (progress >= 50) return '#FF9F0A';
    return '#FF3B30';
  };

  const getPriorityColor = (priority) => {
    switch(priority) {
      case 'High': return '#FF3B30';
      case 'Medium': return '#FF9F0A';
      case 'Low': return '#34C759';
      default: return '#86868b';
    }
  };

  const toggleCardExpansion = (cardId) => {
    setExpandedCards(prev => ({
      ...prev,
      [cardId]: !prev[cardId]
    }));
  };

  return (
    <div className="tasks-developer-page">
      {/* Draggable Window Controls */}
      <DraggableHeader title="Developer Tasks" />

      {/* Modern Clean Header - Draggable */}
      <div className="modern-header" style={{ WebkitAppRegion: 'drag' }}>
        <div className="header-content" style={{ WebkitAppRegion: 'no-drag' }}>
          {/* Left: Branding */}
          <div className="header-brand">
            <div className="brand-text">
              <h1 className="brand-title">Developer Tasks</h1>
              <span className="brand-subtitle">Sprint 48</span>
            </div>
          </div>

          {/* Center: Quick Stats */}
          <div className="header-stats">
            <div className="stat-item">
              <span className="stat-value stat-progress">8</span>
              <span className="stat-label">In Progress</span>
            </div>
            <div className="stat-divider"></div>
            <div className="stat-item">
              <span className="stat-value stat-done">23</span>
              <span className="stat-label">Completed</span>
            </div>
            <div className="stat-divider"></div>
            <div className="stat-item">
              <span className="stat-value stat-blocked">2</span>
              <span className="stat-label">Blocked</span>
            </div>
          </div>

          {/* Right: JIRA Status, User & Window Controls */}
          <div className="header-actions">
            {/* JIRA Connection Status */}
            {jiraConnected ? (
              <div className="jira-status-group">
                <div className="jira-status-badge connected" title={jiraSiteUrl}>
                  <img src="/JIRALOGO.png" alt="JIRA" style={{ width: '16px', height: '16px' }} />
                  <span className="status-dot"></span>
                </div>
                <button className="sync-btn" onClick={handleSyncJIRA} title="Sync JIRA">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <polyline points="23 4 23 10 17 10"></polyline>
                    <polyline points="1 20 1 14 7 14"></polyline>
                    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
                  </svg>
                </button>
              </div>
            ) : (
              <button className="connect-jira-btn" onClick={handleJIRAAuth} title="Connect JIRA">
                <img src="/JIRALOGO.png" alt="JIRA" style={{ width: '16px', height: '16px', marginRight: '6px' }} />
                <span>Connect</span>
              </button>
            )}

            {/* Sync Status Message */}
            {syncStatus && (
              <div className="sync-status-message">
                {syncStatus}
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="error-message" title={error}>
                ⚠️
              </div>
            )}
            
            <div className="user-menu">
              <div className="user-avatar-small">
                {user?.name ? user.name.charAt(0).toUpperCase() : 'D'}
              </div>
            </div>
            
            <button 
              className="minimize-btn" 
              onClick={() => {
                if (window.electronAPI?.window?.minimize) {
                  window.electronAPI.window.minimize();
                } else if (window.electron?.minimize) {
                  window.electron.minimize();
                } else if (window.ipcRenderer) {
                  window.ipcRenderer.send('minimize-window');
                } else {
                  console.log('Minimize not available - trying to close');
                  window.close();
                }
              }} 
              title="Minimize"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content - Full Width */}
      <div className="dev-tasks-content">

        <div className="action-items-list">
          {loading ? (
            <div className="loading-state">Loading tasks...</div>
          ) : (
            actionItems.map(item => (
                <div 
                  key={item.id} 
                  className={`feature-progress-card ${item.lastUpdated.includes('hour') || item.lastUpdated.includes('min') ? 'recently-updated' : ''}`}
                  data-status={item.status}
                  data-confidence={item.confidence}
                >
                  {/* Simplified Card Header */}
                  <div className="feature-card-header">
                    <div className="header-left-section">
                      <img src="/JIRALOGO.png" alt="JIRA" className="jira-logo-icon" />
                      <div className="title-group">
                        <div className="title-main-row">
                          <span className="feature-jira-key">{item.id}</span>
                          {editingTitle === item.id ? (
                            <div className="inline-title-edit">
                              <input
                                type="text"
                                value={editedTitleValue}
                                onChange={(e) => setEditedTitleValue(e.target.value)}
                                className="title-edit-input"
                                autoFocus
                                disabled={savingTask === item.id}
                              />
                              <div className="inline-edit-actions">
                                <button 
                                  className="save-btn-inline" 
                                  onClick={() => saveTitle(item)}
                                  disabled={savingTask === item.id}
                                >
                                  {savingTask === item.id ? 'Saving...' : 'Save'}
                                </button>
                                <button 
                                  className="cancel-btn-inline" 
                                  onClick={cancelTitleEdit}
                                  disabled={savingTask === item.id}
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <h3 
                              className="feature-task-title editable-title" 
                              onClick={() => startEditingTitle(item)}
                              title="Click to edit title"
                            >
                              {item.title}
                            </h3>
                          )}
                        </div>
                        <p className="feature-epic-subtitle">{item.epicName}</p>
                      </div>
                    </div>
                    <div className="header-right-section">
                      <div className={`status-tag status-${item.status.toLowerCase().replace(/ /g, '-')}`}>
                        {item.status}
                      </div>
                      <button 
                        className="jira-chat-btn" 
                        onClick={(e) => {
                          e.stopPropagation();
                          setChatTask(item);
                        }} 
                        title="Chat about this task"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                        </svg>
                      </button>
                      <button className="jira-link-btn" onClick={() => window.open(`https://jira.atlassian.com/browse/${item.id}`, '_blank')} title="Open in JIRA">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                          <polyline points="15 3 21 3 21 9"></polyline>
                          <line x1="10" y1="14" x2="21" y2="3"></line>
                        </svg>
                      </button>
                    </div>
                  </div>

                  {/* Technical Context Section */}
                  <div className="technical-context-section">
                    {/* GitHub Repository Info + PR Chips in same row */}
                    <div className="tech-header-row">
                      <div className="tech-repo-info">
                        <div className="tech-icon">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                            <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.17 6.839 9.49.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.603-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.463-1.11-1.463-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.167 22 16.418 22 12c0-5.523-4.477-10-10-10z"/>
                          </svg>
                        </div>
                        {editingRepo === item.id ? (
                          <div className="repo-edit-container">
                            <select
                              value={editedRepoValue}
                              onChange={(e) => setEditedRepoValue(e.target.value)}
                              className="repo-select"
                              disabled={savingTask === item.id}
                            >
                              <option value="">Select repository</option>
                              {availableRepos.map(repo => (
                                <option key={repo} value={repo}>{repo}</option>
                              ))}
                            </select>
                            <div className="inline-edit-actions-small">
                              <button 
                                className="save-btn-small" 
                                onClick={() => saveRepository(item)}
                                disabled={savingTask === item.id}
                              >
                                ✓
                              </button>
                              <button 
                                className="cancel-btn-small" 
                                onClick={cancelRepoEdit}
                                disabled={savingTask === item.id}
                              >
                                ✕
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="tech-content">
                            <span 
                              className="tech-repo editable-repo" 
                              onClick={() => startEditingRepo(item)}
                              title="Click to change repository"
                            >
                              {item.repository}
                            </span>
                            <span className="tech-divider">/</span>
                            <span className="tech-branch">{item.branch}</span>
                          </div>
                        )}
                      </div>

                      {/* PR Status Chips - Right Aligned */}
                      {item.prs && item.prs.length > 0 && (
                        <div className="pr-chips-row">
                          {item.prs.map((pr, idx) => (
                            <div key={idx} className={`pr-chip pr-${pr.status}`}>
                              <div className="pr-status-icon">
                                {pr.status === 'merged' && (
                                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                    <circle cx="18" cy="18" r="3"></circle>
                                    <circle cx="6" cy="6" r="3"></circle>
                                    <path d="M6 21V9a9 9 0 0 0 9 9"></path>
                                  </svg>
                                )}
                                {pr.status === 'open' && (
                                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                    <circle cx="18" cy="18" r="3"></circle>
                                    <circle cx="6" cy="6" r="3"></circle>
                                    <path d="M18 6V5"></path>
                                    <path d="M18 9V8"></path>
                                    <path d="M6 9v12"></path>
                                  </svg>
                                )}
                                {pr.status === 'review-requested' && (
                                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                                    <circle cx="12" cy="12" r="3"></circle>
                                  </svg>
                                )}
                                {pr.status === 'blocked' && (
                                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                    <circle cx="12" cy="12" r="10"></circle>
                                    <line x1="15" y1="9" x2="9" y2="15"></line>
                                    <line x1="9" y1="9" x2="15" y2="15"></line>
                                  </svg>
                                )}
                              </div>
                              <span className="pr-title">{pr.title}</span>
                              {pr.reviewers && (
                                <span className="pr-reviewers">{pr.reviewers} 👁</span>
                              )}
                              {pr.commits && (
                                <span className="pr-commits">{pr.commits} commits</span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Assignee Avatars + Last Updated - Under PR chips */}
                    <div className="bottom-meta-row">
                      <div className="assignee-cluster">
                        {item.assignees.map((assignee, idx) => (
                          <div 
                            key={idx} 
                            className="assignee-avatar"
                            title={assignee || 'Unassigned'}
                          >
                            {(assignee || 'Unassigned').split(' ').map(n => n[0]).join('')}
                          </div>
                        ))}
                      </div>
                      <span className="last-updated-stamp">Updated {item.lastUpdated}</span>
                    </div>
                  </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Task Chat Modal */}
      {chatTask && (
        <TaskChat 
          task={chatTask} 
          onClose={() => setChatTask(null)} 
        />
      )}
    </div>
  );
}

export default TasksDeveloper;

