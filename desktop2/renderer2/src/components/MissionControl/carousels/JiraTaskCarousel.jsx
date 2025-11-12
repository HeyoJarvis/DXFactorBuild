import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './JiraTaskCarousel.css';
import SlimHeader from '../common/SlimHeader';

/**
 * JiraTaskCarousel - Overlapping card carousel for JIRA tasks
 *
 * Features:
 * - 5 overlapping cards visible at once
 * - Left/right navigation
 * - Click any card to select and open detail view
 * - Smooth animations and transforms
 * - Generate Report button on each card
 */
export default function JiraTaskCarousel({ tasks, onTaskSelect, user }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showReportModal, setShowReportModal] = useState(false);
  const [selectedTaskForReport, setSelectedTaskForReport] = useState(null);
  const navigate = useNavigate();

  // Teams functionality hidden - no longer used
  // const handleTeamsClick = () => {
  //   navigate('/mission-control?mode=team');
  // };

  const handleSettingsClick = () => {
    // Navigate to Settings page
    navigate('/settings');
  };

  // Ensure we have tasks
  const taskList = tasks || [];

  const handlePrev = () => {
    // Allow going back until the first card is in the center (position 3)
    // This means currentIndex can go to -2 (so first card appears at index 2 of visible array)
    setCurrentIndex(prev => Math.max(-2, prev - 1));
  };

  const handleNext = () => {
    // Allow going forward until the last card is in the center (position 3)
    // Last card is at index taskList.length - 1
    // To center it at position 2, currentIndex should be (taskList.length - 1) - 2 = taskList.length - 3
    setCurrentIndex(prev => Math.min(taskList.length - 3, prev + 1));
  };

  const handleCardClick = (task, index) => {
    // Bring clicked card to center (position 3, which is index 2)
    // Calculate the new currentIndex so this card ends up at position 2
    const newIndex = currentIndex + index - 2;
    setCurrentIndex(newIndex);
    // Open detail view
    if (onTaskSelect) {
      onTaskSelect(task);
    }
  };

  const handleGenerateReport = (e, task) => {
    e.stopPropagation(); // Prevent card click
    setSelectedTaskForReport(task);
    setShowReportModal(true);
  };

  const handleGenerateReportSubmit = async (reportType) => {
    if (!selectedTaskForReport) return;

    const entityId = reportType === 'feature' 
      ? (selectedTaskForReport.external_key || selectedTaskForReport.externalKey)
      : user?.email || 'user@company.com';

    setShowReportModal(false);
    const task = selectedTaskForReport;
    setSelectedTaskForReport(null);

    try {
      const result = await window.electronAPI.reporting.generateReport(reportType, entityId, {});
      if (result.success) {
        // Add the report to the task chat
        await window.electronAPI.tasks.sendChatMessage(task.id, result.report.summary, 'report');
        
        // Open the task detail view (which will load the new report message)
        onTaskSelect(task);
      } else {
        alert(`❌ Failed to generate report: ${result.error}`);
      }
    } catch (error) {
      alert(`❌ Error: ${error.message}`);
    }
  };

  if (!taskList || taskList.length === 0) {
    return (
      <div className="jira-carousel-wrapper">
        <SlimHeader
          title="Jira Progress"
          onTeamsClick={null}
          onSettingsClick={handleSettingsClick}
        />
        <div className="jira-carousel-empty">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
            <line x1="9" y1="9" x2="15" y2="9"></line>
            <line x1="9" y1="15" x2="15" y2="15"></line>
          </svg>
          <p>No JIRA tasks found</p>
          <span className="empty-hint">Tasks will appear here when assigned</span>
        </div>
      </div>
    );
  }

  // Get 5 visible cards, handling negative indices by padding with nulls
  const getVisibleTasks = () => {
    const visible = [];
    for (let i = 0; i < 5; i++) {
      const taskIndex = currentIndex + i;
      if (taskIndex >= 0 && taskIndex < taskList.length) {
        visible.push(taskList[taskIndex]);
      } else {
        visible.push(null); // Empty slot
      }
    }
    return visible;
  };
  
  const visibleTasks = getVisibleTasks();

  return (
    <div className="jira-carousel-wrapper">
      <SlimHeader
        title="Jira Progress"
        onTeamsClick={null}
        onSettingsClick={handleSettingsClick}
      />
      <div className="jira-task-carousel">
      {/* Left Navigation */}
      <button 
        onClick={handlePrev} 
        disabled={currentIndex <= -2} 
        className="carousel-nav-btn left"
        aria-label="Previous task"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="15 18 9 12 15 6"></polyline>
        </svg>
      </button>

      {/* Carousel Cards Container */}
      <div className="carousel-cards-container">
        {visibleTasks.map((task, index) => {
          // Skip rendering if task is null (empty slot)
          if (!task) {
            return <div key={`empty-${index}`} className="carousel-card-wrapper" style={{ opacity: 0, pointerEvents: 'none' }} />;
          }
          
          return (
            <div
              key={task.id || index}
              className="carousel-card-wrapper"
              onClick={() => handleCardClick(task, index)}
            >
              <div className="jira-card">
              {/* Card Header */}
              <div className="jira-card-header">
                <span className="jira-key">{task.externalKey || task.external_key || 'TASK'}</span>
                <span className={`jira-priority priority-${(task.priority || 'medium').toLowerCase()}`}>
                  {task.priority || 'Medium'}
                </span>
              </div>

              {/* Card Title */}
              <h3 className="jira-card-title">
                {task.title || task.session_title || 'Untitled Task'}
              </h3>

              {/* Card Meta */}
              <div className="jira-card-meta">
                {task.jira_status && (
                  <div className="meta-item">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10"></circle>
                      <polyline points="12 6 12 12 16 14"></polyline>
                    </svg>
                    <span>{task.jira_status}</span>
                  </div>
                )}
                {task.story_points && (
                  <div className="meta-item">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"></path>
                    </svg>
                    <span>{task.story_points} pts</span>
                  </div>
                )}
                {task.jira_issue_type && (
                  <div className="meta-item">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                    </svg>
                    <span>{task.jira_issue_type}</span>
                  </div>
                )}
              </div>

              {/* Sprint Badge */}
              {task.sprint && (
                <div className="jira-sprint-badge">
                  {task.sprint}
                </div>
              )}

              {/* Generate Report Button */}
              <button 
                className="generate-report-card-btn"
                onClick={(e) => handleGenerateReport(e, task)}
                title="Generate Report"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="20" x2="18" y2="10"></line>
                  <line x1="12" y1="20" x2="12" y2="4"></line>
                  <line x1="6" y1="20" x2="6" y2="14"></line>
                </svg>
                Report
              </button>
            </div>
          </div>
        );
        })}
      </div>

      {/* Right Navigation */}
      <button 
        onClick={handleNext} 
        disabled={currentIndex >= taskList.length - 3} 
        className="carousel-nav-btn right"
        aria-label="Next task"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="9 18 15 12 9 6"></polyline>
        </svg>
      </button>

      {/* Progress Indicator */}
      {taskList.length > 1 && (
        <div className="carousel-progress">
          {Math.max(1, Math.min(taskList.length, currentIndex + 3))} / {taskList.length}
        </div>
      )}
      </div>

      {/* Report Generation Modal */}
      {showReportModal && (
        <div className="report-modal-overlay" onClick={() => setShowReportModal(false)}>
          <div className="report-modal-compact" onClick={(e) => e.stopPropagation()}>
            <h4>Generate Report</h4>
            <p className="modal-task-info">
              {selectedTaskForReport?.external_key || selectedTaskForReport?.externalKey} - {selectedTaskForReport?.title || selectedTaskForReport?.session_title}
            </p>
            <div className="report-type-buttons">
              <button onClick={() => handleGenerateReportSubmit('person')}>
                👤 Person Report
              </button>
              <button onClick={() => handleGenerateReportSubmit('feature')}>
                🎯 Feature Report
              </button>
            </div>
            <button className="modal-cancel" onClick={() => setShowReportModal(false)}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
