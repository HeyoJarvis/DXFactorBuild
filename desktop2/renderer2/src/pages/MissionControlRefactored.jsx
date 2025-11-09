import { useState, useEffect } from 'react';
import { useDeveloperTasks } from '../hooks/useDeveloperTasks';
import { usePMTasks } from '../hooks/usePMTasks';
import TaskCarousel from '../components/MissionControl/TaskCarousel';
import UniversalChatBar from '../components/MissionControl/UniversalChatBar';
import TaskDetailView from '../components/MissionControl/TaskDetailView';
import UserProfileMenu from '../components/MissionControl/UserProfileMenu';
import TabBar from '../components/MissionControl/TabBar';
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
  
  // Active tab state
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
    loading: true
  });

  // Determine user role and load appropriate tasks
  const isDeveloper = user?.user_role === 'developer' || user?.role === 'developer';

  // Load JIRA tasks based on role
  // Developers: their assigned tasks
  // PM/Functional: all JIRA tasks for their unit
  const { tasks: devTasks, loading: devLoading, updateTask: updateDevTask } = useDeveloperTasks(user, 'all');
  const { tasks: pmTasks, loading: pmLoading, updateTask: updatePMTask } = usePMTasks(user, null);

  const jiraTasks = isDeveloper ? devTasks : pmTasks;
  const jiraLoading = isDeveloper ? devLoading : pmLoading;
  const updateTask = isDeveloper ? updateDevTask : updatePMTask;

  // Pre-fetch all tab data on mount
  useEffect(() => {
    const fetchAllData = async () => {
      try {
        console.log('📊 Pre-fetching all tab data...');
        
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
          jiraTasks, // From hooks
          calendarEvents,
          emails,
          reports: [], // TODO: Add reports data
          widgets: [], // TODO: Add widgets data
          loading: false
        });

        console.log('✅ All tab data loaded:', {
          jiraTasks: jiraTasks.length,
          calendarEvents: calendarEvents.length,
          emails: emails.length
        });
      } catch (error) {
        console.error('Failed to fetch tab data:', error);
        setAllTabsData(prev => ({ ...prev, loading: false }));
      }
    };

    // Wait for JIRA tasks to load first
    if (!jiraLoading) {
      fetchAllData();
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

  // Handle tab change
  const handleTabChange = (tabId) => {
    console.log('🔄 Tab changed to:', tabId);
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

