import { useState } from 'react';
import KPICard from './KPICard';
import Widget from './Widget';
import WidgetPicker from './WidgetPicker';
import useDashboardMetrics from '../../hooks/useDashboardMetrics';
import './Dashboard.css';

/**
 * Dashboard - Main dashboard view with KPIs and sticky notes
 * Shown in MissionControl when no task is selected
 * 
 * @param {Object} user - Current user object
 */
export default function Dashboard({ user }) {
  const { metrics, loading } = useDashboardMetrics(user?.id, 7);
  
  // Widgets state (renamed from sticky notes)
  const [widgets, setWidgets] = useState(() => {
    const stored = localStorage.getItem('dashboardWidgets');
    return stored ? JSON.parse(stored) : [];
  });

  // Widget picker state
  const [showPicker, setShowPicker] = useState(false);
  const [pickerPosition, setPickerPosition] = useState({ x: 0, y: 0 });

  const handleAddWidget = (e) => {
    // Only create sticky note if clicking on dashboard background
    if (e.target.classList.contains('dashboard-content') || 
        e.target.classList.contains('widgets-container')) {
      // Get the dashboard-content element's bounding box
      const dashboardContent = e.currentTarget.querySelector('.dashboard-content') || e.currentTarget;
      const rect = dashboardContent.getBoundingClientRect();
      
      // Calculate position relative to dashboard-content
      const newWidget = {
        id: Date.now(),
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
        type: 'quick-note',
        config: {},
        color: getRandomColor(),
        createdAt: new Date().toISOString()
      };
      
      const updated = [...widgets, newWidget];
      setWidgets(updated);
      localStorage.setItem('dashboardWidgets', JSON.stringify(updated));
    }
  };

  const handleWidgetTypeSelected = (type) => {
    // Create widget at a default position (center-ish)
    const newWidget = {
      id: Date.now(),
      x: 100 + (widgets.length * 30), // Stagger widgets
      y: 100 + (widgets.length * 30),
      type: type,
      config: {},
      color: getRandomColor(),
      createdAt: new Date().toISOString()
    };
    
    const updated = [...widgets, newWidget];
    setWidgets(updated);
    localStorage.setItem('dashboardWidgets', JSON.stringify(updated));
    setShowPicker(false);
  };

  const handleUpdateWidget = (id, updates) => {
    const updated = widgets.map(widget => 
      widget.id === id ? { ...widget, ...updates } : widget
    );
    setWidgets(updated);
    localStorage.setItem('dashboardWidgets', JSON.stringify(updated));
  };

  const handleDeleteWidget = (id) => {
    const updated = widgets.filter(widget => widget.id !== id);
    setWidgets(updated);
    localStorage.setItem('dashboardWidgets', JSON.stringify(updated));
  };

  const getTimeOfDay = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'morning';
    if (hour < 18) return 'afternoon';
    return 'evening';
  };

  if (loading) {
    return (
      <div className="dashboard-loading">
        <div className="loading-spinner"></div>
        <p>Loading your dashboard...</p>
      </div>
    );
  }

  return (
    <div className="dashboard-view" onClick={handleAddWidget}>
      {/* Jarvis Avatar */}
      <div className="empty-icon-wrapper">
        <img src="/Jarvis.png" alt="Jarvis AI" className="empty-icon" />
      </div>

      {/* Welcome Header */}
      <div className="dashboard-header">
        <h2>Good {getTimeOfDay()}, {user?.name || 'there'}</h2>
        <p className="dashboard-subtitle">Here's your overview</p>
      </div>

      {/* Dashboard Content - Simplified */}
      <div className="dashboard-content">
        {/* Only 4 KPI Cards - Single Row - Now with real data */}
        <div className="kpi-cards-grid-simple">
          <KPICard
            value={metrics?.sprintProgress?.value || '0%'}
            label="Sprint Progress"
            trend={metrics?.sprintProgress?.trend}
            source={metrics?.sprintProgress?.source || 'jira'}
          />
          <KPICard
            value={metrics?.taskCompletionRate?.value || '0%'}
            label="Task Completion Rate"
            trend={metrics?.taskCompletionRate?.trend}
            source={metrics?.taskCompletionRate?.source || 'tasks'}
          />
          <KPICard
            value={metrics?.prsMerged?.value || 0}
            label="Issues Tracked"
            trend={metrics?.prsMerged?.trend}
            source={metrics?.prsMerged?.source || 'github'}
          />
          <KPICard
            value={metrics?.newTasksToday?.value || 0}
            label="Completed Today"
            trend={metrics?.newTasksToday?.trend}
            source={metrics?.newTasksToday?.source || 'tasks'}
          />
        </div>

        {/* Widgets Hint */}
        {widgets.length === 0 && (
          <div className="sticky-notes-hint">
            <em>Click anywhere to add a sticky note, or use the + button to add tracking widgets</em>
          </div>
        )}

        {/* Add Widget Button */}
        <button 
          className="add-widget-button"
          onClick={(e) => {
            e.stopPropagation();
            setShowPicker(true);
          }}
          title="Add tracking widget"
        >
          + Add Widget
        </button>

        {/* Widgets Container */}
        <div className="widgets-container">
          {widgets.map(widget => (
            <Widget
              key={widget.id}
              widget={widget}
              onUpdate={handleUpdateWidget}
              onDelete={handleDeleteWidget}
            />
          ))}
        </div>
      </div>

      {/* Widget Picker Modal */}
      {showPicker && (
        <WidgetPicker
          onSelect={handleWidgetTypeSelected}
          onClose={() => setShowPicker(false)}
        />
      )}
    </div>
  );
}

function getRandomColor() {
  const colors = [
    'rgb(254, 243, 199)', // Yellow
    'rgb(219, 234, 254)', // Blue
    'rgb(252, 231, 243)', // Pink
    'rgb(220, 252, 231)', // Green
    'rgb(243, 232, 255)', // Purple
  ];
  return colors[Math.floor(Math.random() * colors.length)];
}

