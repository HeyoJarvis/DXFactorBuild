import JiraTaskCarousel from './carousels/JiraTaskCarousel';
import JiraKanbanCarousel from './carousels/JiraKanbanCarousel';
import CalendarCarousel from './carousels/CalendarCarousel';
import UniboxCarousel from './carousels/UniboxCarousel';
import ReportsCarousel from './carousels/ReportsCarousel';
import WidgetsCarousel from './carousels/WidgetsCarousel';
import './TaskCarousel.css';

/**
 * TaskCarousel - Keeps all carousels mounted but shows/hides based on active tab
 *
 * This approach prevents unmounting/remounting and preserves state:
 * - jira-progress: JIRA tasks (Kanban for sales, Carousel for developers)
 * - calendar: Calendar events
 * - unibox: Emails
 * - reports: Reports and metrics
 * - widgets: Custom widgets
 */
export default function TaskCarousel({ activeTab, allTabsData, onTaskSelect, onUpdateTask, user }) {
  const { jiraTasks, calendarEvents, emails, reports, widgets, loading } = allTabsData;

  // Determine if user is a developer or sales
  const isDeveloper = user?.user_role === 'developer' || user?.role === 'developer';

  if (loading) {
    return (
      <div className="carousel-loading">
        <div className="loading-spinner"></div>
        <p>Loading data...</p>
      </div>
    );
  }

  return (
    <div className="task-carousel-container">
      {/* All carousels stay mounted, just hidden with CSS */}
      <div style={{ display: activeTab === 'jira-progress' ? 'block' : 'none', width: '100%', height: '100%' }}>
        {isDeveloper ? (
          <JiraTaskCarousel
            tasks={jiraTasks}
            onTaskSelect={onTaskSelect}
            user={user}
          />
        ) : (
          <JiraKanbanCarousel
            tasks={jiraTasks}
            onTaskSelect={onTaskSelect}
            onUpdateTask={onUpdateTask}
            user={user}
          />
        )}
      </div>

      <div style={{ display: activeTab === 'calendar' ? 'block' : 'none', width: '100%', height: '100%' }}>
        <CalendarCarousel
          events={calendarEvents}
          onEventSelect={onTaskSelect}
          user={user}
        />
      </div>

      <div style={{ display: activeTab === 'unibox' ? 'block' : 'none', width: '100%', height: '100%' }}>
        <UniboxCarousel
          onSelectMessage={onTaskSelect}
          user={user}
        />
      </div>

      <div style={{ display: activeTab === 'reports' ? 'block' : 'none', width: '100%', height: '100%' }}>
        <ReportsCarousel
          reports={reports}
          user={user}
        />
      </div>

      <div style={{ display: activeTab === 'widgets' ? 'block' : 'none', width: '100%', height: '100%' }}>
        <WidgetsCarousel
          widgets={widgets}
          user={user}
        />
      </div>
    </div>
  );
}

