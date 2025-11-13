import { useState, useEffect, useCallback } from 'react';

/**
 * Custom hook for calculating JIRA KPIs
 * 
 * Calculates:
 * - Completion Rate (%)
 * - Sprint Completion (% based on story points)
 * - Overdue Count
 * - Blocked Count
 * - High-Priority Open Count
 * - Health Score (0-100)
 */
export function useJiraKPIs(userId) {
  const [kpis, setKpis] = useState({
    completionRate: 0,
    sprintCompletion: 0,
    overdueCount: 0,
    blockedCount: 0,
    highPriorityOpen: 0,
    healthScore: 0,
    totalTasks: 0,
    completedTasks: 0,
    inProgressTasks: 0,
    todoTasks: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const calculateKPIs = useCallback(async () => {
    console.log('🚀 calculateKPIs CALLED with userId:', userId);
    
    try {
      setLoading(true);
      
      // Fetch ALL user tasks INCLUDING COMPLETED ONES for KPI calculation
      console.log('📊 KPI Hook - Fetching tasks for userId:', userId);
      const response = await window.electronAPI.tasks.getAll({ 
        userId,
        includeCompleted: true,     // ✅ CRITICAL: Include completed tasks for KPI calculation
        skipAllFilters: true,       // ✅ Skip team AND assignment filtering for KPI calculation
        externalSource: 'jira'      // ✅ Only get JIRA tasks for JIRA KPIs
      });
      console.log('📊 KPI Hook - Raw response:', response);
      
      // Handle response format (response.success with response.tasks array)
      if (!response || !response.success) {
        console.error('📊 KPI Hook - Failed to fetch tasks:', response);
        setKpis({
          completionRate: 0,
          sprintCompletion: 0,
          overdueCount: 0,
          blockedCount: 0,
          highPriorityOpen: 0,
          healthScore: 100,
          totalTasks: 0,
          completedTasks: 0,
          inProgressTasks: 0,
          todoTasks: 0
        });
        setLoading(false);
        return;
      }
      
      const tasks = response.tasks || [];
      console.log('📊 KPI Hook - Parsed tasks:', tasks.length, 'tasks');
      if (tasks.length > 0) {
        console.log('📊 KPI Hook - First task:', tasks[0]);
      }
      
      if (tasks.length === 0) {
        setKpis({
          completionRate: 0,
          sprintCompletion: 0,
          overdueCount: 0,
          blockedCount: 0,
          highPriorityOpen: 0,
          healthScore: 100,
          totalTasks: 0,
          completedTasks: 0,
          inProgressTasks: 0,
          todoTasks: 0
        });
        setLoading(false);
        return;
      }

      const now = new Date();
      
      // Filter JIRA tasks only (match usePMTasks.js pattern exactly)
      const jiraTasks = tasks.filter(t => 
        t.external_source === 'jira' || t.externalSource === 'jira'
      );
      console.log('📊 KPI Hook - Filtered JIRA tasks:', jiraTasks.length, 'out of', tasks.length);
      
      // Debug: Check what fields the first JIRA task has
      if (jiraTasks.length > 0) {
        console.log('📊 KPI Hook - First JIRA task sample:', {
          title: jiraTasks[0].title,
          jira_status: jiraTasks[0].jira_status,
          is_completed: jiraTasks[0].is_completed,
          status: jiraTasks[0].status,
          story_points: jiraTasks[0].story_points,
          priority: jiraTasks[0].priority,
          jira_priority: jiraTasks[0].jira_priority,
          due_date: jiraTasks[0].due_date,
          labels: jiraTasks[0].labels,
          epic_key: jiraTasks[0].epic_key
        });
        
      // Count completed vs in-progress vs todo
      const statusBreakdown = {
        completed: jiraTasks.filter(t => t.is_completed || t.status === 'completed').length,
        inProgress: jiraTasks.filter(t => !t.is_completed && t.jira_status === 'In Progress').length,
        todo: jiraTasks.filter(t => !t.is_completed && t.jira_status !== 'In Progress').length
      };
      console.log('📊 KPI Hook - Status breakdown:', statusBreakdown);
      
      // Log ALL unique JIRA statuses to see what we're dealing with
      const uniqueStatuses = [...new Set(jiraTasks.map(t => t.jira_status))];
      console.log('🔍 ALL JIRA STATUSES IN YOUR TASKS:', uniqueStatuses);
      
      // Log each task with its status
      console.log('📋 ALL TASKS WITH STATUSES:');
      jiraTasks.forEach(t => {
        console.log(`  - "${t.title.substring(0, 50)}..." → jira_status: "${t.jira_status}", is_completed: ${t.is_completed}`);
      });
        
        // Count story points
        const pointsBreakdown = {
          total: jiraTasks.reduce((sum, t) => sum + (t.story_points || 0), 0),
          completed: jiraTasks.filter(t => t.is_completed).reduce((sum, t) => sum + (t.story_points || 0), 0)
        };
        console.log('📊 KPI Hook - Story points breakdown:', pointsBreakdown);
      }
      
      const totalTasks = jiraTasks.length;
      
      // Completion metrics (fields are now at top level)
      const completedTasksList = jiraTasks.filter(t => {
        const jiraStatus = t.jira_status;
        // Check multiple completion indicators:
        // 1. is_completed flag (set by sync)
        // 2. status field === 'completed'
        // 3. JIRA status indicates completion (case-insensitive check)
        const jiraStatusLower = jiraStatus ? jiraStatus.toLowerCase().trim() : '';
        const isJiraCompleted = ['done', 'resolved', 'closed', 'completed'].includes(jiraStatusLower);
        const isCompleted = t.is_completed || 
               t.status === 'completed' || 
               isJiraCompleted;
        
        console.log('🔍 Completion check:', {
          title: t.title,
          is_completed: t.is_completed,
          status: t.status,
          jira_status: jiraStatus,
          jira_status_lower: jiraStatusLower,
          isJiraCompleted,
          result: isCompleted
        });
        
        return isCompleted;
      });
      
      const completedTasks = completedTasksList.length;
      console.log('✅ Completed tasks:', completedTasks, '/', totalTasks, completedTasksList.map(t => t.title));
      
      const inProgressTasks = jiraTasks.filter(t => {
        const jiraStatus = t.jira_status;
        return !t.is_completed &&
               (t.status === 'in_progress' || jiraStatus === 'In Progress');
      }).length;
      
      const todoTasks = jiraTasks.filter(t => {
        const jiraStatus = t.jira_status;
        return !t.is_completed &&
               t.status !== 'in_progress' &&
               jiraStatus !== 'In Progress';
      }).length;
      
      const completionRate = totalTasks > 0 
        ? Math.round((completedTasks / totalTasks) * 100) 
        : 0;
      
      console.log('📊 Completion Rate Calculation:', {
        completedTasks,
        totalTasks,
        completionRate: completionRate + '%'
      });

      // Sprint completion (based on story points - fields are now at top level)
      const totalPoints = jiraTasks.reduce((sum, t) => {
        const points = t.story_points || 0;
        console.log('  📊 Task story points:', t.title, '=', points);
        return sum + points;
      }, 0);
      
      // Use same completion logic for story points
      const completedPointsTasks = jiraTasks.filter(t => {
        const jiraStatus = t.jira_status;
        const jiraStatusLower = jiraStatus ? jiraStatus.toLowerCase().trim() : '';
        const isJiraCompleted = ['done', 'resolved', 'closed', 'completed'].includes(jiraStatusLower);
        return t.is_completed || t.status === 'completed' || isJiraCompleted;
      });
      const completedPoints = completedPointsTasks.reduce((sum, t) => {
        const points = t.story_points || 0;
        return sum + points;
      }, 0);
      
      console.log('📊 Sprint Points Calculation:', {
        totalPoints,
        completedPoints,
        completedPointsTasks: completedPointsTasks.length,
        sprintCompletion: totalPoints > 0 ? Math.round((completedPoints / totalPoints) * 100) : 0
      });
      
      const sprintCompletion = totalPoints > 0 
        ? Math.round((completedPoints / totalPoints) * 100) 
        : 0;

      // Overdue tasks (tasks with due_date in the past and not completed)
      const overdueTasks = jiraTasks.filter(t => {
        // Use same completion logic as above
        const jiraStatus = t.jira_status;
        const jiraStatusLower = jiraStatus ? jiraStatus.toLowerCase().trim() : '';
        const isJiraCompleted = ['done', 'resolved', 'closed', 'completed'].includes(jiraStatusLower);
        const isCompleted = t.is_completed || t.status === 'completed' || isJiraCompleted;
        const dueDate = t.due_date;
        
        console.log('🔍 Checking overdue for task:', {
          title: t.title,
          due_date: dueDate,
          is_completed: isCompleted,
          status: t.status,
          jira_status: t.jira_status
        });
        
        if (isCompleted) {
          console.log('  ❌ Skipped - task is completed');
          return false;
        }
        
        if (!dueDate) {
          console.log('  ❌ Skipped - no due date');
          return false;
        }
        
        try {
          const dueDateObj = new Date(dueDate);
          const isOverdue = dueDateObj < now;
          console.log('  📅 Due date check:', {
            dueDate: dueDateObj.toISOString(),
            now: now.toISOString(),
            isOverdue
          });
          return isOverdue;
        } catch (e) {
          console.log('  ❌ Skipped - invalid date format:', e.message);
          return false;
        }
      });
      
      const overdueCount = overdueTasks.length;
      console.log('⚠️ Total overdue tasks found:', overdueCount, overdueTasks.map(t => t.title));

      // Blocked tasks (check status or labels - fields are now at top level)
      const blockedCount = jiraTasks.filter(t => {
        // Use same completion logic
        const jiraStatus = t.jira_status;
        const jiraStatusLower = jiraStatus ? jiraStatus.toLowerCase().trim() : '';
        const isJiraCompleted = ['done', 'resolved', 'closed', 'completed'].includes(jiraStatusLower);
        const isCompleted = t.is_completed || t.status === 'completed' || isJiraCompleted;
        
        if (isCompleted) return false;
        
        const status = jiraStatusLower;
        const labels = t.labels || [];
        return status.includes('blocked') || 
               status.includes('impediment') ||
               labels.some(l => l.toLowerCase().includes('blocked') || l.toLowerCase().includes('impediment'));
      }).length;

      // High-priority open tasks (fields are now at top level)
      const highPriorityTasks = jiraTasks.filter(t => {
        // Use same completion logic
        const jiraStatus = t.jira_status;
        const jiraStatusLower = jiraStatus ? jiraStatus.toLowerCase().trim() : '';
        const isJiraCompleted = ['done', 'resolved', 'closed', 'completed'].includes(jiraStatusLower);
        const isCompleted = t.is_completed || t.status === 'completed' || isJiraCompleted;
        const priority = (t.priority || t.jira_priority || '').toLowerCase();
        
        console.log('🔍 Checking priority for task:', {
          title: t.title,
          priority: t.priority,
          jira_priority: t.jira_priority,
          combined_priority: priority,
          is_completed: isCompleted,
          status: t.status,
          jira_status: t.jira_status
        });
        
        if (isCompleted) {
          console.log('  ❌ Skipped - task is completed');
          return false;
        }
        
        const isHighPriority = priority === 'high' || priority === 'urgent' || priority === 'highest' || priority === 'critical';
        console.log('  🎯 Priority check result:', isHighPriority);
        
        return isHighPriority;
      });
      
      const highPriorityOpen = highPriorityTasks.length;
      console.log('🔥 Total high-priority tasks found:', highPriorityOpen, highPriorityTasks.map(t => ({
        title: t.title,
        priority: t.priority,
        jira_priority: t.jira_priority
      })));

      // Health Score (0-100)
      // Factors: completion rate, overdue, blocked, high-priority
      let healthScore = 100;
      
      // Deduct for low completion rate (max 30 points)
      healthScore -= (100 - completionRate) * 0.3;
      
      // Deduct for overdue tasks (5 points per overdue task, max 25 points)
      healthScore -= Math.min(overdueCount * 5, 25);
      
      // Deduct for blocked tasks (8 points per blocked task, max 20 points)
      healthScore -= Math.min(blockedCount * 8, 20);
      
      // Deduct for high-priority open (3 points per task, max 15 points)
      healthScore -= Math.min(highPriorityOpen * 3, 15);
      
      // Bonus for high sprint completion (up to 10 points)
      if (sprintCompletion > 80) {
        healthScore += Math.min((sprintCompletion - 80) * 0.5, 10);
      }
      
      healthScore = Math.max(0, Math.min(100, Math.round(healthScore)));

      const calculatedKpis = {
        completionRate,
        sprintCompletion,
        overdueCount,
        blockedCount,
        highPriorityOpen,
        healthScore,
        totalTasks,
        completedTasks,
        inProgressTasks,
        todoTasks
      };
      
      console.log('📊 KPI Hook - Final calculated KPIs:', calculatedKpis);
      
      setKpis(calculatedKpis);
      setError(null);
    } catch (err) {
      console.error('Failed to calculate KPIs:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    console.log('🎯 useEffect triggered with userId:', userId);
    if (userId) {
      console.log('✅ userId exists, calling calculateKPIs');
      calculateKPIs();
      
      // Refresh every 60 seconds
      const interval = setInterval(calculateKPIs, 60000);
      return () => clearInterval(interval);
    } else {
      console.log('❌ No userId, skipping calculateKPIs');
    }
  }, [userId, calculateKPIs]);

  return { kpis, loading, error, refresh: calculateKPIs };
}

