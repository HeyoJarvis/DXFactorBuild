/**
 * useSystemStatus Hook
 * Monitors system and service status
 */

import { useState, useEffect, useCallback } from 'react';

export function useSystemStatus() {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  /**
   * Fetch current system status
   */
  const fetchStatus = useCallback(async () => {
    try {
      const response = await window.electronAPI.system.getStatus();

      if (response.success) {
        setStatus(response.data);
        setError(null);
      } else {
        throw new Error(response.error || 'Failed to get status');
      }
    } catch (err) {
      console.error('System status error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch status on mount
  useEffect(() => {
    fetchStatus();

    // Poll for status updates every 30 seconds
    const interval = setInterval(fetchStatus, 30000);

    return () => clearInterval(interval);
  }, [fetchStatus]);

  return {
    status,
    loading,
    error,
    refresh: fetchStatus
  };
}

