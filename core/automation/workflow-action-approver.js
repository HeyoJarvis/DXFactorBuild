/**
 * Workflow Action Approver
 * 
 * Handles user-in-the-loop approval for Microsoft 365 actions
 * - Shows preview of calendar events before creating
 * - Shows preview of emails before sending
 * - Allows user to edit, approve, or reject
 */

const EventEmitter = require('events');
const winston = require('winston');

class WorkflowActionApprover extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.options = {
      logLevel: options.logLevel || 'info',
      ...options
    };

    this.logger = winston.createLogger({
      level: this.options.logLevel,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.Console(),
        new winston.transports.File({ 
          filename: 'logs/workflow-approver.log',
          maxsize: 5242880,
          maxFiles: 5
        })
      ],
      defaultMeta: { service: 'workflow-action-approver' }
    });

    this.pendingApprovals = new Map(); // Store pending approvals
    this.approvalTimeout = 5 * 60 * 1000; // 5 minutes
  }

  /**
   * Request approval for a calendar event
   */
  async requestCalendarApproval(workflow, suggestedEvent) {
    const approvalId = `calendar-${Date.now()}`;
    
    this.logger.info('Requesting calendar event approval', {
      approvalId,
      workflowId: workflow.id,
      subject: suggestedEvent.subject
    });

    const approval = {
      id: approvalId,
      type: 'calendar_event',
      workflow,
      data: suggestedEvent,
      status: 'pending',
      createdAt: Date.now()
    };

    this.pendingApprovals.set(approvalId, approval);

    // Emit event for UI to show approval dialog
    this.emit('approval_requested', {
      approvalId,
      type: 'calendar_event',
      preview: this._formatCalendarPreview(suggestedEvent),
      workflow
    });

    // Set timeout to auto-reject
    setTimeout(() => {
      if (this.pendingApprovals.has(approvalId)) {
        this.rejectApproval(approvalId, 'Timeout - no response');
      }
    }, this.approvalTimeout);

    return approvalId;
  }

  /**
   * Request approval for an email
   */
  async requestEmailApproval(workflow, suggestedEmail) {
    const approvalId = `email-${Date.now()}`;
    
    this.logger.info('Requesting email approval', {
      approvalId,
      workflowId: workflow.id,
      subject: suggestedEmail.subject,
      recipients: suggestedEmail.to
    });

    const approval = {
      id: approvalId,
      type: 'email',
      workflow,
      data: suggestedEmail,
      status: 'pending',
      createdAt: Date.now()
    };

    this.pendingApprovals.set(approvalId, approval);

    // Emit event for UI to show approval dialog
    this.emit('approval_requested', {
      approvalId,
      type: 'email',
      preview: this._formatEmailPreview(suggestedEmail),
      workflow
    });

    // Set timeout to auto-reject
    setTimeout(() => {
      if (this.pendingApprovals.has(approvalId)) {
        this.rejectApproval(approvalId, 'Timeout - no response');
      }
    }, this.approvalTimeout);

    return approvalId;
  }

  /**
   * Approve an action (optionally with edits)
   */
  async approveAction(approvalId, edits = null) {
    const approval = this.pendingApprovals.get(approvalId);
    
    if (!approval) {
      throw new Error(`Approval ${approvalId} not found`);
    }

    if (approval.status !== 'pending') {
      throw new Error(`Approval ${approvalId} already ${approval.status}`);
    }

    // Apply edits if provided
    if (edits) {
      approval.data = { ...approval.data, ...edits };
    }

    approval.status = 'approved';
    approval.approvedAt = Date.now();

    this.logger.info('Action approved', {
      approvalId,
      type: approval.type,
      hasEdits: !!edits
    });

    // Emit approval event
    this.emit('action_approved', {
      approvalId,
      type: approval.type,
      data: approval.data,
      workflow: approval.workflow
    });

    return approval;
  }

  /**
   * Reject an action
   */
  async rejectApproval(approvalId, reason = 'User rejected') {
    const approval = this.pendingApprovals.get(approvalId);
    
    if (!approval) {
      throw new Error(`Approval ${approvalId} not found`);
    }

    approval.status = 'rejected';
    approval.rejectedAt = Date.now();
    approval.rejectionReason = reason;

    this.logger.info('Action rejected', {
      approvalId,
      type: approval.type,
      reason
    });

    // Emit rejection event
    this.emit('action_rejected', {
      approvalId,
      type: approval.type,
      reason,
      workflow: approval.workflow
    });

    // Clean up after a short delay
    setTimeout(() => {
      this.pendingApprovals.delete(approvalId);
    }, 60000); // Keep for 1 minute for logging

    return approval;
  }

  /**
   * Get pending approvals
   */
  getPendingApprovals() {
    return Array.from(this.pendingApprovals.values())
      .filter(a => a.status === 'pending')
      .map(a => ({
        id: a.id,
        type: a.type,
        workflow: {
          id: a.workflow.id,
          title: a.workflow.title,
          description: a.workflow.description
        },
        preview: a.type === 'calendar_event' 
          ? this._formatCalendarPreview(a.data)
          : this._formatEmailPreview(a.data),
        createdAt: a.createdAt
      }));
  }

  /**
   * Format calendar event preview
   */
  _formatCalendarPreview(event) {
    return {
      subject: event.subject,
      startTime: event.startTime,
      endTime: event.endTime,
      attendees: event.attendees || [],
      location: event.location || 'Online',
      isOnlineMeeting: event.isOnlineMeeting || false,
      body: event.body || ''
    };
  }

  /**
   * Format email preview
   */
  _formatEmailPreview(email) {
    return {
      to: email.to,
      cc: email.cc || [],
      subject: email.subject,
      body: email.body,
      importance: email.importance || 'normal'
    };
  }

  /**
   * Clear old approvals
   */
  clearOldApprovals(maxAge = 24 * 60 * 60 * 1000) {
    const now = Date.now();
    let cleared = 0;

    for (const [id, approval] of this.pendingApprovals.entries()) {
      if (now - approval.createdAt > maxAge) {
        this.pendingApprovals.delete(id);
        cleared++;
      }
    }

    if (cleared > 0) {
      this.logger.info('Cleared old approvals', { count: cleared });
    }

    return cleared;
  }
}

module.exports = WorkflowActionApprover;
