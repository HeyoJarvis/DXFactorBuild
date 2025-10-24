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

      // TODO: Replace with actual API call when backend is ready
      // const response = await fetch(`/api/users/${userId}/metrics?days=${days}`);
      // const data = await response.json();

      // Mock data for now - replace with real API call
      const mockData = generateMockMetrics(userId, days);
      
      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 500));
      
      setMetrics(mockData);
    } catch (err) {
      console.error('Failed to fetch dashboard metrics:', err);
      setError(err.message);
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
 * Generate mock metrics data
 * TODO: Remove this when real backend API is ready
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

