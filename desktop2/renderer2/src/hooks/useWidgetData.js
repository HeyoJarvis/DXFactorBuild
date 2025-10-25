import { useState, useEffect, useCallback } from 'react';

/**
 * useWidgetData - Fetches and manages real-time data for widgets
 * 
 * @param {Object} widget - Widget configuration with type and metadata
 * @returns {Object} { data, loading, error, refresh }
 */
export default function useWidgetData(widget) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchTrackerData = useCallback(async (source, target) => {
    const sourceLower = source.toLowerCase();
    
    try {
      switch (sourceLower) {
        case 'jira':
        case 'jira updates':
        case 'jira tickets':
          if (window.electronAPI?.jira?.getMyIssues) {
            const issues = await window.electronAPI.jira.getMyIssues();
            const filteredIssues = issues.filter(issue => 
              issue.fields?.summary?.toLowerCase().includes(target.toLowerCase()) ||
              issue.fields?.description?.toLowerCase().includes(target.toLowerCase())
            );
            
            return {
              count: filteredIssues.length,
              items: filteredIssues.slice(0, 5).map(issue => ({
                key: issue.key,
                summary: issue.fields?.summary,
                status: issue.fields?.status?.name,
                priority: issue.fields?.priority?.name,
                from: issue.fields?.reporter?.displayName
              })),
              lastUpdate: new Date().toISOString()
            };
          }
          break;

        case 'emails':
        case 'email':
        case 'inbox':
          if (window.electronAPI?.inbox?.getUnified) {
            const result = await window.electronAPI.inbox.getUnified({ 
              maxResults: 50,
              includeSources: ['google', 'microsoft']
            });
            
            if (result.success) {
              // Filter emails by target keyword or sender
              const filteredEmails = result.emails.filter(email => {
                const subject = email.subject?.toLowerCase() || '';
                const from = email.from?.emailAddress?.address?.toLowerCase() || 
                            email.from?.toLowerCase() || '';
                const fromName = email.from?.emailAddress?.name?.toLowerCase() ||
                               email.from_name?.toLowerCase() || '';
                const targetLower = target.toLowerCase();
                
                return subject.includes(targetLower) || 
                       from.includes(targetLower) || 
                       fromName.includes(targetLower);
              });
              
              return {
                count: filteredEmails.length,
                items: filteredEmails.slice(0, 5).map(email => ({
                  key: email.id || email.messageId,
                  summary: email.subject,
                  status: email.isRead ? 'Read' : 'Unread',
                  from: email.from?.emailAddress?.name || 
                        email.from_name || 
                        email.from?.emailAddress?.address || 
                        email.from || 
                        'Unknown'
                })),
                lastUpdate: new Date().toISOString()
              };
            }
          }
          break;

        case 'slack':
        case 'slack messages':
        case 'slack notifications':
        case 'slack mentions':
          if (window.electronAPI?.slack?.getRecentMessages) {
            console.log('🔍 Fetching Slack messages...');
            const result = await window.electronAPI.slack.getRecentMessages(50);
            
            console.log('📊 Slack API result:', result);
            
            if (result.success) {
              console.log(`📨 Got ${result.messages.length} Slack messages`);
              
              // Filter messages by target keyword or user
              const filteredMessages = result.messages.filter(message => {
                const text = message.text?.toLowerCase() || '';
                const user = message.user?.toLowerCase() || '';
                const targetLower = target.toLowerCase();
                
                // Special case: if target is 'mentions' or 'tags', show only mentions
                if (targetLower.includes('mention') || targetLower.includes('tag')) {
                  return message.type === 'mention';
                }
                
                return text.includes(targetLower) || user.includes(targetLower);
              });
              
              console.log(`✅ Filtered to ${filteredMessages.length} messages for "${target}"`);
              
              return {
                count: filteredMessages.length,
                items: filteredMessages.slice(0, 5).map(msg => ({
                  key: msg.id,
                  summary: msg.text?.substring(0, 100) || 'No text',
                  status: msg.type === 'mention' ? '@ Mention' : 'Message',
                  from: msg.user || 'Unknown',
                  timestamp: msg.timestamp
                })),
                lastUpdate: new Date().toISOString()
              };
            } else {
              console.error('❌ Slack fetch failed:', result.error);
              return {
                count: 0,
                items: [],
                lastUpdate: new Date().toISOString(),
                message: result.error || 'Slack not available'
              };
            }
          } else {
            console.warn('⚠️ Slack API not available');
            return {
              count: 0,
              items: [],
              lastUpdate: new Date().toISOString(),
              message: 'Slack API not found. Make sure Slack is connected.'
            };
          }
          break;

        case 'github':
          if (window.electronAPI?.codeIndexer?.listRepositories) {
            const repos = await window.electronAPI.codeIndexer.listRepositories();
            const filteredRepos = repos.filter(repo =>
              repo.name?.toLowerCase().includes(target.toLowerCase()) ||
              repo.description?.toLowerCase().includes(target.toLowerCase())
            );
            
            return {
              count: filteredRepos.length,
              items: filteredRepos.slice(0, 5).map(repo => ({
                name: repo.name,
                owner: repo.owner,
                url: repo.url,
                lastCommit: repo.lastCommit
              })),
              lastUpdate: new Date().toISOString()
            };
          }
          break;

        case 'tasks':
          if (window.electronAPI?.tasks?.getAll) {
            const tasks = await window.electronAPI.tasks.getAll();
            const filteredTasks = tasks.filter(task =>
              task.title?.toLowerCase().includes(target.toLowerCase()) ||
              task.description?.toLowerCase().includes(target.toLowerCase())
            );
            
            return {
              count: filteredTasks.length,
              items: filteredTasks.slice(0, 5).map(task => ({
                id: task.id,
                title: task.title,
                status: task.is_completed ? 'Done' : 'In Progress',
                priority: task.priority || 'Medium'
              })),
              lastUpdate: new Date().toISOString()
            };
          }
          break;

        default:
          // Try to handle as a generic source
          console.warn(`Unknown source: ${source}, attempting generic search`);
          return {
            count: 0,
            items: [],
            lastUpdate: new Date().toISOString(),
            message: `Source "${source}" not yet supported. Try: emails, jira, github, or tasks`
          };
      }
    } catch (err) {
      console.error(`Error fetching ${source} data:`, err);
      throw err;
    }
    
    return null;
  }, []);

  const fetchNotifierData = useCallback(async (topic) => {
    try {
      // Check multiple sources for notifications related to the topic
      const notifications = [];
      const topicLower = topic.toLowerCase();
      
      // Slack notifications
      if (window.electronAPI?.slack?.getRecentMessages) {
        try {
          const result = await window.electronAPI.slack.getRecentMessages(50);
          
          if (result.success) {
            const recentMessages = result.messages.filter(message => {
              const timestamp = new Date(message.timestamp);
              const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
              const text = message.text?.toLowerCase() || '';
              const user = message.user?.toLowerCase() || '';
              
              // Special handling for mentions
              if (topicLower.includes('mention') || topicLower.includes('tag')) {
                return timestamp > dayAgo && message.type === 'mention';
              }
              
              return timestamp > dayAgo && 
                     (text.includes(topicLower) || user.includes(topicLower));
            });
            
            notifications.push(...recentMessages.map(msg => ({
              id: msg.id,
              title: msg.text?.substring(0, 80) || 'No text',
              source: msg.type === 'mention' ? 'Slack @' : 'Slack',
              timestamp: msg.timestamp,
              type: 'message',
              from: msg.user
            })));
          }
        } catch (err) {
          console.warn('Failed to fetch Slack notifications:', err);
        }
      }
      
      // Email notifications
      if (window.electronAPI?.inbox?.getUnified) {
        try {
          const result = await window.electronAPI.inbox.getUnified({ 
            maxResults: 50,
            includeSources: ['google', 'microsoft']
          });
          
          if (result.success) {
            const recentEmails = result.emails.filter(email => {
              const date = new Date(email.receivedDateTime || email.date);
              const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
              const subject = email.subject?.toLowerCase() || '';
              const from = email.from?.emailAddress?.name?.toLowerCase() || 
                          email.from_name?.toLowerCase() || '';
              
              return date > dayAgo && 
                     (subject.includes(topicLower) || from.includes(topicLower));
            });
            
            notifications.push(...recentEmails.map(email => ({
              id: email.id || email.messageId,
              title: email.subject || 'No subject',
              source: email.source === 'google' ? 'Gmail' : 'Outlook',
              timestamp: email.receivedDateTime || email.date,
              type: 'email',
              from: email.from?.emailAddress?.name || email.from_name || 'Unknown'
            })));
          }
        } catch (err) {
          console.warn('Failed to fetch email notifications:', err);
        }
      }
      
      // JIRA notifications
      if (window.electronAPI?.jira?.getMyIssues) {
        try {
          const issues = await window.electronAPI.jira.getMyIssues();
          const recentIssues = issues.filter(issue => {
            const updated = new Date(issue.fields?.updated || issue.fields?.created);
            const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
            return updated > dayAgo && 
                   (issue.fields?.summary?.toLowerCase().includes(topicLower) ||
                    issue.fields?.description?.toLowerCase().includes(topicLower) ||
                    issue.fields?.status?.name?.toLowerCase().includes(topicLower));
          });
          
          notifications.push(...recentIssues.map(issue => ({
            id: issue.key,
            title: issue.fields?.summary,
            source: 'JIRA',
            timestamp: issue.fields?.updated || issue.fields?.created,
            type: 'issue',
            status: issue.fields?.status?.name
          })));
        } catch (err) {
          console.warn('Failed to fetch JIRA notifications:', err);
        }
      }

      // Tasks notifications
      if (window.electronAPI?.tasks?.getAll) {
        try {
          const tasks = await window.electronAPI.tasks.getAll();
          const recentTasks = tasks.filter(task => {
            const created = new Date(task.created_at);
            const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
            return created > dayAgo && 
                   (task.title?.toLowerCase().includes(topicLower) ||
                    task.description?.toLowerCase().includes(topicLower));
          });
          
          notifications.push(...recentTasks.map(task => ({
            id: task.id,
            title: task.title,
            source: 'Tasks',
            timestamp: task.created_at,
            type: 'task'
          })));
        } catch (err) {
          console.warn('Failed to fetch task notifications:', err);
        }
      }

      // Sort by timestamp (newest first)
      notifications.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

      return {
        count: notifications.length,
        items: notifications.slice(0, 10),
        lastUpdate: new Date().toISOString()
      };
    } catch (err) {
      console.error('Error fetching notifications:', err);
      throw err;
    }
  }, []);

  const fetchData = useCallback(async () => {
    if (!widget?.type || widget.type === 'note') {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      let result = null;

      if (widget.type === 'tracker' && widget.metadata?.source && widget.metadata?.target) {
        result = await fetchTrackerData(widget.metadata.source, widget.metadata.target);
      } else if (widget.type === 'notifier' && widget.metadata?.topic) {
        result = await fetchNotifierData(widget.metadata.topic);
      }

      setData(result);
    } catch (err) {
      setError(err.message || 'Failed to fetch data');
      console.error('Widget data fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [widget?.type, widget?.metadata?.source, widget?.metadata?.target, widget?.metadata?.topic, fetchTrackerData, fetchNotifierData]);

  // Initial fetch
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Auto-refresh every 30 seconds for tracker/notifier widgets
  useEffect(() => {
    if (widget?.type === 'tracker' || widget?.type === 'notifier') {
      const interval = setInterval(fetchData, 30000);
      return () => clearInterval(interval);
    }
  }, [widget?.type, fetchData]);

  const refresh = useCallback(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refresh };
}

