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
  
  // Additional context for report generation
  const [confluenceLinks, setConfluenceLinks] = useState([]);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [confluenceLinkInput, setConfluenceLinkInput] = useState('');

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

  // Handle file upload
  const handleFileUpload = async (files) => {
    const fileArray = Array.from(files);
    
    const validFiles = [];
    for (const file of fileArray) {
      const validTypes = ['.pdf', '.doc', '.docx', '.txt', '.md'];
      const ext = '.' + file.name.split('.').pop().toLowerCase();
      const maxSize = 10 * 1024 * 1024; // 10MB
      
      if (!validTypes.includes(ext)) {
        alert(`Invalid file type: ${file.name}. Allowed: PDF, DOC, DOCX, TXT, MD`);
        continue;
      }
      if (file.size > maxSize) {
        alert(`File too large: ${file.name} (max 10MB)`);
        continue;
      }
      validFiles.push(file);
    }
    
    const processedFiles = await Promise.all(
      validFiles.map(file => new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve({
          name: file.name,
          size: file.size,
          type: file.type,
          content: e.target.result
        });
        reader.readAsDataURL(file);
      }))
    );
    
    setUploadedFiles([...uploadedFiles, ...processedFiles]);
  };

  const handleAddConfluenceLink = () => {
    const link = confluenceLinkInput.trim();
    if (!link) return;
    
    if (!link.includes('atlassian.net/wiki') && !link.includes('confluence')) {
      alert('Please enter a valid Confluence URL');
      return;
    }
    
    setConfluenceLinks([...confluenceLinks, link]);
    setConfluenceLinkInput('');
  };

  const handleRemoveConfluenceLink = (index) => {
    setConfluenceLinks(confluenceLinks.filter((_, i) => i !== index));
  };

  const handleRemoveFile = (index) => {
    setUploadedFiles(uploadedFiles.filter((_, i) => i !== index));
  };

  const handleCloseReportModal = () => {
    setShowReportModal(false);
    setSelectedTaskForReport(null);
    setConfluenceLinks([]);
    setUploadedFiles([]);
    setConfluenceLinkInput('');
  };

  const handleGenerateReportSubmit = async (reportType) => {
    if (!selectedTaskForReport) return;

    const entityId = reportType === 'feature' 
      ? (selectedTaskForReport.external_key || selectedTaskForReport.externalKey)
      : user?.email || 'user@company.com';

    const task = selectedTaskForReport;
    setShowReportModal(false);
    setSelectedTaskForReport(null);

    try {
      // Include additional context in options
      const options = {
        additionalConfluenceLinks: confluenceLinks,
        uploadedFiles: uploadedFiles
      };
      
      const result = await window.electronAPI.reporting.generateReport(reportType, entityId, options);
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
    } finally {
      // Clear context after generation
      setConfluenceLinks([]);
      setUploadedFiles([]);
      setConfluenceLinkInput('');
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

              {/* Epic Badge */}
              {(task.epic_name || task.workflow_metadata?.epic_name) && (
                <div className="jira-epic-badge">
                  📋 {task.epic_name || task.workflow_metadata?.epic_name}
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
        <div className="report-modal-overlay" onClick={handleCloseReportModal}>
          <div className="report-modal-enhanced" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h4>Generate Report</h4>
              <button className="close-btn" onClick={handleCloseReportModal}>×</button>
            </div>
            
            <div className="modal-body">
              <p className="modal-task-info">
                <strong>{selectedTaskForReport?.external_key || selectedTaskForReport?.externalKey}</strong> - {selectedTaskForReport?.title || selectedTaskForReport?.session_title}
              </p>

              {/* Report Type Selection - Only Feature Report */}
              <div className="report-type-section">
                <label>Generate Feature Report</label>
                <p className="report-type-description">
                  Generate a comprehensive report for this epic including progress, timeline, and documentation.
                </p>
              </div>

              {/* Additional Confluence Pages */}
              <div className="form-group">
                <label>📄 Additional Confluence Pages (Optional)</label>
                <div className="input-with-button">
                  <input
                    type="text"
                    value={confluenceLinkInput}
                    onChange={(e) => setConfluenceLinkInput(e.target.value)}
                    placeholder="https://your-domain.atlassian.net/wiki/spaces/..."
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddConfluenceLink();
                      }
                    }}
                  />
                  <button
                    type="button"
                    className="add-link-btn"
                    onClick={handleAddConfluenceLink}
                    disabled={!confluenceLinkInput.trim()}
                  >
                    Add
                  </button>
                </div>
                {confluenceLinks.length > 0 && (
                  <div className="link-chips">
                    {confluenceLinks.map((link, idx) => (
                      <div key={idx} className="chip">
                        <span className="chip-text" title={link}>
                          {link.split('/').pop().substring(0, 30)}...
                        </span>
                        <button
                          type="button"
                          className="chip-remove"
                          onClick={() => handleRemoveConfluenceLink(idx)}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <span className="input-hint">
                  Add Confluence page URLs for additional context
                </span>
              </div>

              {/* File Upload */}
              <div className="form-group">
                <label>📎 Upload Context Files (Optional)</label>
                <input
                  type="file"
                  accept=".pdf,.doc,.docx,.txt,.md"
                  multiple
                  onChange={(e) => handleFileUpload(e.target.files)}
                  className="file-input"
                />
                {uploadedFiles.length > 0 && (
                  <div className="file-chips">
                    {uploadedFiles.map((file, idx) => (
                      <div key={idx} className="chip">
                        <span className="chip-text">
                          {file.name} ({(file.size / 1024).toFixed(1)} KB)
                        </span>
                        <button
                          type="button"
                          className="chip-remove"
                          onClick={() => handleRemoveFile(idx)}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <span className="input-hint">
                  PDF, DOC, DOCX, TXT, MD files supported (max 10MB each)
                </span>
              </div>
            </div>

            <div className="modal-footer">
              <button className="modal-cancel" onClick={handleCloseReportModal}>Cancel</button>
              <button className="modal-generate" onClick={() => handleGenerateReportSubmit('feature')}>
                🎯 Generate Feature Report
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
