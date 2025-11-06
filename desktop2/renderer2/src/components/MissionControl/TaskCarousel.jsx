import JiraTaskCarousel from './carousels/JiraTaskCarousel';
import CalendarCarousel from './carousels/CalendarCarousel';
import UniboxCarousel from './carousels/UniboxCarousel';
import ReportsCarousel from './carousels/ReportsCarousel';
import WidgetsCarousel from './carousels/WidgetsCarousel';
import './TaskCarousel.css';

/**
 * TaskCarousel - Switches carousel content based on active tab
 * 
 * Renders different carousel components for:
 * - jira-progress: JIRA tasks
 * - calendar: Calendar events
 * - unibox: Emails
 * - reports: Reports and metrics
 * - widgets: Custom widgets
 */
export default function TaskCarousel({ activeTab, allTabsData, onTaskSelect, user }) {
  const { jiraTasks, calendarEvents, emails, reports, widgets, loading } = allTabsData;

  if (loading) {
    return (
      <div className="carousel-loading">
        <div className="loading-spinner"></div>
        <p>Loading data...</p>
      </div>
    );
  }

  switch (activeTab) {
    case 'jira-progress':
      return (
        <JiraTaskCarousel
          tasks={jiraTasks}
          onTaskSelect={onTaskSelect}
          user={user}
        />
      );

    case 'calendar':
      return (
        <CalendarCarousel
          events={calendarEvents}
          onEventSelect={onTaskSelect}
          user={user}
        />
      );

    case 'unibox':
      return (
        <UniboxCarousel
          onSelectMessage={onTaskSelect}
          user={user}
        />
      );

    case 'reports':
      return (
        <ReportsCarousel
          reports={reports}
          user={user}
        />
      );

    case 'widgets':
      return (
        <WidgetsCarousel
          widgets={widgets}
          user={user}
        />
      );

    default:
      return (
        <JiraTaskCarousel
          tasks={jiraTasks}
          onTaskSelect={onTaskSelect}
          user={user}
        />
      );
  }
}

