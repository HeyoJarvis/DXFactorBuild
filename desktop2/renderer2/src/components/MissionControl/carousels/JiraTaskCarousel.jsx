import { useState, useEffect } from 'react';
import './JiraTaskCarousel.css';

/**
 * JiraTaskCarousel - Overlapping card carousel for JIRA tasks
 * 
 * Features:
 * - 5 overlapping cards visible at once
 * - Left/right navigation
 * - Click any card to select and open detail view
 * - Smooth animations and transforms
 */
export default function JiraTaskCarousel({ tasks, onTaskSelect, user }) {
  const [currentIndex, setCurrentIndex] = useState(0);

  // Ensure we have tasks
  const taskList = tasks || [];

  const handlePrev = () => {
    setCurrentIndex(prev => Math.max(0, prev - 1));
  };

  const handleNext = () => {
    setCurrentIndex(prev => Math.min(taskList.length - 1, prev + 1));
  };

  const handleCardClick = (task, index) => {
    // Bring clicked card to front
    setCurrentIndex(currentIndex + index);
    // Open detail view
    if (onTaskSelect) {
      onTaskSelect(task);
    }
  };

  if (!taskList || taskList.length === 0) {
    return (
      <div className="jira-carousel-empty">
        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
          <line x1="9" y1="9" x2="15" y2="9"></line>
          <line x1="9" y1="15" x2="15" y2="15"></line>
        </svg>
        <p>No JIRA tasks found</p>
        <span className="empty-hint">Tasks will appear here when assigned</span>
      </div>
    );
  }

  // Get 5 visible cards starting from currentIndex
  const visibleTasks = taskList.slice(currentIndex, currentIndex + 5);

  return (
    <div className="jira-task-carousel">
      {/* Left Navigation */}
      <button 
        onClick={handlePrev} 
        disabled={currentIndex === 0} 
        className="carousel-nav-btn left"
        aria-label="Previous task"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="15 18 9 12 15 6"></polyline>
        </svg>
      </button>

      {/* Carousel Cards Container */}
      <div className="carousel-cards-container">
        {visibleTasks.map((task, index) => (
          <div
            key={task.id || index}
            className="carousel-card-wrapper"
            style={{
              zIndex: 5 - index,
              transform: `translateX(${index * 60}px) scale(${1 - index * 0.05})`,
              opacity: 1 - index * 0.15
            }}
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
            </div>
          </div>
        ))}
      </div>

      {/* Right Navigation */}
      <button 
        onClick={handleNext} 
        disabled={currentIndex >= taskList.length - 1} 
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
          {currentIndex + 1} / {taskList.length}
        </div>
      )}
    </div>
  );
}
