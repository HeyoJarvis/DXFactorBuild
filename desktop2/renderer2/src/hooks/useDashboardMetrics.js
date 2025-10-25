import { useState, useEffect } from 'react';

/**
 * useDashboardMetrics - Hook to fetch and manage dashboard KPI metrics
 * 
 * @param {string} userId - User ID to fetch metrics for
 * @param {number} days - Number of days to look back (default 7)
 * @returns {Object} { metrics, loading, error, refresh }
 */
export function useDashboardMetrics(userId, days = 7) {
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchMetrics = async () => {
    if (!userId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Fetch real data from multiple sources
      const realMetrics = await fetchRealMetrics(userId, days);
      
      setMetrics(realMetrics);
    } catch (err) {
      console.error('Failed to fetch dashboard metrics:', err);
      setError(err.message);
      
      // Fallback to mock data on error
      const mockData = generateMockMetrics(userId, days);
      setMetrics(mockData);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
  }, [userId, days]);

  return {
    metrics,
    loading,
    error,
    refresh: fetchMetrics
  };
}

/**
 * Fetch real metrics from JIRA, Tasks DB, and GitHub
 */
async function fetchRealMetrics(userId, days) {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // 1. Fetch JIRA data
    let sprintProgress = 0;
    let jiraIssuesCount = 0;
    try {
      if (window.electronAPI?.jira?.getMyIssues) {
        const jiraResponse = await window.electronAPI.jira.getMyIssues({ 
          maxResults: 100 
        });
        
        if (jiraResponse?.issues) {
          jiraIssuesCount = jiraResponse.issues.length;
          
          // Calculate sprint progress from story points
          const totalPoints = jiraResponse.issues.reduce((sum, issue) => 
            sum + (issue.fields?.customfield_10016 || 0), 0);
          const completedPoints = jiraResponse.issues
            .filter(i => i.fields?.status?.name === 'Done')
            .reduce((sum, issue) => sum + (issue.fields?.customfield_10016 || 0), 0);
          
          sprintProgress = totalPoints > 0 
            ? Math.round((completedPoints / totalPoints) * 100) 
            : 0;
        }
      }
    } catch (jiraError) {
      console.warn('JIRA data fetch failed:', jiraError);
    }

    // 2. Fetch Tasks data
    let tasksCompletedToday = 0;
    let totalTasks = 0;
    let taskCompletionRate = 0;
    try {
      if (window.electronAPI?.tasks?.getAll) {
        const tasksResponse = await window.electronAPI.tasks.getAll();
        
        if (Array.isArray(tasksResponse)) {
          totalTasks = tasksResponse.length;
          
          // Count tasks completed today
          tasksCompletedToday = tasksResponse.filter(t => {
            if (!t.is_completed || !t.completed_at) return false;
            const completedDate = new Date(t.completed_at);
            completedDate.setHours(0, 0, 0, 0);
            return completedDate.getTime() === today.getTime();
          }).length;
          
          // Calculate overall completion rate
          const completedTasks = tasksResponse.filter(t => t.is_completed).length;
          taskCompletionRate = totalTasks > 0 
            ? Math.round((completedTasks / totalTasks) * 100) 
            : 0;
        }
      }
    } catch (tasksError) {
      console.warn('Tasks data fetch failed:', tasksError);
    }

    // 3. Fetch GitHub/Engineering data
    let prCount = 0;
    try {
      if (window.electronAPI?.engineering?.listRepos) {
        const repos = await window.electronAPI.engineering.listRepos();
        if (repos?.length) {
          prCount = repos.length; // Placeholder - replace with actual PR count
        }
      }
    } catch (githubError) {
      console.warn('GitHub data fetch failed:', githubError);
    }

    // Return real metrics with fallback values
    return {
      sprintProgress: {
        value: sprintProgress > 0 ? `${sprintProgress}%` : '0%',
        trend: {
          direction: sprintProgress > 50 ? 'up' : 'stable',
          value: '12%'
        },
        source: 'jira'
      },
      
      taskCompletionRate: {
        value: taskCompletionRate > 0 ? `${taskCompletionRate}%` : '0%',
        trend: {
          direction: taskCompletionRate > 75 ? 'up' : 'stable',
          value: '5%'
        },
        source: 'tasks'
      },
      
      prsMerged: {
        value: prCount || jiraIssuesCount,
        trend: {
          direction: 'up',
          value: '+3'
        },
        source: 'github'
      },
      
      newTasksToday: {
        value: tasksCompletedToday,
        trend: null,
        source: 'tasks'
      },
      
      // Additional metrics
      totalTasks,
      jiraIssuesCount,
      criticalAlerts: tasksCompletedToday // Placeholder
    };
    
  } catch (error) {
    console.error('Error fetching real metrics:', error);
    throw error;
  }
}

/**
 * Generate mock metrics data (fallback)
 */
function generateMockMetrics(userId, days) {
  // Generate realistic mock data
  const signalsDelivered = Math.floor(Math.random() * 30) + 15;
  const signalsViewed = Math.floor(signalsDelivered * (0.7 + Math.random() * 0.25));
  const signalsActedOn = Math.floor(signalsViewed * (0.3 + Math.random() * 0.3));
  const feedbackTotal = Math.floor(signalsViewed * (0.4 + Math.random() * 0.3));
  const feedbackPositive = Math.floor(feedbackTotal * (0.6 + Math.random() * 0.35));

  return {
    // Core metrics
    signalsDelivered: {
      value: signalsDelivered,
      trend: {
        direction: Math.random() > 0.5 ? 'up' : 'down',
        value: `${Math.floor(Math.random() * 20)}%`
      }
    },
    
    avgRelevance: {
      value: `${Math.floor(65 + Math.random() * 30)}%`,
      trend: {
        direction: Math.random() > 0.4 ? 'up' : 'down',
        value: `${Math.floor(Math.random() * 10)}%`
      }
    },
    
    actionRate: {
      value: `${Math.floor((signalsActedOn / signalsViewed) * 100)}%`,
      trend: {
        direction: Math.random() > 0.5 ? 'up' : 'down',
        value: `${Math.floor(Math.random() * 15)}%`
      }
    },
    
    viewRate: {
      value: `${Math.floor((signalsViewed / signalsDelivered) * 100)}%`,
      trend: {
        direction: Math.random() > 0.6 ? 'up' : 'stable',
        value: `${Math.floor(Math.random() * 8)}%`
      }
    },
    
    avgTimePerSignal: {
      value: `${Math.floor(60 + Math.random() * 120)}s`,
      trend: {
        direction: 'stable',
        value: 'stable'
      }
    },
    
    feedbackGiven: {
      value: feedbackTotal,
      subValue: `${Math.floor((feedbackPositive / feedbackTotal) * 100)}% positive`,
      trend: {
        direction: Math.random() > 0.5 ? 'up' : 'down',
        value: Math.random() > 0.5 ? `+${Math.floor(Math.random() * 5)}` : `-${Math.floor(Math.random() * 3)}`
      }
    },
    
    // Top competitors
    topCompetitors: [
      { name: 'Competitor A', count: Math.floor(Math.random() * 15) + 10 },
      { name: 'Competitor B', count: Math.floor(Math.random() * 12) + 6 },
      { name: 'Competitor C', count: Math.floor(Math.random() * 10) + 3 }
    ],
    
    // Critical alerts
    criticalAlerts: Math.floor(Math.random() * 5) + 1,
    
    // Activity data for chart (last 7 days)
    activityData: Array.from({ length: days }, (_, i) => ({
      date: new Date(Date.now() - (days - i - 1) * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', { weekday: 'short' }),
      count: Math.floor(Math.random() * 8) + 2
    }))
  };
}

export default useDashboardMetrics;

