/**
 * JIRA Status Mapper Utility
 * 
 * Provides centralized mapping between JIRA statuses and internal task statuses.
 * This ensures consistency across the application and makes status information
 * easily queryable for task chat and other features.
 */

/**
 * Map JIRA status to internal task status
 * @param {string} jiraStatus - JIRA status name (e.g., 'In Progress', 'Done')
 * @returns {string} Internal status ('todo', 'in_progress', 'completed')
 */
function mapJiraStatusToInternal(jiraStatus) {
  if (!jiraStatus) return 'todo';
  
  const statusLower = jiraStatus.toLowerCase().trim();
  
  // Completed statuses
  if (['done', 'resolved', 'closed', 'completed'].includes(statusLower)) {
    return 'completed';
  }
  
  // In progress statuses
  if (['in progress', 'in development', 'in review', 'code review', 'testing', 'qa'].includes(statusLower)) {
    return 'in_progress';
  }
  
  // Todo/Backlog statuses (default)
  // Includes: 'To Do', 'Backlog', 'Open', 'New', etc.
  return 'todo';
}

/**
 * Check if JIRA status indicates completion
 * @param {string} jiraStatus - JIRA status name
 * @returns {boolean} True if task is completed in JIRA
 */
function isJiraStatusCompleted(jiraStatus) {
  if (!jiraStatus) return false;
  const statusLower = jiraStatus.toLowerCase().trim();
  return ['done', 'resolved', 'closed', 'completed'].includes(statusLower);
}

/**
 * Check if JIRA status indicates in-progress work
 * @param {string} jiraStatus - JIRA status name
 * @returns {boolean} True if task is in progress in JIRA
 */
function isJiraStatusInProgress(jiraStatus) {
  if (!jiraStatus) return false;
  const statusLower = jiraStatus.toLowerCase().trim();
  return ['in progress', 'in development', 'in review', 'code review', 'testing', 'qa'].includes(statusLower);
}

/**
 * Get human-readable status label
 * @param {string} internalStatus - Internal status ('todo', 'in_progress', 'completed')
 * @returns {string} Human-readable label
 */
function getStatusLabel(internalStatus) {
  const labels = {
    'todo': 'To Do',
    'in_progress': 'In Progress',
    'completed': 'Completed'
  };
  return labels[internalStatus] || 'To Do';
}

/**
 * Get status emoji for display
 * @param {string} internalStatus - Internal status
 * @returns {string} Emoji representing the status
 */
function getStatusEmoji(internalStatus) {
  const emojis = {
    'todo': '○',
    'in_progress': '◐',
    'completed': '✓'
  };
  return emojis[internalStatus] || '○';
}

/**
 * Get task context for AI chat
 * Provides comprehensive status information for task-related conversations
 * @param {Object} task - Task object with JIRA metadata
 * @returns {Object} Context object for AI
 */
function getTaskContextForChat(task) {
  const internalStatus = task.status || mapJiraStatusToInternal(task.jira_status);
  
  return {
    // Basic info
    taskId: task.id,
    title: task.title || task.session_title,
    description: task.description,
    
    // Status information
    status: {
      internal: internalStatus,
      jira: task.jira_status || null,
      label: getStatusLabel(internalStatus),
      emoji: getStatusEmoji(internalStatus),
      isCompleted: internalStatus === 'completed' || task.is_completed,
      isInProgress: internalStatus === 'in_progress'
    },
    
    // JIRA metadata
    jira: {
      key: task.external_key || null,
      url: task.external_url || null,
      issueType: task.jira_issue_type || null,
      priority: task.jira_priority || null,
      storyPoints: task.story_points || null,
      sprint: task.sprint || null,
      labels: task.labels || []
    },
    
    // Assignment info
    assignment: {
      assignee: task.assignee || null,
      assignor: task.assignor || null,
      mentionedUsers: task.mentioned_users || []
    },
    
    // Timestamps
    timestamps: {
      created: task.created_at,
      updated: task.updated_at,
      completed: task.completed_at || null
    },
    
    // Priority
    priority: task.priority || 'medium',
    
    // Tags
    tags: task.tags || []
  };
}

module.exports = {
  mapJiraStatusToInternal,
  isJiraStatusCompleted,
  isJiraStatusInProgress,
  getStatusLabel,
  getStatusEmoji,
  getTaskContextForChat
};

