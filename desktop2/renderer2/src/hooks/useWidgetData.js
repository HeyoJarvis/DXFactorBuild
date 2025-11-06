import { useState, useEffect, useCallback } from 'react';

/**
 * useWidgetData - Fetches and manages real-time data for widgets
 * Auto-refreshes every 60 seconds
 */
export default function useWidgetData(widget) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchJIRAByTeam = useCallback(async (teamName) => {
    try {
      if (!window.electronAPI?.jira?.getMyIssues) {
        throw new Error('JIRA not connected');
      }

      const result = await window.electronAPI.jira.getMyIssues();
      
      // Filter by team (assuming team info is in labels or custom field)
      const filtered = result.issues?.filter(issue => {
        const labels = issue.fields?.labels || [];
        const summary = issue.fields?.summary?.toLowerCase() || '';
        const description = issue.fields?.description?.toLowerCase() || '';
        const teamLower = teamName.toLowerCase();
        
        return labels.some(label => label.toLowerCase().includes(teamLower)) ||
               summary.includes(teamLower) ||
               description.includes(teamLower);
      }) || [];

      return {
        count: filtered.length,
        items: filtered.slice(0, 5).map(issue => ({
          key: issue.key,
          title: issue.fields?.summary,
          status: issue.fields?.status?.name,
          summary: issue.fields?.summary
        }))
      };
    } catch (err) {
      throw new Error(err.message || 'Failed to fetch JIRA data');
    }
  }, []);

  const fetchJIRAByUnit = useCallback(async (unitName) => {
    try {
      if (!window.electronAPI?.jira?.getMyIssues) {
        throw new Error('JIRA not connected');
      }

      const result = await window.electronAPI.jira.getMyIssues();
      
      // Filter by unit (similar to team)
      const filtered = result.issues?.filter(issue => {
        const labels = issue.fields?.labels || [];
        const components = issue.fields?.components || [];
        const unitLower = unitName.toLowerCase();
        
        return labels.some(label => label.toLowerCase().includes(unitLower)) ||
               components.some(comp => comp.name?.toLowerCase().includes(unitLower));
      }) || [];

      return {
        count: filtered.length,
        items: filtered.slice(0, 5).map(issue => ({
          key: issue.key,
          title: issue.fields?.summary,
          status: issue.fields?.status?.name,
          summary: issue.fields?.summary
        }))
      };
    } catch (err) {
      throw new Error(err.message || 'Failed to fetch JIRA data');
    }
  }, []);

  const fetchJIRAByPerson = useCallback(async (personName) => {
    try {
      if (!window.electronAPI?.jira?.getMyIssues) {
        throw new Error('JIRA not connected');
      }

      const result = await window.electronAPI.jira.getMyIssues();
      
      // Filter by assignee
      const filtered = result.issues?.filter(issue => {
        const assignee = issue.fields?.assignee?.displayName?.toLowerCase() || '';
        const reporter = issue.fields?.reporter?.displayName?.toLowerCase() || '';
        const personLower = personName.toLowerCase();
        
        return assignee.includes(personLower) || reporter.includes(personLower);
      }) || [];

      return {
        count: filtered.length,
        items: filtered.slice(0, 5).map(issue => ({
          key: issue.key,
          title: issue.fields?.summary,
          status: issue.fields?.status?.name,
          summary: issue.fields?.summary
        }))
      };
    } catch (err) {
      throw new Error(err.message || 'Failed to fetch JIRA data');
    }
  }, []);

  const fetchJIRAByFeature = useCallback(async (featureName) => {
    try {
      if (!window.electronAPI?.jira?.getMyIssues) {
        throw new Error('JIRA not connected');
      }

      const result = await window.electronAPI.jira.getMyIssues();
      
      // Filter by feature/epic
      const filtered = result.issues?.filter(issue => {
        const summary = issue.fields?.summary?.toLowerCase() || '';
        const epic = issue.fields?.epic?.name?.toLowerCase() || '';
        const featureLower = featureName.toLowerCase();
        
        return summary.includes(featureLower) || epic.includes(featureLower);
      }) || [];

      return {
        count: filtered.length,
        items: filtered.slice(0, 5).map(issue => ({
          key: issue.key,
          title: issue.fields?.summary,
          status: issue.fields?.status?.name,
          summary: issue.fields?.summary
        }))
      };
    } catch (err) {
      throw new Error(err.message || 'Failed to fetch JIRA data');
    }
  }, []);

  const fetchFeatureProgress = useCallback(async (repoName) => {
    try {
      if (!window.electronAPI?.codeIndexer?.getRepositoryStats) {
        throw new Error('Code indexer not available');
      }

      const stats = await window.electronAPI.codeIndexer.getRepositoryStats(repoName);
      
      return {
        count: stats.commits || 0,
        items: [
          { key: 'Commits', title: `${stats.commits || 0} commits`, status: 'tracked' },
          { key: 'PRs', title: `${stats.prs || 0} pull requests`, status: 'merged' },
          { key: 'Files', title: `${stats.files || 0} files changed`, status: 'modified' }
        ]
      };
    } catch (err) {
      throw new Error(err.message || 'Failed to fetch codebase data');
    }
  }, []);

  const fetchSlackMessages = useCallback(async (handle) => {
    try {
      if (!window.electronAPI?.slack?.getRecentMessages) {
        throw new Error('Slack not connected');
      }

      const result = await window.electronAPI.slack.getRecentMessages(50);
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch Slack messages');
      }

      const handleLower = handle.toLowerCase().replace('@', '');

      // Filter by handle (from user ID, real name, display name, or mentioning user)
      const filtered = result.messages.filter(msg => {
        const user = msg.user?.toLowerCase() || '';
        const userName = msg.user_name?.toLowerCase() || '';
        const realName = msg.user_real_name?.toLowerCase() || '';
        const displayName = msg.user_display_name?.toLowerCase() || '';
        const text = msg.text?.toLowerCase() || '';

        // Match by user ID, username, real name, display name, or @mention in text
        return user.includes(handleLower) ||
               userName.includes(handleLower) ||
               realName.includes(handleLower) ||
               displayName.includes(handleLower) ||
               text.includes(`@${handleLower}`);
      });

      return {
        count: filtered.length,
        items: filtered.slice(0, 5).map(msg => ({
          key: msg.id,
          title: `${msg.user_real_name || msg.user_display_name || msg.user}: ${msg.text?.substring(0, 40) || 'Message'}`,
          status: msg.type === 'mention' ? '@mention' : 'message',
          summary: msg.text
        }))
      };
    } catch (err) {
      throw new Error(err.message || 'Failed to fetch Slack messages');
    }
  }, []);

  const fetchTeamsMessages = useCallback(async (handle) => {
    try {
      if (!window.electronAPI?.teams?.getRecentMessages) {
        throw new Error('Teams not connected');
      }

      const result = await window.electronAPI.teams.getRecentMessages(50);
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch Teams messages');
      }

      const handleLower = handle.toLowerCase().replace('@', '');
      
      // Filter by handle
      const filtered = result.messages.filter(msg => {
        const user = msg.from?.toLowerCase() || '';
        const text = msg.body?.toLowerCase() || '';
        
        return user.includes(handleLower) || text.includes(`@${handleLower}`);
      });

      return {
        count: filtered.length,
        items: filtered.slice(0, 5).map(msg => ({
          key: msg.id,
          title: msg.body?.substring(0, 60) || 'Message',
          status: 'message',
          summary: msg.body
        }))
      };
    } catch (err) {
      throw new Error(err.message || 'Failed to fetch Teams messages');
    }
  }, []);

  const fetchEmailTracker = useCallback(async (email) => {
    try {
      if (!window.electronAPI?.inbox?.getUnified) {
        throw new Error('Email not connected');
      }

      const result = await window.electronAPI.inbox.getUnified({ 
        maxResults: 50,
        includeSources: ['google', 'microsoft']
      });
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch emails');
      }

      const emailLower = email.toLowerCase();
      
      // Filter by sender email
      const filtered = result.emails.filter(msg => {
        const from = msg.from?.emailAddress?.address?.toLowerCase() || 
                    msg.from?.toLowerCase() || '';
        
        return from.includes(emailLower);
      });

      return {
        count: filtered.length,
        items: filtered.slice(0, 5).map(msg => ({
          key: msg.id || msg.messageId,
          title: msg.subject || 'No subject',
          status: msg.isRead ? 'Read' : 'Unread',
          summary: msg.subject
        }))
      };
    } catch (err) {
      throw new Error(err.message || 'Failed to fetch emails');
    }
  }, []);

  const fetchData = useCallback(async () => {
    // Skip data fetch for quick-note
    if (!widget?.type || widget.type === 'quick-note') {
      setLoading(false);
      return;
    }

    // Skip if no configuration
    if (!widget.config || Object.keys(widget.config).length === 0) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      let result = null;

      switch (widget.type) {
        case 'jira-by-team':
          if (widget.config.team) {
            result = await fetchJIRAByTeam(widget.config.team);
          }
          break;
        case 'jira-by-unit':
          if (widget.config.unit) {
            result = await fetchJIRAByUnit(widget.config.unit);
          }
          break;
        case 'jira-by-person':
          if (widget.config.person) {
            result = await fetchJIRAByPerson(widget.config.person);
          }
          break;
        case 'jira-by-feature':
          if (widget.config.feature) {
            result = await fetchJIRAByFeature(widget.config.feature);
          }
          break;
        case 'feature-progress':
          if (widget.config.repo) {
            result = await fetchFeatureProgress(widget.config.repo);
          }
          break;
        case 'slack-messages':
          if (widget.config.handle) {
            result = await fetchSlackMessages(widget.config.handle);
          }
          break;
        case 'teams-messages':
          if (widget.config.handle) {
            result = await fetchTeamsMessages(widget.config.handle);
          }
          break;
        case 'email-tracker':
          if (widget.config.email) {
            result = await fetchEmailTracker(widget.config.email);
          }
          break;
        default:
          break;
      }

      setData(result);
    } catch (err) {
      setError(err.message || 'Failed to fetch data');
      console.error('Widget data fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [
    widget?.type, 
    widget?.config,
    fetchJIRAByTeam,
    fetchJIRAByUnit,
    fetchJIRAByPerson,
    fetchJIRAByFeature,
    fetchFeatureProgress,
    fetchSlackMessages,
    fetchTeamsMessages,
    fetchEmailTracker
  ]);

  // Initial fetch
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Auto-refresh every 60 seconds (1 minute)
  useEffect(() => {
    if (widget?.type && widget.type !== 'quick-note' && widget.config && Object.keys(widget.config).length > 0) {
      const interval = setInterval(fetchData, 60000); // 60 seconds
      return () => clearInterval(interval);
    }
  }, [widget?.type, widget?.config, fetchData]);

  const refresh = useCallback(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refresh };
}
