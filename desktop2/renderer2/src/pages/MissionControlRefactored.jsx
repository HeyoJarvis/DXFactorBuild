import { useState, useEffect } from 'react';
import { useDeveloperTasks } from '../hooks/useDeveloperTasks';
import { usePMTasks } from '../hooks/usePMTasks';
import TaskCarousel from '../components/MissionControl/TaskCarousel';
import UniversalChatBar from '../components/MissionControl/UniversalChatBar';
import TaskDetailView from '../components/MissionControl/TaskDetailView';
import UserProfileMenu from '../components/MissionControl/UserProfileMenu';
import TabBar from '../components/MissionControl/TabBar';
import MissionControlLoader from '../components/LoadingScreen/MissionControlLoader';
import JiraKPIDashboard from '../components/MissionControl/JiraKPIDashboard';
import './MissionControlRefactored.css';

/**
 * Mission Control Refactored - Carousel-based Interface
 * 
 * Layout:
 * - User profile circle at top center
 * - Task carousel in middle (overlapping cards)
 * - Universal chat bar at bottom
 * - Tab navigation below chat bar
 * - Split-view detail mode when task selected
 */
export default function MissionControlRefactored({ user }) {
  console.log('🎯 MissionControlRefactored mounted', { user: user?.name, role: user?.user_role });
  
  // Loading animation state
  const [showLoader, setShowLoader] = useState(true);
  
  // Active tab state - Default to jira-progress (always visible)
  const [activeTab, setActiveTab] = useState('jira-progress');
  
  // Selected task state
  const [selectedTask, setSelectedTask] = useState(null);
  
  // Detail view state
  const [showDetailView, setShowDetailView] = useState(false);
  
  // All tabs data (pre-fetched)
  const [allTabsData, setAllTabsData] = useState({
    jiraTasks: [],
    calendarEvents: [],
    emails: [],
    reports: [],
    widgets: [],
    loading: false // Start as false to prevent blank screen
  });

  // Determine user role and load appropriate tasks
  const isDeveloper = user?.user_role === 'developer' || user?.role === 'developer';

  // Load JIRA tasks based on role
  // Developers: their assigned tasks
  // PM/Functional: all JIRA tasks for their unit
  const { tasks: devTasks, loading: devLoading, updateTask: updateDevTask, refreshTasks: refreshDevTasks } = useDeveloperTasks(user, 'all');
  const { tasks: pmTasks, loading: pmLoading, updateTask: updatePMTask, refreshTasks: refreshPMTasks } = usePMTasks(user, null);

  const jiraTasks = isDeveloper ? devTasks : pmTasks;
  const jiraLoading = isDeveloper ? devLoading : pmLoading;
  const updateTask = isDeveloper ? updateDevTask : updatePMTask;
  const refreshTasks = isDeveloper ? refreshDevTasks : refreshPMTasks;

  // Hide loader after animation completes (3.2 seconds)
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowLoader(false);
    }, 3200); // Match animation duration in MissionControlLoader.css

    return () => clearTimeout(timer);
  }, []);

  // Trigger initial JIRA sync on mount
  useEffect(() => {
    const triggerInitialSync = async () => {
      try {
        console.log('🔄 Triggering initial JIRA sync...');
        
        // Check if JIRA API is available
        if (!window.electronAPI?.jira?.syncTasks) {
          console.warn('⚠️ JIRA API not available');
          return;
        }
        
        const syncResult = await window.electronAPI.jira.syncTasks();
        
        if (syncResult?.success) {
          console.log('✅ Initial JIRA sync completed:', {
            created: syncResult.tasksCreated,
            updated: syncResult.tasksUpdated,
            deleted: syncResult.tasksDeleted
          });
          // Refresh tasks after sync
          if (typeof refreshTasks === 'function') {
            await refreshTasks();
          }
        } else {
          console.warn('⚠️ JIRA sync failed:', syncResult?.error);
        }
      } catch (error) {
        console.error('❌ Failed to trigger JIRA sync:', error);
      }
    };

    // Trigger sync after a short delay to let everything initialize
    const syncTimer = setTimeout(triggerInitialSync, 2000);

    return () => clearTimeout(syncTimer);
  }, [refreshTasks]); // Include refreshTasks in dependencies

  // Listen for JIRA sync completion and refresh tasks
  useEffect(() => {
    // Refresh tasks when JIRA sync completes
    const handleJiraSync = () => {
      console.log('🔄 JIRA sync detected, refreshing tasks...');
      if (refreshTasks) {
        refreshTasks();
      }
    };

    // Listen for task created/updated events
    let taskCreatedCleanup;
    if (window.electronAPI?.onTaskCreated) {
      taskCreatedCleanup = window.electronAPI.onTaskCreated(handleJiraSync);
    }

    return () => {
      if (taskCreatedCleanup) taskCreatedCleanup();
    };
  }, [refreshTasks]);

  // Pre-fetch all tab data on mount
  useEffect(() => {
    const fetchAllData = async () => {
      try {
        console.log('📊 Pre-fetching all tab data...');
        console.log('📊 JIRA tasks available:', jiraTasks?.length || 0);
        
        // Fetch calendar events
        let calendarEvents = [];
        try {
          const calendarResult = await window.electronAPI.missionControl?.getCalendar?.({
            maxResults: 50
          });
          if (calendarResult?.success) {
            calendarEvents = calendarResult.events || [];
          }
        } catch (err) {
          console.warn('Calendar fetch failed:', err);
        }

        // Fetch emails
        let emails = [];
        try {
          const emailResult = await window.electronAPI.inbox?.getUnified?.({
            maxResults: 50
          });
          if (emailResult?.success) {
            emails = emailResult.emails || [];
          }
        } catch (err) {
          console.warn('Email fetch failed:', err);
        }

        // Update state with all fetched data
        setAllTabsData({
          jiraTasks: jiraTasks || [], // From hooks
          calendarEvents,
          emails,
          reports: [], // TODO: Add reports data
          widgets: [], // TODO: Add widgets data
          loading: false
        });

        console.log('✅ All tab data loaded:', {
          jiraTasks: (jiraTasks || []).length,
          calendarEvents: calendarEvents.length,
          emails: emails.length
        });
      } catch (error) {
        console.error('Failed to fetch tab data:', error);
        setAllTabsData(prev => ({ ...prev, jiraTasks: jiraTasks || [], loading: false }));
      }
    };

    // Wait for JIRA tasks to load first, or timeout after 5 seconds
    if (!jiraLoading) {
      fetchAllData();
    } else {
      // Safety timeout to prevent infinite loading
      const timeout = setTimeout(() => {
        console.warn('⚠️ JIRA loading timeout, proceeding with available data');
        setAllTabsData(prev => ({ ...prev, jiraTasks: jiraTasks || [], loading: false }));
      }, 5000);
      return () => clearTimeout(timeout);
    }
  }, [jiraLoading, jiraTasks]);

  // Handle task selection from carousel
  const handleTaskSelect = (task) => {
    console.log('📌 Task selected:', task);
    setSelectedTask(task);
    setShowDetailView(true);
  };

  // Handle close detail view
  const handleCloseDetailView = () => {
    setShowDetailView(false);
    setSelectedTask(null);
  };

  // Handle tab change - Only allow visible tabs
  const handleTabChange = (tabId) => {
    console.log('🔄 Tab changed to:', tabId);
    
    // Only allow jira-progress and reports (visible tabs)
    const visibleTabs = ['jira-progress', 'reports'];
    if (!visibleTabs.includes(tabId)) {
      console.warn('⚠️ Attempted to switch to hidden tab:', tabId);
      return;
    }
    
    setActiveTab(tabId);
    // Clear selection when switching tabs
    setSelectedTask(null);
    setShowDetailView(false);
  };

  // Handle task update (for Kanban drag-and-drop)
  const handleTaskUpdate = async (taskId, updates) => {
    try {
      console.log('🔄 Updating task:', { taskId, updates });
      await updateTask(taskId, updates);
    } catch (error) {
      console.error('Failed to update task:', error);
    }
  };

  // Check if we're on tabs that should hide logo and chat
  const isFullScreenTab = activeTab === 'unibox' || activeTab === 'calendar';

  return (
    <div className="mission-control-refactored">
      {/* Mission Control Loading Animation */}
      <MissionControlLoader isVisible={showLoader} />
      
      {/* User Profile Menu - Hidden on full-screen tabs */}
      {!isFullScreenTab && <UserProfileMenu user={user} />}

      {/* Main Content Area */}
      {showDetailView ? (
        // Detail View: Split layout with chat and JIRA card
        <TaskDetailView
          task={selectedTask}
          user={user}
          onClose={handleCloseDetailView}
        />
      ) : (
        // Carousel View: Show tasks based on active tab
        <>
          {/* JIRA KPI Dashboard - Show only on jira-progress tab */}
          {activeTab === 'jira-progress' && !isFullScreenTab && (
            <div className="kpi-dashboard-container">
              <JiraKPIDashboard user={user} />
            </div>
          )}

          <div className={`carousel-area ${isFullScreenTab ? 'fullscreen-mode' : ''}`}>
            <TaskCarousel
              activeTab={activeTab}
              allTabsData={allTabsData}
              onTaskSelect={handleTaskSelect}
              onUpdateTask={handleTaskUpdate}
              user={user}
            />
          </div>

          {/* Universal Chat Bar - Hidden on full-screen tabs */}
          {!isFullScreenTab && (
            <UniversalChatBar
              selectedTask={selectedTask}
              user={user}
              onTaskSelect={handleTaskSelect}
            />
          )}
        </>
      )}

      {/* Tab Navigation */}
      <TabBar
        activeTab={activeTab}
        onTabChange={handleTabChange}
      />
    </div>
  );
}

