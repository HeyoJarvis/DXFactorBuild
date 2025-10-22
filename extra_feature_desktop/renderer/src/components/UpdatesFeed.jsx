import React from 'react';
import './UpdatesFeed.css';

function UpdatesFeed({ updates }) {
  if (!updates || updates.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">📭</div>
        <h3 className="empty-state-title">No updates yet</h3>
        <p className="empty-state-text">
          JIRA and GitHub updates will appear here
        </p>
      </div>
    );
  }

  const getUpdateIcon = (type) => {
    if (type === 'jira_issue') return '🎯';
    if (type === 'github_pr') return '🔀';
    if (type === 'github_commit') return '💻';
    return '📝';
  };

  const getUpdateBadge = (update) => {
    if (update.update_type === 'jira_issue') {
      return `JIRA • ${update.status}`;
    }
    if (update.update_type === 'github_pr') {
      return `PR #${update.metadata?.pr_number} • ${update.status}`;
    }
    if (update.update_type === 'github_commit') {
      return 'Commit';
    }
    return update.update_type;
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="updates-feed">
      {updates.map(update => (
        <div key={update.id} className="update-item">
          <div className="update-icon">
            {getUpdateIcon(update.update_type)}
          </div>
          
          <div className="update-content">
            <div className="update-header">
              <div className="update-title-row">
                {update.external_key && (
                  <span className="update-key">[{update.external_key}]</span>
                )}
                <h4 className="update-title">{update.title}</h4>
              </div>
              <span className="update-time">{formatDate(update.created_at)}</span>
            </div>
            
            <div className="update-meta">
              <span className="update-badge">{getUpdateBadge(update)}</span>
              {update.author && (
                <span className="update-author">by {update.author}</span>
              )}
              {update.linked_jira_key && update.update_type !== 'jira_issue' && (
                <span className="update-link">→ {update.linked_jira_key}</span>
              )}
            </div>
            
            {update.metadata?.url && (
              <a 
                href={update.metadata.url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="update-link-btn"
                onClick={(e) => {
                  e.preventDefault();
                  if (window.electronAPI?.openExternal) {
                    window.electronAPI.openExternal(update.metadata.url);
                  }
                }}
              >
                View →
              </a>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

export default UpdatesFeed;


