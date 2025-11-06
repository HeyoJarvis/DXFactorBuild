/**
 * useSalesTasks Hook
 * Manages sales tasks via Electron IPC with route filtering
 */

import { useState, useEffect, useCallback } from 'react';

export function useSalesTasks(user, assignmentView = 'all') {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [jiraView, setJiraView] = useState(false);
  const [jiraConnected, setJiraConnected] = useState(false);

  /**
   * Check JIRA connection status
   */
  const checkJiraConnection = useCallback(async () => {
    try {
      if (!window.electronAPI?.jira?.checkConnection) {
        setJiraConnected(false);
        return;
      }
      const response = await window.electronAPI.jira.checkConnection();
      setJiraConnected(response.connected || false);
    } catch (error) {
      console.error('Failed to check JIRA connection:', error);
      setJiraConnected(false);
    }
  }, []);

  /**
   * Load developer JIRA tasks from the user's team
   */
  const loadTeamDevTasks = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Fetch developer tasks (route_to: 'tasks-developer') with JIRA source
      const filters = {
        routeTo: 'tasks-developer', // Get developer tasks, not sales tasks
        externalSource: 'jira', // Only JIRA tasks
        teamId: user?.team_id, // Filter by user's team
        filterByTeam: true // Enable team filtering
      };

      const response = await window.electronAPI.tasks.getAll(filters);

      if (response.success) {
        console.log('👥 Team developer JIRA tasks loaded:', {
          count: response.tasks?.length || 0,
          teamId: user?.team_id,
          tasks: response.tasks
        });
        setTasks(response.tasks || []);
      } else {
        throw new Error(response.error || 'Failed to load team developer tasks');
      }
    } catch (err) {
      console.error('Load team dev tasks error:', err);
      setError(err.message);
      setTasks([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  /**
   * Load sales tasks only (route_to: 'tasks-sales')
   * Filtered by user role and assignment
   */
  const loadRegularTasks = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const filters = {
        routeTo: 'tasks-sales',
        userRole: user?.user_role || 'sales',
        slackUserId: user?.slack_user_id
      };

      // Add assignment view filter if specified
      if (assignmentView && assignmentView !== 'all') {
        filters.assignmentView = assignmentView;
      }

      const response = await window.electronAPI.tasks.getAll(filters);

      if (response.success) {
        console.log('📋 Sales tasks loaded:', {
          count: response.tasks?.length || 0,
          userRole: filters.userRole,
          slackUserId: filters.slackUserId,
          assignmentView: assignmentView,
          tasks: response.tasks
        });
        setTasks(response.tasks || []);
      } else {
        throw new Error(response.error || 'Failed to load sales tasks');
      }
    } catch (err) {
      console.error('Load sales tasks error:', err);
      setError(err.message);
      setTasks([]); // Set empty array on error
    } finally {
      setLoading(false);
    }
  }, [user, assignmentView]);

  /**
   * Load tasks based on current view (regular or team dev)
   */
  const loadTasks = useCallback(async () => {
    console.log('🔄 loadTasks called', { jiraView, userTeamId: user?.team_id });
    if (jiraView) {
      console.log('📋 Loading team dev tasks (JIRA filtering enabled)');
      return loadTeamDevTasks();
    } else {
      console.log('📋 Loading regular sales tasks');
      return loadRegularTasks();
    }
  }, [jiraView, loadTeamDevTasks, loadRegularTasks, user]);

  /**
   * Create a new sales task
   */
  const addTask = useCallback(async (taskData) => {
    try {
      const response = await window.electronAPI.tasks.create({
        ...taskData,
        routeTo: 'tasks-sales',
        workType: taskData.workType || 'task'
      });

      if (response.success) {
        // Reload tasks to get fresh data from backend
        await loadTasks();
        return response.data;
      } else {
        throw new Error(response.error || 'Failed to create task');
      }
    } catch (err) {
      console.error('Add sales task error:', err);
      setError(err.message);
      throw err;
    }
  }, [loadTasks]);

  /**
   * Update a task
   */
  const updateTask = useCallback(async (taskId, updates) => {
    try {
      const response = await window.electronAPI.tasks.update({ taskId, updates });

      if (response.success) {
        // Reload tasks to get fresh data from backend
        await loadTasks();
        return response.data;
      } else {
        throw new Error(response.error || 'Failed to update task');
      }
    } catch (err) {
      console.error('Update task error:', err);
      setError(err.message);
      throw err;
    }
  }, [loadTasks]);

  /**
   * Delete a task
   */
  const deleteTask = useCallback(async (taskId) => {
    try {
      const response = await window.electronAPI.tasks.delete(taskId);

      if (response.success) {
        // Reload tasks to get fresh data from backend
        await loadTasks();
      } else {
        throw new Error(response.error || 'Failed to delete task');
      }
    } catch (err) {
      console.error('Delete task error:', err);
      setError(err.message);
      throw err;
    }
  }, [loadTasks]);

  /**
   * Toggle task status
   */
  const toggleTask = useCallback(async (taskId, currentStatus) => {
    const newStatus = currentStatus === 'completed' ? 'todo' : 
                     currentStatus === 'todo' ? 'in_progress' :
                     'completed';

    return updateTask(taskId, { status: newStatus });
  }, [updateTask]);

  /**
   * Link a task to a JIRA issue
   */
  const linkToJira = useCallback(async (taskId, jiraKey) => {
    try {
      if (!window.electronAPI?.jira?.getIssue) {
        throw new Error('JIRA integration not available');
      }

      console.log('🔗 Linking task to JIRA:', { taskId, jiraKey });

      // Fetch JIRA issue details
      const jiraResponse = await window.electronAPI.jira.getIssue(jiraKey);
      
      if (!jiraResponse.success) {
        throw new Error(jiraResponse.error || 'Failed to fetch JIRA issue');
      }

      const issue = jiraResponse.issue;

      // Update task with JIRA metadata
      const updates = {
        externalId: `jira_${issue.id}`,
        externalKey: issue.key,
        externalUrl: issue.url || `https://your-domain.atlassian.net/browse/${issue.key}`,
        externalSource: 'jira',
        jira_status: issue.status?.name || issue.fields?.status?.name,
        jira_issue_type: issue.issue_type?.name || issue.fields?.issuetype?.name,
        jira_priority: issue.priority?.name || issue.fields?.priority?.name,
        story_points: issue.story_points || issue.fields?.customfield_10016,
        sprint: issue.sprint || issue.fields?.sprint?.name,
        labels: issue.labels || issue.fields?.labels || []
      };

      await updateTask(taskId, updates);
      
      console.log('✅ Task linked to JIRA successfully');
      return { success: true };
    } catch (error) {
      console.error('Failed to link to JIRA:', error);
      throw error;
    }
  }, [updateTask]);

  /**
   * Unlink a task from JIRA
   */
  const unlinkFromJira = useCallback(async (taskId) => {
    try {
      await updateTask(taskId, {
        externalId: null,
        externalKey: null,
        externalUrl: null,
        externalSource: null,
        jira_status: null,
        jira_issue_type: null,
        jira_priority: null
      });
      console.log('✅ Task unlinked from JIRA');
    } catch (error) {
      console.error('Failed to unlink from JIRA:', error);
      throw error;
    }
  }, [updateTask]);

  /**
   * Monitor a developer's JIRA task (create a linked copy for sales user)
   */
  const monitorTask = useCallback(async (developerTask) => {
    try {
      console.log('👀 Monitoring developer task:', developerTask);

      // Create a new task for the sales user that references the original
      const monitoredTask = {
        title: `[Monitoring] ${developerTask.title || developerTask.session_title}`,
        description: developerTask.description || `Monitoring ${developerTask.externalKey || 'developer task'}`,
        priority: developerTask.priority || developerTask.workflow_metadata?.priority || 'medium',
        routeTo: 'tasks-sales',
        workType: 'task',
        externalId: developerTask.externalId,
        externalKey: developerTask.externalKey,
        externalUrl: developerTask.externalUrl,
        externalSource: developerTask.externalSource || 'jira',
        jira_status: developerTask.jira_status,
        jira_issue_type: developerTask.jira_issue_type,
        jira_priority: developerTask.jira_priority,
        story_points: developerTask.story_points,
        sprint: developerTask.sprint,
        labels: [...(developerTask.labels || []), 'monitored'],
        workflow_metadata: {
          ...(developerTask.workflow_metadata || {}),
          monitored: true,
          originalTaskId: developerTask.id,
          monitoredAt: new Date().toISOString()
        }
      };

      await addTask(monitoredTask);
      console.log('✅ Task monitoring enabled');
      return { success: true };
    } catch (error) {
      console.error('Failed to monitor task:', error);
      throw error;
    }
  }, [addTask]);

  /**
   * Stop monitoring a task
   */
  const unmonitorTask = useCallback(async (taskId) => {
    try {
      await deleteTask(taskId);
      console.log('✅ Stopped monitoring task');
    } catch (error) {
      console.error('Failed to unmonitor task:', error);
      throw error;
    }
  }, [deleteTask]);

  /**
   * Get task statistics
   */
  const getStats = useCallback(() => {
    return {
      total: tasks.length,
      todo: tasks.filter(t => t.status === 'todo').length,
      inProgress: tasks.filter(t => t.status === 'in_progress').length,
      completed: tasks.filter(t => t.status === 'completed').length
    };
  }, [tasks]);

  // Reload tasks when jiraView changes
  useEffect(() => {
    console.log('👁️ jiraView changed:', jiraView);
    loadTasks();
  }, [jiraView, loadTasks]);

  // Load tasks on mount and set up auto-refresh
  useEffect(() => {
    checkJiraConnection();
    
    // Listen for task created events from main process
    let taskCreatedCleanup;
    if (window.electronAPI?.onTaskCreated) {
      taskCreatedCleanup = window.electronAPI.onTaskCreated(() => {
        console.log('🔔 Task created event received, refreshing sales tasks');
        // Auto-refresh tasks when new task is created from Slack
        loadTasks();
      });
    }
    
    // Set up periodic refresh every 30 seconds to catch external changes
    const refreshInterval = setInterval(() => {
      console.log('🔄 Auto-refreshing sales tasks (periodic)');
      loadTasks();
    }, 30000); // 30 seconds
    
    return () => {
      if (taskCreatedCleanup) taskCreatedCleanup();
      clearInterval(refreshInterval);
    };
  }, [loadTasks, checkJiraConnection]);

  return {
    tasks,
    loading,
    error,
    jiraView,
    setJiraView,
    jiraConnected,
    addTask,
    updateTask,
    deleteTask,
    toggleTask,
    linkToJira,
    unlinkFromJira,
    monitorTask,
    unmonitorTask,
    refreshTasks: loadTasks,
    stats: getStats()
  };
}

