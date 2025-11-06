import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useDeveloperTasks } from '../hooks/useDeveloperTasks';
import { useSalesTasks } from '../hooks/useSalesTasks';
import DraggableHeader from '../components/common/DraggableHeader';
import ModeToggle from '../components/MissionControl/ModeToggle';
import GroupedActionList from '../components/Tasks/GroupedActionList';
import TaskChat from '../components/Tasks/TaskChat';
import TeamChat from './TeamChat';
import TeamSelection from '../components/Teams/TeamSelection';
import UnitSelection from '../components/Teams/UnitSelection';
import TeamContext from '../components/Teams/TeamContext';
import CalendarEmail from '../components/MissionControl/CalendarEmail';
import MissionControlLoader from '../components/LoadingScreen/MissionControlLoader';
import Dashboard from '../components/Dashboard/Dashboard';
import './MissionControl.css';

/**
 * Mission Control - Dual Mode Interface
 * Personal Mode: Individual work (Tasks page)
 * Team Mode: Team collaboration (Team Chat with full context)
 */
export default function MissionControl({ user }) {
  // URL params for mode and team
  const [searchParams, setSearchParams] = useSearchParams();

  // Mode state: 'personal' | 'team'
  const [mode, setMode] = useState(() => {
    // Try URL first, then localStorage, default to personal
    const urlMode = searchParams.get('mode');
    if (urlMode === 'team' || urlMode === 'personal') return urlMode;
    return localStorage.getItem('missionControlMode') || 'personal';
  });

  // Team state for team mode (two-level hierarchy)
  const [teams, setTeams] = useState([]); // All units loaded from DB
  const [selectedTeam, setSelectedTeam] = useState(null); // Department/big team (grouped units)
  const [selectedUnit, setSelectedUnit] = useState(null); // Actual working unit
  const [teamsLoading, setTeamsLoading] = useState(false);
  const [departmentChatMode, setDepartmentChatMode] = useState(false); // Department-level chat mode

  // Selected task for Personal mode chat
  const [selectedTask, setSelectedTask] = useState(null);

  // Loading state for initial mount animation
  const [isLoading, setIsLoading] = useState(true);

  // Show loading animation on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 3000); // Remove component after animation (slightly before 3.2s to ensure smooth transition)

    return () => clearTimeout(timer);
  }, []);

  // Panel sizing state
  const [leftPanelWidth, setLeftPanelWidth] = useState(parseInt(localStorage.getItem('leftPanelWidth')) || 380);
  const [rightPanelWidth, setRightPanelWidth] = useState(parseInt(localStorage.getItem('rightPanelWidth')) || 420);

  // Panel visibility state
  const [panelVisibility, setPanelVisibility] = useState(() => {
    const stored = localStorage.getItem('panelVisibility');
    if (stored) {
      return JSON.parse(stored);
    }
    return { left: true, middle: true, right: true };
  });

  const handleTogglePanel = (panel) => {
    const newVisibility = { ...panelVisibility, [panel]: !panelVisibility[panel] };
    setPanelVisibility(newVisibility);
    localStorage.setItem('panelVisibility', JSON.stringify(newVisibility));
  };

  // Panel resizing
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (window.resizingPanel === 'left') {
        const newWidth = Math.max(280, Math.min(600, e.clientX));
        setLeftPanelWidth(newWidth);
        document.documentElement.style.setProperty('--left-panel-width', `${newWidth}px`);
      } else if (window.resizingPanel === 'right') {
        const newWidth = Math.max(320, Math.min(700, window.innerWidth - e.clientX));
        setRightPanelWidth(newWidth);
        document.documentElement.style.setProperty('--right-panel-width', `${newWidth}px`);
      }
    };

    const handleMouseUp = () => {
      if (window.resizingPanel) {
        if (window.resizingPanel === 'left') {
          localStorage.setItem('leftPanelWidth', leftPanelWidth);
        } else {
          localStorage.setItem('rightPanelWidth', rightPanelWidth);
        }
        window.resizingPanel = null;
        document.body.style.cursor = 'default';
        document.body.style.userSelect = 'auto';
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [leftPanelWidth, rightPanelWidth]);

  // Initialize panel widths
  useEffect(() => {
    document.documentElement.style.setProperty('--left-panel-width', `${leftPanelWidth}px`);
    document.documentElement.style.setProperty('--right-panel-width', `${rightPanelWidth}px`);
  }, []);

  const handleResizeStart = (panel) => {
    window.resizingPanel = panel;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  // Load tasks for Personal mode
  const isDeveloper = user?.role === 'developer';
  const { tasks: devTasks, loading: devLoading, updateTask: updateDevTask, deleteTask: deleteDevTask, toggleTask: toggleDevTask } = useDeveloperTasks(user, 'all');
  const { 
    tasks: salesTasks, 
    loading: salesLoading, 
    updateTask: updateSalesTask, 
    deleteTask: deleteSalesTask, 
    toggleTask: toggleSalesTask,
    jiraView,
    setJiraView,
    monitorTask,
    unmonitorTask
  } = useSalesTasks(user, 'all');

  const tasks = isDeveloper ? devTasks : salesTasks;
  const tasksLoading = isDeveloper ? devLoading : salesLoading;
  const updateTask = isDeveloper ? updateDevTask : updateSalesTask;
  const deleteTask = isDeveloper ? deleteDevTask : deleteSalesTask;
  const toggleTask = isDeveloper ? toggleDevTask : toggleSalesTask;

  // Load teams when switching to team mode
  useEffect(() => {
    if (mode === 'team') {
      loadTeams();
    }
  }, [mode]);

  // Persist mode to localStorage and URL
  useEffect(() => {
    localStorage.setItem('missionControlMode', mode);
    const newParams = new URLSearchParams(searchParams);
    newParams.set('mode', mode);
    if (mode === 'team' && selectedUnit) {
      newParams.set('unitId', selectedUnit.id);
      if (selectedTeam) {
        newParams.set('team', selectedTeam.name);
      }
    } else {
      newParams.delete('unitId');
      newParams.delete('team');
    }
    setSearchParams(newParams, { replace: true });
  }, [mode, selectedUnit, selectedTeam]);

  // Try to restore selected unit from URL or localStorage
  // BUT don't auto-select - let user choose from selection screens
  useEffect(() => {
    if (mode === 'team' && teams.length > 0 && !selectedUnit) {
      const urlUnitId = searchParams.get('unitId');
      const savedUnitId = localStorage.getItem('missionControlUnitId');
      const unitId = urlUnitId || savedUnitId;

      if (unitId) {
        const unit = teams.find(t => t.id === unitId);
        if (unit) {
          setSelectedUnit(unit);
          // Also restore the team/department
          const dept = unit.department || 'General';
          const teamGroup = {
            name: dept,
            description: `${dept} department teams and units`,
            units: teams.filter(t => (t.department || 'General') === dept)
          };
          setSelectedTeam(teamGroup);
          return;
        }
      }

      // DON'T auto-select - show TeamSelection instead
    }
  }, [mode, teams]);

  // Persist selected unit
  useEffect(() => {
    if (selectedUnit) {
      localStorage.setItem('missionControlUnitId', selectedUnit.id);
    }
  }, [selectedUnit]);

  // Load teams from database
  const loadTeams = async () => {
    try {
      setTeamsLoading(true);

      if (!window.electronAPI?.teamChat?.loadTeams) {
        console.error('Team Chat API not available');
        return;
      }

      const result = await window.electronAPI.teamChat.loadTeams();
      if (result.success) {
        setTeams(result.teams);
      } else {
        console.error('Failed to load teams:', result.error);
      }
    } catch (error) {
      console.error('Error loading teams:', error);
    } finally {
      setTeamsLoading(false);
    }
  };

  // Handle mode change
  const handleModeChange = (newMode) => {
    setMode(newMode);
  };

  // Handle team/department selection (first level)
  const handleTeamChange = (team) => {
    setSelectedTeam(team);
    setSelectedUnit(null); // Reset unit when team changes
    setDepartmentChatMode(false); // Exit department chat mode
  };

  // Handle unit selection (second level)
  const handleUnitChange = (unit) => {
    setSelectedUnit(unit);
    setDepartmentChatMode(false); // Exit department chat mode
  };

  // Handle department chat button click
  const handleDepartmentChat = (department) => {
    setSelectedTeam(department);
    setSelectedUnit(null);
    setDepartmentChatMode(true); // Enter department chat mode
    setMode('team'); // Ensure we're in team mode
  };

  // Handle back to team selection (from unit selection)
  const handleBackToTeamSelection = () => {
    setSelectedTeam(null);
    setSelectedUnit(null);
    setDepartmentChatMode(false);
    localStorage.removeItem('missionControlUnitId');
  };

  // Handle back to unit selection (from workspace)
  const handleBackToUnitSelection = () => {
    setSelectedUnit(null);
    setDepartmentChatMode(false);
    localStorage.removeItem('missionControlUnitId');
  };

  // Task filtering and search state
  const [searchQuery, setSearchQuery] = useState('');

  // Helper functions for task management
  const getCompletedCount = () => {
    return tasks.filter(task => task.status === 'completed').length;
  };

  const getSourceCounts = () => {
    const jira = tasks.filter(task => task.source === 'jira').length;
    const slack = tasks.filter(task => task.source === 'slack').length;
    return { jira, slack };
  };

  const handleNewTask = () => {
    console.log('New task button clicked');
    // TODO: Implement new task creation modal
  };

  const handleSearch = (query) => {
    setSearchQuery(query);
  };

  const getFilteredTasks = () => {
    let filtered = tasks;
    
    if (searchQuery) {
      filtered = filtered.filter(task =>
        task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        task.description?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    
    return filtered;
  };

  // Render mode toggle header
  return (
    <div className="mission-control-page">
      {/* Loading Animation */}
      <MissionControlLoader isVisible={isLoading} />
      
      {/* Ambient Background Elements */}
      <div className="ambient-background">
        <div className="ambient-orb orb-1"></div>
        <div className="ambient-orb orb-2"></div>
        <div className="ambient-orb orb-3"></div>
        <div className="floating-particles">
          {[...Array(20)].map((_, i) => (
            <div key={i} className={`particle particle-${i + 1}`}></div>
          ))}
        </div>
      </div>
      
      {/* Mode Toggle Header */}
      <ModeToggle
        user={user}
        mode={mode}
        onModeChange={handleModeChange}
        selectedTeam={selectedTeam}
        selectedUnit={selectedUnit}
        onTeamChange={handleTeamChange}
        onBackToTeamSelection={handleBackToTeamSelection}
        onBackToUnitSelection={handleBackToUnitSelection}
        teams={teams}
        loading={teamsLoading}
        panelVisibility={panelVisibility}
        onTogglePanel={handleTogglePanel}
      />

      {/* Three-level selection flow for team mode */}
      {mode === 'team' && !selectedTeam ? (
        // Level 1: Show departments/big teams
        <TeamSelection 
          teams={teams} 
          loading={teamsLoading}
          onTeamSelect={handleTeamChange}
          onDepartmentChat={handleDepartmentChat}
        />
      ) : mode === 'team' && selectedTeam && departmentChatMode ? (
        // Department Chat Mode: Show chat with all units context
        <div className="department-chat-container">
          <TeamChat 
            user={user} 
            selectedTeam={selectedTeam}
            departmentMode={true}
          />
        </div>
      ) : mode === 'team' && selectedTeam && !selectedUnit ? (
        // Level 2: Show units within selected team
        <UnitSelection
          selectedTeam={selectedTeam}
          onUnitSelect={handleUnitChange}
          onBack={handleBackToTeamSelection}
        />
      ) : (
        // Level 3: Show workspace panels
        <>
      {/* 3-Panel Grid Layout */}
      <div 
        className="mission-control-grid"
        style={{
          gridTemplateColumns: `
            ${panelVisibility.left ? 'var(--left-panel-width, 380px)' : '0px'}
            ${panelVisibility.middle ? '1fr' : '0px'}
            ${panelVisibility.right ? 'var(--right-panel-width, 420px)' : '0px'}
          `.trim().replace(/\s+/g, ' ')
        }}
      >
        {/* Left Panel - Context (Tasks List) */}
        {panelVisibility.left && (
        <div className="panel panel-context">
          {mode === 'personal' ? (
            // Personal Mode: My tasks list
            <div className="tasks-list-container">
              <div className="tasks-list-header">
                <div className="tasks-header-top">
                  <div className="tasks-header-left">
                    <h3 className="tasks-list-title">{jiraView ? 'Team Dev Tasks' : 'My Tasks'}</h3>
                    {getCompletedCount() > 0 && !jiraView && (
                      <span className="tasks-completion-stats">
                        {getCompletedCount()} of {tasks.length} completed · {Math.round((getCompletedCount() / tasks.length) * 100)}% done
                      </span>
                    )}
                  </div>
                  <div className="tasks-header-right">
                    <div className="tasks-source-badges">
                      {getSourceCounts().jira > 0 && (
                        <div className="source-badge jira-badge">
                          <span className="badge-label">JI</span>
                          <span className="badge-count">{getSourceCounts().jira}</span>
                        </div>
                      )}
                      {getSourceCounts().slack > 0 && (
                        <div className="source-badge slack-badge">
                          <span className="badge-label">SL</span>
                          <span className="badge-count">{getSourceCounts().slack}</span>
                        </div>
                      )}
                    </div>
                    <button className="new-task-button" onClick={handleNewTask}>
                      + New
                    </button>
                  </div>
                </div>

                {/* Toggle for Sales Users */}
                {!isDeveloper && (
                  <div className="tasks-view-toggle">
                    <button 
                      className={`toggle-option ${!jiraView ? 'active' : ''}`}
                      onClick={() => setJiraView(false)}
                    >
                      My Tasks
                    </button>
                    <button 
                      className={`toggle-option ${jiraView ? 'active' : ''}`}
                      onClick={() => setJiraView(true)}
                    >
                      Team Dev
                    </button>
                  </div>
                )}

                <div className="tasks-header-filters">
                  <input
                    type="text"
                    className="tasks-search-input"
                    placeholder="Search tasks..."
                    value={searchQuery}
                    onChange={(e) => handleSearch(e.target.value)}
                  />
                </div>
              </div>
              {tasksLoading ? (
                <div className="loading-tasks">Loading...</div>
              ) : (
                <GroupedActionList
                  tasks={getFilteredTasks()}
                  onToggle={toggleTask}
                  onDelete={deleteTask}
                  onUpdate={updateTask}
                  onChat={setSelectedTask}
                  onMonitor={jiraView ? monitorTask : null}
                  isTeamDevView={jiraView}
                />
              )}
            </div>
          ) : (
            // Team Mode: Unit context (meetings, tasks, code)
            <div className="team-context-panel">
              <TeamContext selectedTeam={selectedUnit} />
            </div>
          )}

          {/* Resize Handle */}
          <div
            className="panel-resize-handle"
            onMouseDown={() => handleResizeStart('left')}
          >
            <div className="resize-handle-bar"></div>
          </div>
        </div>
        )}

        {/* Middle Panel - Conversation (Chat) */}
        {panelVisibility.middle && (
        <div className="panel panel-conversation">
          {mode === 'personal' ? (
            // Personal Mode: Task-specific chat (AI assistant)
            selectedTask ? (
              <TaskChat
                task={selectedTask}
                onClose={() => setSelectedTask(null)}
              />
            ) : (
              <Dashboard user={user} />
            )
          ) : (
            // Team Mode: Unit-wide chat with shared context
            <TeamChat user={user} selectedTeam={selectedUnit} />
          )}
        </div>
        )}

        {/* Right Panel - Coordination (Calendar + Email) */}
        {panelVisibility.right && (
        <div className="panel panel-coordination">
          {mode === 'personal' ? (
            // Personal Mode: Calendar & Email with AI suggestions from tasks
            <CalendarEmail user={user} tasks={tasks} />
          ) : (
            // Team Mode: Team calendar + transcripts
            <div className="team-calendar-panel">
              <h3>Team Calendar</h3>
              <p>Shared calendar with meeting transcripts</p>
              {/* TODO: Implement TeamCalendar component */}
            </div>
          )}

          {/* Resize Handle */}
          <div
            className="panel-resize-handle panel-resize-handle-left"
            onMouseDown={() => handleResizeStart('right')}
          >
            <div className="resize-handle-bar"></div>
          </div>
        </div>
        )}
      </div>
      </>
      )}
    </div>
  );
}

// Keep all the modal components below for potential future use
function LegacyMissionControl({ user }) {
  const [activeTab, setActiveTab] = useState('calendar'); // 'calendar' or 'email'
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showNewMeetingModal, setShowNewMeetingModal] = useState(false);
  const [showNewEmailModal, setShowNewEmailModal] = useState(false);
  const [selectedMeetingEvent, setSelectedMeetingEvent] = useState(null);

  // Integration state
  const [microsoftConnected, setMicrosoftConnected] = useState(false);
  const [googleConnected, setGoogleConnected] = useState(false);
  const [authenticating, setAuthenticating] = useState(null); // 'microsoft' | 'google' | null
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [calendarView, setCalendarView] = useState('daily'); // 'daily' or 'weekly'

  // Email state
  const [emails, setEmails] = useState([]);
  const [selectedEmail, setSelectedEmail] = useState(null);
  const [emailsLoading, setEmailsLoading] = useState(false);
  const [emailView, setEmailView] = useState('inbox'); // 'inbox' or 'drafts'

  // AI Follow Up state
  const [showAIFollowUpModal, setShowAIFollowUpModal] = useState(false);
  const [aiDraftContent, setAiDraftContent] = useState('');
  const [generatingDraft, setGeneratingDraft] = useState(false)

  // Load tasks with developer routing (mission-control)
  const { tasks: allTasks, loading: tasksLoading } = useDeveloperTasks(user, 'all');

  // Filter tasks for AI-suggested meetings (calendar tasks)
  const suggestedMeetings = allTasks
    .filter(task => task.work_type === 'calendar' && task.status !== 'completed')
    .map(task => ({
      id: task.id,
      title: task.title,
      reason: task.description || 'Detected from Slack activity',
      priority: task.priority || 'medium',
      suggestedTime: task.due_date ? new Date(task.due_date).toLocaleString() : 'ASAP',
      attendees: task.mentioned_users?.map(id => id.split('_')[1] || id).slice(0, 3) || [],
      source: task.external_source || 'slack',
      taskData: task
    }));

  // Filter tasks for drafted emails (email/outreach tasks)
  const draftedEmails = allTasks
    .filter(task => (task.work_type === 'email' || task.work_type === 'outreach') && task.status !== 'completed')
    .map(task => ({
      id: task.id,
      subject: task.title,
      title: task.title,
      preview: task.description || 'AI-detected email task',
      priority: task.priority || 'medium',
      to: task.assignee ? `@${task.assignee.split('_')[1] || task.assignee}` : 'Team',
      context: task.external_source === 'slack' ? 'From Slack' : task.external_source === 'jira' ? 'From JIRA' : 'Manual',
      source: task.external_source || 'slack',
      taskData: task
    }));

  return (
    <div className="legacy-mission-control-page">
      {/* Draggable Window Controls */}
      <DraggableHeader title="Legacy Mission Control" />

      {/* Tab Navigation - Simplified */}
      <div className="mc-tabs">
        <button 
          className={`mc-tab ${activeTab === 'calendar' ? 'active' : ''}`}
          onClick={() => setActiveTab('calendar')}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
            <line x1="16" y1="2" x2="16" y2="6"></line>
            <line x1="8" y1="2" x2="8" y2="6"></line>
            <line x1="3" y1="10" x2="21" y2="10"></line>
          </svg>
          Calendar
        </button>
        <button 
          className={`mc-tab ${activeTab === 'email' ? 'active' : ''}`}
          onClick={() => setActiveTab('email')}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
            <polyline points="22,6 12,13 2,6"></polyline>
          </svg>
          Email
        </button>
      </div>

      {/* Main Content */}
      <div className="mc-content">
        {activeTab === 'calendar' ? (
          <div className="calendar-view">
            {/* Date Header */}
            <div className="date-header">
              <h2 className="current-date">{formatDate(selectedDate)}</h2>
              <button 
                className="btn-primary"
                onClick={() => setShowNewMeetingModal(true)}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19"></line>
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                </svg>
                New Meeting
              </button>
            </div>

            {/* Calendar Grid */}
            <div className={`calendar-grid ${calendarView === 'weekly' ? 'weekly-view' : ''}`}>
              {calendarView === 'daily' ? (
                <>
                  {/* Daily Timeline View */}
                  <div className="events-section">
                    <div className="section-header">
                      <h3 className="section-title">TODAY'S TIMELINE</h3>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        {/* View Toggle */}
                        <div className="view-toggle">
                          <button 
                            className={`toggle-option ${calendarView === 'daily' ? 'active' : ''}`}
                            onClick={() => setCalendarView('daily')}
                          >
                            Daily
                          </button>
                          <button 
                            className={`toggle-option ${calendarView === 'weekly' ? 'active' : ''}`}
                            onClick={() => setCalendarView('weekly')}
                          >
                            Weekly
                          </button>
                        </div>
                        <div className="current-time-badge">
                          <div className="current-time-dot"></div>
                          Current time: {new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                        </div>
                      </div>
                    </div>
                    
                    {error && (
                      <div style={{ padding: '12px', background: '#fff3cd', borderRadius: '8px', marginBottom: '12px', fontSize: '13px', color: '#856404' }}>
                        {error}
                      </div>
                    )}
                    
                    {loading && (
                      <div style={{ padding: '20px', textAlign: 'center', color: '#86868b' }}>
                        Loading calendar events...
                      </div>
                    )}
                    
                    {!loading && events.length === 0 && (
                      <div style={{ padding: '20px', textAlign: 'center', color: '#86868b' }}>
                        {microsoftConnected || googleConnected 
                          ? 'No upcoming events scheduled'
                          : 'Connect Microsoft or Google to see your calendar'}
                      </div>
                    )}
                    
                    {!loading && events.length > 0 && (
                      <div className="timeline-container">
                        <div className="timeline-grid">
                          {['9 AM', '10 AM', '11 AM', '12 PM', '1 PM', '2 PM', '3 PM', '4 PM', '5 PM', '6 PM'].map((hour, hourIndex) => {
                            const hourEvents = events.filter(event => {
                              const eventHour = new Date(event.rawDate).getHours();
                              return eventHour === (hourIndex + 9);
                            });
                            
                            return (
                              <div key={hour} className="timeline-hour">
                                <div className="timeline-time-label">{hour}</div>
                                <div className="timeline-events-column">
                                  {hourEvents.map(event => (
                                    <div 
                                      key={event.id} 
                                      className="timeline-event" 
                                      style={{ borderLeftColor: event.color }}
                                      onClick={() => setSelectedMeetingEvent(event)}
                                    >
                                      <div className="timeline-event-header">
                                        <h4 className="timeline-event-title">{event.title}</h4>
                                        <span className="timeline-event-badge">PRIORITY</span>
                                      </div>
                                      <div className="timeline-event-meta">
                                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                          <circle cx="12" cy="12" r="10"></circle>
                                          <polyline points="12 6 12 12 16 14"></polyline>
                                        </svg>
                                        {event.time} • {event.duration} • <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 10l-4 4 6 6 4-4-6-6z"></path><path d="M2 10l6-6 4 4-6 6-4-4z"></path></svg> {event.location}
                                      </div>
                                      <div className="timeline-event-bottom-row">
                                        <div className="timeline-event-attendees">
                                          {event.attendees.slice(0, 3).map((attendee, idx) => (
                                            <div key={idx} className="attendee-avatar" title={attendee}>
                                              {attendee.split(' ').map(n => n[0]).join('')}
                                            </div>
                                          ))}
                                          {event.attendees.length > 3 && (
                                            <div className="attendee-avatar">+{event.attendees.length - 3}</div>
                                          )}
                                        </div>
                                        {event.meetingLink && (
                                          <button 
                                            className="timeline-event-join-btn"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              window.open(event.meetingLink);
                                            }}
                                          >
                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                              <path d="M15.5 1.5a.5.5 0 0 0-.5.5v3.5a.5.5 0 0 0 .5.5h3.5a.5.5 0 0 0 .5-.5v-3.5a.5.5 0 0 0-.5-.5h-3.5z"></path>
                                              <path d="M3 3.5A1.5 1.5 0 0 1 4.5 2h9A1.5 1.5 0 0 1 15 3.5v13a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 3 16.5v-13z"></path>
                                            </svg>
                                            Join
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Agent Recommendations */}
                  <div className="suggestions-section">
                    <div className="agent-recommendations-header">
                      <div>
                        <h3 className="agent-recommendations-title">Agent Recommendations</h3>
                      </div>
                    </div>

                    <div className="agent-recommendations">
                      {suggestedMeetings.length === 0 && (
                        <div style={{ padding: '20px', textAlign: 'center', color: '#86868b', fontSize: '13px' }}>
                          AI will suggest meetings based on your Slack, Teams, and JIRA activity
                        </div>
                      )}
                      
                      {suggestedMeetings.map(suggestion => (
                        <div key={suggestion.id} className="agent-recommendation-card">
                          <div className="agent-recommendation-header">
                            <div className="agent-recommendation-avatar">
                              {suggestion.source === 'slack' ? (
                                <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: '20px', height: '20px' }}>
                                  <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52z" fill="#E01E5A"/>
                                  <path d="M6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313z" fill="#36C5F0"/>
                                  <path d="M8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834z" fill="#2EB67D"/>
                                  <path d="M8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312z" fill="#ECB22E"/>
                                  <path d="M18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834z" fill="#2EB67D"/>
                                  <path d="M17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312z" fill="#ECB22E"/>
                                  <path d="M15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52z" fill="#E01E5A"/>
                                  <path d="M15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z" fill="#36C5F0"/>
                                </svg>
                              ) : suggestion.source === 'teams' ? (
                                <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: '20px', height: '20px', color: '#5059C9' }}>
                                  <path d="M20.625 8.127h-7.5a.75.75 0 0 0-.75.75v7.5c0 .414.336.75.75.75h7.5a.75.75 0 0 0 .75-.75v-7.5a.75.75 0 0 0-.75-.75zm-5.625 6.75v-5.25h4.5v5.25h-4.5z"/>
                                  <path d="M11.625 7.127h-7.5a.75.75 0 0 0-.75.75v7.5c0 .414.336.75.75.75h7.5a.75.75 0 0 0 .75-.75v-7.5a.75.75 0 0 0-.75-.75zm-5.625 6.75v-5.25h4.5v5.25h-4.5z"/>
                                </svg>
                              ) : (
                                suggestion.attendees[0]?.charAt(0) || 'SD'
                              )}
                            </div>
                            <div className="agent-recommendation-content">
                              <h4 className="agent-recommendation-title">{suggestion.title}</h4>
                              <p className="agent-recommendation-context">
                                Based on email thread from 
                                {suggestion.source === 'slack' ? (
                                  <svg className="source-icon" viewBox="0 0 24 24" fill="currentColor" style={{ color: '#E01E5A' }}>
                                    <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z"/>
                                  </svg>
                                ) : suggestion.source === 'teams' ? (
                                  <svg className="source-icon" viewBox="0 0 24 24" fill="currentColor" style={{ color: '#5059C9' }}>
                                    <path d="M20.625 8.127h-7.5a.75.75 0 0 0-.75.75v7.5c0 .414.336.75.75.75h7.5a.75.75 0 0 0 .75-.75v-7.5a.75.75 0 0 0-.75-.75zm-5.625 6.75v-5.25h4.5v5.25h-4.5z"/>
                                    <path d="M11.625 7.127h-7.5a.75.75 0 0 0-.75.75v7.5c0 .414.336.75.75.75h7.5a.75.75 0 0 0 .75-.75v-7.5a.75.75 0 0 0-.75-.75zm-5.625 6.75v-5.25h4.5v5.25h-4.5z"/>
                                  </svg>
                                ) : (
                                  <span>@{suggestion.source}</span>
                                )}
                              </p>
                            </div>
                          </div>
                          <div className="agent-recommendation-detail">{suggestion.reason}</div>
                          <div className={`agent-recommendation-urgency ${suggestion.priority === 'high' ? 'asap' : suggestion.priority === 'medium' ? 'today' : 'before'}`}>
                            {suggestion.suggestedTime}
                          </div>
                          <div className="agent-recommendation-action">
                            <button 
                              className="agent-recommendation-action-btn"
                              onClick={() => {
                                setSelectedMeetingEvent(suggestion);
                                setShowNewMeetingModal(true);
                              }}
                            >
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="12" y1="5" x2="12" y2="19"></line>
                                <line x1="5" y1="12" x2="19" y2="12"></line>
                              </svg>
                              Schedule
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <>
                  {/* Weekly View */}
                  <div className="events-section" style={{ gridColumn: '1 / -1' }}>
                    <div className="section-header">
                      <h3 className="section-title">WEEK OVERVIEW</h3>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        {/* View Toggle */}
                        <div className="view-toggle">
                          <button 
                            className={`toggle-option ${calendarView === 'daily' ? 'active' : ''}`}
                            onClick={() => setCalendarView('daily')}
                          >
                            Daily
                          </button>
                          <button 
                            className={`toggle-option ${calendarView === 'weekly' ? 'active' : ''}`}
                            onClick={() => setCalendarView('weekly')}
                          >
                            Weekly
                          </button>
                        </div>
                        <span className="event-count">{events.length} events this week</span>
                      </div>
                    </div>
                    
                    {/* Week Days Grid */}
                    <div className="week-overview">
                      {['MON', 'TUE', 'WED', 'THU', 'FRI'].map((day, index) => {
                        const dayDate = new Date();
                        dayDate.setDate(dayDate.getDate() - dayDate.getDay() + index + 1);
                        const isToday = dayDate.toDateString() === new Date().toDateString();
                        const dayEvents = events.filter(e => new Date(e.rawDate).toDateString() === dayDate.toDateString());
                        
                        return (
                          <div 
                            key={day} 
                            className={`week-day-card ${isToday ? 'active' : ''}`}
                          >
                            <div className="week-day-header">
                              <div className="week-day-name">{day}</div>
                              <div className="week-day-number">{dayDate.getDate()}</div>
                              <div className="week-day-events-count">
                                <span className="dot"></span>
                                {dayEvents.length} events
                              </div>
                            </div>
                            
                            {/* Events for this day */}
                            <div className="week-day-events">
                              {dayEvents.length === 0 ? (
                                <div className="week-day-no-events">No events</div>
                              ) : (
                                dayEvents.map(event => (
                                  <div 
                                    key={event.id} 
                                    className="week-day-event-item" 
                                    style={{ borderLeftColor: event.color }}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedMeetingEvent(event);
                                    }}
                                  >
                                    <div className="week-day-event-time">{event.time}</div>
                                    <div className="week-day-event-title">{event.title}</div>
                                  </div>
                                ))
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        ) : (
          <div className="email-view">
            {/* Intelligence Bar */}
            <div className="email-intelligence-bar">
              <div className="intelligence-pills">
                <button
                  className={`pill-filter ${emailView === 'inbox' ? 'active' : ''}`}
                  onClick={() => setEmailView('inbox')}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                    <polyline points="22,6 12,13 2,6"></polyline>
                  </svg>
                  Inbox
                </button>
                <button
                  className={`pill-filter ${emailView === 'drafts' ? 'active' : ''}`}
                  onClick={() => setEmailView('drafts')}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
                  </svg>
                  AI Drafts
                </button>
              </div>
              <div className="smart-hint">
                {emailView === 'inbox'
                  ? `${emails.length} ${microsoftConnected && googleConnected ? 'emails from Gmail & Outlook' : microsoftConnected ? 'emails from Outlook' : 'emails from Gmail'}`
                  : `${draftedEmails.length} AI-generated drafts ready to send`
                }
              </div>
            </div>

            {/* Three-Zone Layout */}
            <div className="email-layout">
              {/* Inbox List Zone */}
              <div className="inbox-zone">
                <div className="inbox-header">
                  <div className="inbox-title">
                    <h3>{emailView === 'inbox' ? 'Unified Inbox' : 'AI Drafts'}</h3>
                    <span className="inbox-count">{emailView === 'inbox' ? emails.length : draftedEmails.length}</span>
                  </div>
                  <button
                    className="btn-primary btn-compose"
                    onClick={() => setShowNewEmailModal(true)}
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
                    </svg>
                    Compose
                  </button>
                </div>

                <div className="inbox-list">
                  {emailView === 'inbox' ? (
                    <>
                      {emailsLoading && (
                        <div style={{ padding: '20px', textAlign: 'center', color: '#86868b' }}>
                          Loading emails...
                        </div>
                      )}

                      {!emailsLoading && emails.length === 0 && (
                        <div style={{ padding: '40px 20px', textAlign: 'center', color: '#86868b' }}>
                          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ margin: '0 auto 12px', opacity: 0.3 }}>
                            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                            <polyline points="22,6 12,13 2,6"></polyline>
                          </svg>
                          <p style={{ margin: '0 0 8px', fontSize: '14px' }}>
                            {microsoftConnected || googleConnected
                              ? 'No unread emails'
                              : 'Connect Gmail or Outlook to see your emails'}
                          </p>
                          <p style={{ margin: 0, fontSize: '12px', opacity: 0.7 }}>
                            Your inbox is empty
                          </p>
                        </div>
                      )}

                      {!emailsLoading && emails.map((email, index) => (
                        <div
                          key={email.id || `email-${index}`}
                          className={`email-row ${selectedEmail?.id === email.id ? 'selected' : ''}`}
                          onClick={() => setSelectedEmail(email)}
                        >
                          {/* Source icon - Gmail or Outlook */}
                          <div className="email-source-icon" title={email.source === 'gmail' ? 'Gmail' : 'Outlook'}>
                            {email.source === 'gmail' ? (
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style={{ color: '#EA4335' }}>
                                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                              </svg>
                            ) : (
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style={{ color: '#0078d4' }}>
                                <path d="M24 7.875v8.282a2.101 2.101 0 0 1-1.031 1.81l-7.969 4.657a2.094 2.094 0 0 1-2.063.031l-7.968-4.657A2.1 2.1 0 0 1 3.937 16.22V7.875l7.969 4.625a2.094 2.094 0 0 0 2.063 0zm0-2.156L16.032.062a2.093 2.093 0 0 0-2.063 0L6.001 4.719l7.968 4.656a2.094 2.094 0 0 0 2.063 0zM3.937 5.719 11.906.062a2.093 2.093 0 0 1 2.063 0l7.969 4.657v.969l-9.875 5.75a2.094 2.094 0 0 1-2.063 0L3.937 6.688z"/>
                              </svg>
                            )}
                          </div>

                          {/* Unread indicator */}
                          {email.unread && <div className="unread-indicator"></div>}

                          <div className="email-row-content">
                            {/* Sender & Status */}
                            <div className="email-row-header">
                              <div className="email-sender">
                                <div className="sender-avatar">
                                  {email.senderName.charAt(0).toUpperCase()}
                                </div>
                                <span className="sender-name">{email.senderName}</span>
                              </div>
                              <span className="email-time">{email.timeDisplay}</span>
                            </div>

                            {/* Subject */}
                            <div className="email-subject-line">
                              {email.subject || '(No subject)'}
                            </div>

                            {/* Preview snippet */}
                            <div className="email-snippet">
                              {email.preview || email.snippet || email.bodyPreview}
                            </div>
                          </div>
                        </div>
                      ))}
                    </>
                  ) : (
                    <>
                      {draftedEmails.length === 0 && (
                        <div style={{ padding: '40px 20px', textAlign: 'center', color: '#86868b' }}>
                          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ margin: '0 auto 12px', opacity: 0.3 }}>
                            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
                          </svg>
                          <p style={{ margin: '0 0 8px', fontSize: '14px' }}>No AI-generated drafts yet</p>
                          <p style={{ margin: 0, fontSize: '12px', opacity: 0.7 }}>
                            AI will draft emails based on your tasks and meetings
                          </p>
                        </div>
                      )}

                      {draftedEmails.map((email, index) => (
                        <div key={email.id} className={`email-row ${index === 0 ? 'selected' : ''}`}>
                          {/* Unread indicator */}
                          <div className="unread-indicator"></div>

                          <div className="email-row-content">
                            {/* Sender & Status */}
                            <div className="email-row-header">
                              <div className="email-sender">
                                <div className="sender-avatar">AI</div>
                                <span className="sender-name">AI Assistant</span>
                              </div>
                              <span className="email-time">Just now</span>
                            </div>

                            {/* Subject */}
                            <div className="email-subject-line">{email.subject}</div>

                            {/* Preview snippet */}
                            <div className="email-snippet">{email.preview}</div>

                            {/* Meta tags */}
                            <div className="email-meta-tags">
                              <span className="meta-tag ai">AI Generated</span>
                              <span className="meta-tag context">{email.context}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              </div>

              {/* Detail/Reader Zone */}
              <div className="email-reader-zone">
                {(emailView === 'inbox' && selectedEmail) || (emailView === 'drafts' && draftedEmails.length > 0) ? (
                  <>
                <div className="reader-container">
                  {/* Email Header */}
                  <div className="reader-header">
                    <h2 className="reader-subject">
                      {emailView === 'inbox'
                        ? (selectedEmail?.subject || '(No subject)')
                        : draftedEmails[0].subject}
                    </h2>

                    <div className="reader-meta">
                      <div className="reader-sender-block">
                        <div className="sender-avatar large">
                          {emailView === 'inbox'
                            ? selectedEmail?.senderName?.charAt(0).toUpperCase()
                            : 'AI'}
                        </div>
                        <div className="sender-info">
                          <div className="sender-name-large">
                            {emailView === 'inbox'
                              ? selectedEmail?.senderName
                              : 'AI Assistant'}
                          </div>
                          <div className="sender-email">
                            {emailView === 'inbox'
                              ? `From: ${selectedEmail?.senderEmail || selectedEmail?.from}`
                              : `To: ${draftedEmails[0].to}`}
                          </div>
                        </div>
                      </div>
                      <div className="reader-actions">
                        {emailView === 'inbox' && (
                          <button className="btn-ai-follow-up" title="Generate AI Follow Up" onClick={handleGenerateAIFollowUp}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
                            </svg>
                            <span>AI Follow Up</span>
                          </button>
                        )}
                        <button className="reader-action-btn" title="Reply">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="9 14 4 9 9 4"></polyline>
                            <path d="M20 20v-7a4 4 0 0 0-4-4H4"></path>
                          </svg>
                        </button>
                        <button className="reader-action-btn" title="Forward">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="15 14 20 9 15 4"></polyline>
                            <path d="M4 20v-7a4 4 0 0 1 4-4h12"></path>
                          </svg>
                        </button>
                        <button className="reader-action-btn" title="Archive">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="21 8 21 21 3 21 3 8"></polyline>
                            <rect x="1" y="3" width="22" height="5"></rect>
                            <line x1="10" y1="12" x2="14" y2="12"></line>
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Email Body */}
                  <div className="reader-body">
                    <div className="email-message-container">
                      {emailView === 'inbox' ? (
                        <div
                          dangerouslySetInnerHTML={{
                            __html: (() => {
                              // Handle both Gmail (string) and Outlook (object) body formats
                              let bodyContent = '';

                              if (selectedEmail?.body) {
                                if (typeof selectedEmail.body === 'string') {
                                  // Gmail format: plain string
                                  bodyContent = selectedEmail.body;
                                } else if (selectedEmail.body.content) {
                                  // Outlook format: { content: "...", contentType: "html" }
                                  bodyContent = selectedEmail.body.content;
                                }
                              }

                              // If no body content, use preview/snippet
                              if (!bodyContent) {
                                bodyContent = `<p>${selectedEmail?.preview || selectedEmail?.snippet || selectedEmail?.bodyPreview || 'No content'}</p>`;
                              }

                              // Sanitize HTML
                              return bodyContent
                                .replace(/<style[\s\S]*?<\/style>/gi, '')
                                .replace(/<script[\s\S]*?<\/script>/gi, '');
                            })()
                          }}
                        />
                      ) : (
                        <>
                          <p>{draftedEmails[0].preview}</p>
                          <p>I wanted to follow up on our previous discussion regarding this topic. Based on the action items we identified, I believe we should schedule some time to review the progress and align on next steps.</p>
                          <p>Please let me know your availability for a quick sync this week.</p>
                          <br />
                          <p>Best regards,<br />Your Name</p>
                        </>
                      )}
                    </div>

                    {/* Source indicator for Inbox or AI Context for Drafts */}
                    {emailView === 'inbox' ? (
                      <div className="email-ai-context" style={{ opacity: 0.6, fontSize: '12px' }}>
                        {selectedEmail?.timeDisplay}
                      </div>
                    ) : (
                      <div className="email-ai-context">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
                        </svg>
                        <span>{draftedEmails[0].context}</span>
                      </div>
                    )}
                  </div>

                  {/* Footer */}
                  {emailView === 'drafts' && (
                    <div className="reader-footer">
                      <div className="footer-left">
                        <button className="footer-action">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                          </svg>
                          Edit Draft
                        </button>
                        <div className="auto-save-indicator">Saved · just now</div>
                      </div>
                      <div className="footer-right">
                        <button className="btn-send-primary">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="22" y1="2" x2="11" y2="13"></line>
                            <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                          </svg>
                          Send
                        </button>
                      </div>
                    </div>
                  )}
                </div>
                  </>
                ) : (
                  <div style={{ 
                    display: 'flex', 
                    flexDirection: 'column',
                    alignItems: 'center', 
                    justifyContent: 'center',
                    height: '100%',
                    color: '#86868b',
                    padding: '40px'
                  }}>
                    <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: '16px', opacity: 0.3 }}>
                      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                      <polyline points="22,6 12,13 2,6"></polyline>
                    </svg>
                    <p style={{ margin: '0 0 8px', fontSize: '16px', fontWeight: 600 }}>Select an email to read</p>
                    <p style={{ margin: 0, fontSize: '13px', opacity: 0.7 }}>
                      No emails selected
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* New Meeting Modal */}
      {showNewMeetingModal && (
        <NewMeetingModal
          onClose={() => {
            setShowNewMeetingModal(false);
            setSelectedMeetingEvent(null);
          }}
          onCreate={handleCreateMeeting}
          serviceConnected={microsoftConnected || googleConnected}
          serviceName={microsoftConnected ? 'Microsoft Teams' : 'Google Meet'}
          initialData={selectedMeetingEvent}
        />
      )}

      {/* Meeting Detail Modal */}
      {selectedMeetingEvent && (
        <MeetingDetailModal
          event={selectedMeetingEvent}
          onClose={() => setSelectedMeetingEvent(null)}
        />
      )}

      {/* AI Follow Up Modal */}
      {showAIFollowUpModal && (
        <AIFollowUpModal
          selectedEmail={selectedEmail}
          aiDraftContent={aiDraftContent}
          generatingDraft={generatingDraft}
          onClose={() => setShowAIFollowUpModal(false)}
          onSend={async (draft) => {
            try {
              console.log('Sending draft:', draft);

              // Determine which service to use based on email source
              const isGmail = selectedEmail.source === 'gmail';
              const replySubject = selectedEmail.subject?.startsWith('Re:')
                ? selectedEmail.subject
                : `Re: ${selectedEmail.subject || '(No subject)'}`;

              const emailData = {
                to: selectedEmail.senderEmail || selectedEmail.from,
                subject: replySubject,
                body: draft
              };

              // Add threading info for Gmail
              if (isGmail) {
                if (selectedEmail.threadId) {
                  emailData.threadId = selectedEmail.threadId;
                }
                // Note: inReplyTo and references headers would need to be extracted from the original email headers
              } else {
                // For Outlook, include messageId for reply threading
                if (selectedEmail.id) {
                  emailData.messageId = selectedEmail.id;
                }
              }

              // Send via appropriate service
              let result;
              if (isGmail) {
                result = await window.electronAPI.google.sendEmail(emailData);
              } else {
                result = await window.electronAPI.microsoft.sendEmail(emailData);
              }

              if (result.success) {
                console.log('Email sent successfully!');
                setShowAIFollowUpModal(false);
                // Optionally show success message
                setError(null);
              } else {
                throw new Error(result.error || 'Failed to send email');
              }

            } catch (error) {
              console.error('Failed to send email:', error);
              setError('Failed to send email: ' + error.message);
            }
          }}
        />
      )}
    </div>
  );
}

// New Meeting Modal Component
function NewMeetingModal({ onClose, onCreate, serviceConnected, serviceName, initialData }) {
  const [formData, setFormData] = useState({
    title: initialData?.title || '',
    startTime: '',
    endTime: '',
    attendees: initialData?.attendees?.join(', ') || '',
    description: initialData?.reason || '',
    includeTeamsLink: true
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onCreate(formData);
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  // Set default times (1 hour from now, 30 min duration)
  const getDefaultTimes = () => {
    const now = new Date();
    const start = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour from now
    const end = new Date(start.getTime() + 30 * 60 * 1000); // 30 min duration
    
    return {
      startTime: start.toISOString().slice(0, 16),
      endTime: end.toISOString().slice(0, 16)
    };
  };

  // Initialize with default times if not set
  if (!formData.startTime && !formData.endTime) {
    const defaults = getDefaultTimes();
    setFormData({
      ...formData,
      ...defaults
    });
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>New Meeting</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-group">
            <label>Meeting Title *</label>
            <input
              type="text"
              name="title"
              value={formData.title}
              onChange={handleChange}
              placeholder="e.g., Team Standup"
              required
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Start Time *</label>
              <input
                type="datetime-local"
                name="startTime"
                value={formData.startTime}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-group">
              <label>End Time *</label>
              <input
                type="datetime-local"
                name="endTime"
                value={formData.endTime}
                onChange={handleChange}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label>Attendees (comma-separated emails)</label>
            <input
              type="text"
              name="attendees"
              value={formData.attendees}
              onChange={handleChange}
              placeholder="sarah@example.com, mike@example.com"
            />
            <small style={{ color: '#86868b', fontSize: '11px', marginTop: '4px', display: 'block' }}>
              Separate multiple email addresses with commas
            </small>
          </div>

          <div className="form-group">
            <label>Description</label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              placeholder="Add meeting agenda or notes..."
              rows="3"
            />
          </div>

          <div className="form-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                name="includeTeamsLink"
                checked={formData.includeTeamsLink}
                onChange={(e) => setFormData({ ...formData, includeTeamsLink: e.target.checked })}
              />
              <span>Include {serviceName} link</span>
            </label>
          </div>

          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-primary">
              Create Meeting
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// AI Follow Up Modal Component
function AIFollowUpModal({ selectedEmail, aiDraftContent, generatingDraft, onClose, onSend }) {
  const [editedDraft, setEditedDraft] = useState('');

  // Update edited draft when AI content changes
  useEffect(() => {
    if (aiDraftContent) {
      setEditedDraft(aiDraftContent);
    }
  }, [aiDraftContent]);

  const handleSend = () => {
    onSend(editedDraft);
  };

  // Extract subject for the reply
  const replySubject = selectedEmail?.subject?.startsWith('Re:')
    ? selectedEmail.subject
    : `Re: ${selectedEmail?.subject || '(No subject)'}`;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content ai-follow-up-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '8px', verticalAlign: 'middle' }}>
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
            </svg>
            AI Follow Up Draft
          </h2>
          <button className="modal-close" onClick={onClose}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <div className="modal-body">
          {/* Original Email Context */}
          <div className="original-email-context">
            <div className="context-label">In reply to:</div>
            <div className="context-from">
              <strong>{selectedEmail?.senderName || 'Unknown Sender'}</strong>
              {selectedEmail?.senderEmail && <span className="email-addr"> &lt;{selectedEmail.senderEmail}&gt;</span>}
            </div>
            <div className="context-subject">{selectedEmail?.subject || '(No subject)'}</div>
          </div>

          {/* Draft Subject */}
          <div className="form-group">
            <label>Subject</label>
            <input
              type="text"
              value={replySubject}
              readOnly
              className="subject-input"
            />
          </div>

          {/* Draft Content */}
          <div className="form-group draft-editor">
            <label>Message</label>
            {generatingDraft ? (
              <div className="generating-draft">
                <div className="spinner-container">
                  <div className="spinner"></div>
                </div>
                <p>AI is drafting your follow-up...</p>
              </div>
            ) : (
              <textarea
                value={editedDraft}
                onChange={(e) => setEditedDraft(e.target.value)}
                placeholder="AI-generated draft will appear here..."
                rows="12"
                className="draft-textarea"
              />
            )}
          </div>
        </div>

        <div className="modal-actions">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn-send-primary"
            onClick={handleSend}
            disabled={generatingDraft || !editedDraft.trim()}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13"></line>
              <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
            </svg>
            Send Reply
          </button>
        </div>
      </div>
    </div>
  );
}

// Meeting Detail Modal Component
function MeetingDetailModal({ event, onClose }) {
  if (!event) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content meeting-detail-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="meeting-detail-header">
          <div className="meeting-detail-title-row">
            <h2 className="meeting-detail-title">{event.title}</h2>
            <span className="meeting-detail-badge">PRIORITY</span>
          </div>
          <div className="meeting-detail-meta">
            <div className="meeting-detail-meta-row">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <polyline points="12 6 12 12 16 14"></polyline>
              </svg>
              {event.time} • {event.duration}
            </div>
            <div className="meeting-detail-meta-row">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 10l-4 4 6 6 4-4-6-6z"></path>
                <path d="M2 10l6-6 4 4-6 6-4-4z"></path>
              </svg>
              {event.location}
            </div>
          </div>
        </div>

        {/* Attendees */}
        <div className="meeting-detail-attendees">
          <div className="meeting-detail-attendees-label">Attendees</div>
          <div className="meeting-detail-attendees-list">
            {event.attendees.map((attendee, idx) => (
              <div key={idx} className="attendee-avatar" title={attendee}>
                {attendee.split(' ').map(n => n[0]).join('')}
              </div>
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="meeting-detail-body">
          {/* AI Insight */}
          <div className="meeting-detail-section">
            <div className="meeting-detail-section-title">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
              </svg>
              AI INSIGHT
            </div>
            <div className="ai-insight-card">
              Review sprint velocity before call - currently 15% below target
            </div>
          </div>

          {/* Related Items */}
          <div className="meeting-detail-section">
            <div className="meeting-detail-section-title">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
              </svg>
              RELATED ITEMS
            </div>
            <div className="related-items-list">
              <div className="related-item">
                <div className="related-item-icon">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                    <polyline points="14 2 14 8 20 8"></polyline>
                  </svg>
                </div>
                <div className="related-item-content">
                  <div className="related-item-title">Standup agenda from Shail</div>
                  <div className="related-item-time">11:41 AM</div>
                </div>
              </div>
              <div className="related-item">
                <div className="related-item-icon">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                    <polyline points="14 2 14 8 20 8"></polyline>
                  </svg>
                </div>
                <div className="related-item-content">
                  <div className="related-item-title">Sprint progress notes</div>
                  <div className="related-item-time">Yesterday</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="meeting-detail-footer">
          <div className="meeting-detail-footer-left">
            <button className="meeting-detail-action-btn" onClick={onClose}>
              Close
            </button>
          </div>
          <button className="meeting-detail-join-btn" onClick={() => event.meetingLink && window.open(event.meetingLink)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15.5 1.5a.5.5 0 0 0-.5.5v3.5a.5.5 0 0 0 .5.5h3.5a.5.5 0 0 0 .5-.5v-3.5a.5.5 0 0 0-.5-.5h-3.5z"></path>
              <path d="M3 3.5A1.5 1.5 0 0 1 4.5 2h9A1.5 1.5 0 0 1 15 3.5v13a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 3 16.5v-13z"></path>
            </svg>
            Join Meeting
          </button>
        </div>
      </div>
    </div>
  );
}

