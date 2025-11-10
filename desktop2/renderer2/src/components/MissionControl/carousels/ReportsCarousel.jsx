import { useState } from 'react';
import './ReportsCarousel.css';

/**
 * ReportsCarousel - Displays reports and metrics with generate button
 */
export default function ReportsCarousel({ reports, user }) {
  const [showModal, setShowModal] = useState(false);
  const [reportType, setReportType] = useState('person');
  const [entityId, setEntityId] = useState('');
  const [generatedReport, setGeneratedReport] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState(null);

  const handleGenerateReport = async () => {
    if (!entityId.trim()) {
      setError('Please enter an entity ID');
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      const result = await window.electronAPI.reporting.generateReport(reportType, entityId, {});
      
      if (result.success) {
        setGeneratedReport(result.report);
        setError(null);
      } else {
        setError(result.error || 'Failed to generate report');
        setGeneratedReport(null);
      }
    } catch (err) {
      setError(err.message || 'Failed to generate report');
      setGeneratedReport(null);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEntityId('');
    setGeneratedReport(null);
    setError(null);
  };

  const getPlaceholder = () => {
    switch (reportType) {
      case 'person':
        return 'Enter email (e.g., john@company.com)';
      case 'team':
        return 'Enter project key (e.g., PROJ)';
      case 'unit':
        return 'Enter project keys (e.g., PROJ1,PROJ2)';
      case 'feature':
        return 'Enter epic key (e.g., PROJ-123)';
      default:
        return 'Enter entity ID';
    }
  };

  const renderMetrics = (metrics) => {
    if (!metrics) return null;

    return (
      <div className="report-metrics">
        {Object.entries(metrics).map(([key, value]) => {
          // Skip complex objects
          if (typeof value === 'object' && value !== null) {
            return null;
          }

          // Format key name
          const label = key
            .replace(/([A-Z])/g, ' $1')
            .replace(/^./, str => str.toUpperCase())
            .trim();

          return (
            <div key={key} className="metric-item">
              <span className="metric-label">{label}:</span>
              <span className="metric-value">{value}</span>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="reports-carousel-container">
      <div className="reports-header">
        <h3>Reports & Analytics</h3>
        <button 
          className="generate-report-btn"
          onClick={() => setShowModal(true)}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
          Generate Report
        </button>
      </div>

      {!generatedReport ? (
        <div className="carousel-empty">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <line x1="18" y1="20" x2="18" y2="10"></line>
            <line x1="12" y1="20" x2="12" y2="4"></line>
            <line x1="6" y1="20" x2="6" y2="14"></line>
          </svg>
          <p>No Reports Generated Yet</p>
          <span className="empty-hint">Click "Generate Report" to create analytics</span>
        </div>
      ) : (
        <div className="report-display">
          <div className="report-header">
            <h4>{generatedReport.entityName}</h4>
            <span className="report-type-badge">{generatedReport.reportType}</span>
          </div>
          
          <div className="report-summary">
            <p>{generatedReport.summary}</p>
          </div>

          {renderMetrics(generatedReport.metrics)}

          <div className="report-meta">
            <span>Generated: {new Date(generatedReport.generatedAt).toLocaleString()}</span>
            <span>Period: {generatedReport.period?.start} to {generatedReport.period?.end}</span>
          </div>
        </div>
      )}

      {/* Generate Report Modal */}
      {showModal && (
        <div className="report-modal-overlay" onClick={handleCloseModal}>
          <div className="report-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Generate Report</h3>
              <button className="close-btn" onClick={handleCloseModal}>×</button>
            </div>

            <div className="modal-body">
              <div className="form-group">
                <label>Report Type</label>
                <select 
                  value={reportType} 
                  onChange={(e) => {
                    setReportType(e.target.value);
                    setEntityId('');
                    setError(null);
                  }}
                  disabled={isGenerating}
                >
                  <option value="person">👤 Person Level - Individual metrics</option>
                  <option value="team">👥 Team Level - Team performance</option>
                  <option value="unit">🏢 Unit Level - Organizational metrics</option>
                  <option value="feature">🎯 Feature Level - Project tracking</option>
                </select>
              </div>

              <div className="form-group">
                <label>Entity ID</label>
                <input
                  type="text"
                  value={entityId}
                  onChange={(e) => setEntityId(e.target.value)}
                  placeholder={getPlaceholder()}
                  disabled={isGenerating}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      handleGenerateReport();
                    }
                  }}
                />
                <span className="input-hint">
                  {reportType === 'person' && 'Enter the email address of the person'}
                  {reportType === 'team' && 'Enter the JIRA project key (e.g., SCRUM)'}
                  {reportType === 'unit' && 'Enter comma-separated project keys (e.g., PROJ1,PROJ2,PROJ3)'}
                  {reportType === 'feature' && 'Enter the JIRA epic key (e.g., PROJ-123)'}
                </span>
              </div>

              {error && (
                <div className="error-message">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="8" x2="12" y2="12"></line>
                    <line x1="12" y1="16" x2="12.01" y2="16"></line>
                  </svg>
                  {error}
                </div>
              )}

              <div className="modal-actions">
                <button 
                  className="btn-cancel" 
                  onClick={handleCloseModal}
                  disabled={isGenerating}
                >
                  Cancel
                </button>
                <button 
                  className="btn-generate" 
                  onClick={handleGenerateReport}
                  disabled={isGenerating || !entityId.trim()}
                >
                  {isGenerating ? (
                    <>
                      <span className="spinner"></span>
                      Generating...
                    </>
                  ) : (
                    'Generate Report'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
