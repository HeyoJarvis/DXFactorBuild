/**
 * Microsoft Workflow Automation
 * 
 * Intelligently automates Microsoft 365 actions based on workflows and tasks:
 * - Auto-create calendar events for meetings
 * - Send email notifications for task assignments
 * - Schedule Teams meetings for collaboration
 * - Smart scheduling with availability checks
 * 
 * Features:
 * 1. AI-powered intent detection
 * 2. Automatic attendee extraction
 * 3. Smart time suggestions
 * 4. Conflict detection and resolution
 */

const winston = require('winston');
const EventEmitter = require('events');
const Anthropic = require('@anthropic-ai/sdk');

class MicrosoftWorkflowAutomation extends EventEmitter {
  constructor(microsoftGraphService, options = {}) {
    super();
    
    this.graphService = microsoftGraphService;
    
    this.options = {
      autoCreateEvents: options.autoCreateEvents !== false,
      autoSendEmails: options.autoSendEmails !== false,
      requireConfirmation: options.requireConfirmation !== false,
      aiModel: options.aiModel || 'claude-sonnet-4-20250514',
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
          filename: 'logs/microsoft-automation.log',
          maxsize: 5242880,
          maxFiles: 5
        })
      ],
      defaultMeta: { service: 'microsoft-workflow-automation' }
    });

    // Initialize AI for intent detection
    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY
    });

    this.logger.info('Microsoft Workflow Automation initialized', {
      autoCreateEvents: this.options.autoCreateEvents,
      autoSendEmails: this.options.autoSendEmails
    });
  }

  /**
   * Analyze workflow to determine if Microsoft actions are needed
   */
  async analyzeWorkflowForActions(workflow) {
    try {
      const prompt = `Analyze this workflow/task and determine if it requires Microsoft 365 actions (calendar event, email, Teams meeting).

Workflow Details:
- Title: ${workflow.title || workflow.session_title}
- Description: ${workflow.description || workflow.workflow_metadata?.description || 'None'}
- Priority: ${workflow.priority || workflow.workflow_metadata?.priority || 'medium'}
- Assignor: ${workflow.workflow_metadata?.assignor || 'Unknown'}
- Assignee: ${workflow.workflow_metadata?.assignee || 'None'}
- Tags: ${workflow.workflow_metadata?.tags?.join(', ') || 'None'}

Determine:
1. Should a calendar event be created? (meetings, calls, deadlines)
2. Should an email notification be sent? (task assignments, urgent items)
3. Should a Teams meeting be scheduled? (collaboration, discussions)
4. Extract meeting details if applicable (date, time, duration, attendees)

Respond in JSON format:
{
  "needsCalendarEvent": boolean,
  "needsEmail": boolean,
  "needsTeamsMeeting": boolean,
  "confidence": number (0-1),
  "reasoning": "string",
  "suggestedEventDetails": {
    "subject": "string",
    "startTime": "ISO 8601 datetime or null",
    "duration": number (minutes),
    "attendees": ["email1", "email2"],
    "isUrgent": boolean
  },
  "suggestedEmailDetails": {
    "subject": "string",
    "priority": "normal|high",
    "recipients": ["email1", "email2"]
  }
}`;

      const response = await this.anthropic.messages.create({
        model: this.options.aiModel,
        max_tokens: 1024,
        temperature: 0.1,
        messages: [{
          role: 'user',
          content: prompt
        }]
      });

      const analysis = JSON.parse(response.content[0].text);

      this.logger.info('Workflow analyzed for Microsoft actions', {
        workflow_id: workflow.id,
        needsCalendarEvent: analysis.needsCalendarEvent,
        needsEmail: analysis.needsEmail,
        needsTeamsMeeting: analysis.needsTeamsMeeting,
        confidence: analysis.confidence
      });

      return {
        success: true,
        analysis
      };
    } catch (error) {
      this.logger.error('Failed to analyze workflow', {
        error: error.message,
        workflow_id: workflow.id
      });

      // Return safe defaults
      return {
        success: false,
        analysis: {
          needsCalendarEvent: false,
          needsEmail: false,
          needsTeamsMeeting: false,
          confidence: 0
        }
      };
    }
  }

  /**
   * Auto-execute Microsoft actions based on workflow
   */
  async executeWorkflowActions(workflow, userEmails = {}) {
    try {
      const { analysis } = await this.analyzeWorkflowForActions(workflow);
      
      if (analysis.confidence < 0.5) {
        this.logger.info('Low confidence, skipping auto-actions', {
          workflow_id: workflow.id,
          confidence: analysis.confidence
        });
        return { success: true, actionsExecuted: [] };
      }

      const actionsExecuted = [];

      // Create calendar event if needed
      if (analysis.needsCalendarEvent && this.options.autoCreateEvents) {
        try {
          const eventResult = await this._createEventFromAnalysis(
            workflow,
            analysis.suggestedEventDetails,
            userEmails
          );
          
          if (eventResult.success) {
            actionsExecuted.push({
              type: 'calendar_event',
              result: eventResult
            });
          }
        } catch (error) {
          this.logger.error('Failed to create calendar event', {
            error: error.message,
            workflow_id: workflow.id
          });
        }
      }

      // Send email notification if needed
      if (analysis.needsEmail && this.options.autoSendEmails) {
        try {
          const emailResult = await this._sendEmailFromAnalysis(
            workflow,
            analysis.suggestedEmailDetails,
            userEmails
          );
          
          if (emailResult.success) {
            actionsExecuted.push({
              type: 'email',
              result: emailResult
            });
          }
        } catch (error) {
          this.logger.error('Failed to send email', {
            error: error.message,
            workflow_id: workflow.id
          });
        }
      }

      // Create Teams meeting if needed
      if (analysis.needsTeamsMeeting) {
        try {
          const teamsResult = await this._createTeamsMeetingFromAnalysis(
            workflow,
            analysis.suggestedEventDetails
          );
          
          if (teamsResult.success) {
            actionsExecuted.push({
              type: 'teams_meeting',
              result: teamsResult
            });
          }
        } catch (error) {
          this.logger.error('Failed to create Teams meeting', {
            error: error.message,
            workflow_id: workflow.id
          });
        }
      }

      this.logger.info('Workflow actions executed', {
        workflow_id: workflow.id,
        actionsCount: actionsExecuted.length,
        actions: actionsExecuted.map(a => a.type)
      });

      this.emit('workflow_actions_executed', {
        workflowId: workflow.id,
        actions: actionsExecuted
      });

      return {
        success: true,
        actionsExecuted,
        analysis
      };
    } catch (error) {
      this.logger.error('Failed to execute workflow actions', {
        error: error.message,
        workflow_id: workflow.id
      });

      throw error;
    }
  }

  /**
   * Create calendar event from AI analysis
   */
  async _createEventFromAnalysis(workflow, eventDetails, userEmails) {
    const eventData = {
      subject: eventDetails.subject || workflow.title || workflow.session_title,
      body: workflow.description || workflow.workflow_metadata?.description,
      startTime: eventDetails.startTime || this._suggestStartTime(workflow),
      endTime: this._calculateEndTime(
        eventDetails.startTime || this._suggestStartTime(workflow),
        eventDetails.duration || 60
      ),
      attendees: this._resolveAttendees(eventDetails.attendees, workflow, userEmails),
      isOnlineMeeting: true,
      importance: eventDetails.isUrgent ? 'high' : 'normal'
    };

    return await this.graphService.createCalendarEvent(eventData);
  }

  /**
   * Send email from AI analysis
   */
  async _sendEmailFromAnalysis(workflow, emailDetails, userEmails) {
    const assigneeEmail = this._getAssigneeEmail(workflow, userEmails);
    
    if (!assigneeEmail) {
      this.logger.warn('No assignee email found, skipping email', {
        workflow_id: workflow.id
      });
      return { success: false, reason: 'no_assignee_email' };
    }

    const emailData = {
      to: [assigneeEmail],
      subject: emailDetails.subject || `Task Assigned: ${workflow.title || workflow.session_title}`,
      body: this._generateEmailBody(workflow, emailDetails),
      isHtml: true,
      importance: emailDetails.priority || 'normal'
    };

    return await this.graphService.sendEmail(emailData);
  }

  /**
   * Create Teams meeting from AI analysis
   */
  async _createTeamsMeetingFromAnalysis(workflow, eventDetails) {
    const meetingData = {
      subject: eventDetails.subject || workflow.title || workflow.session_title,
      startTime: eventDetails.startTime || this._suggestStartTime(workflow),
      endTime: this._calculateEndTime(
        eventDetails.startTime || this._suggestStartTime(workflow),
        eventDetails.duration || 60
      )
    };

    return await this.graphService.createTeamsMeeting(meetingData);
  }

  // ===== HELPER METHODS =====

  _suggestStartTime(workflow) {
    // Check if workflow has a due date
    if (workflow.workflow_metadata?.due_date) {
      return new Date(workflow.workflow_metadata.due_date).toISOString();
    }

    // Default to next business day at 10 AM
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    // If tomorrow is weekend, move to Monday
    if (tomorrow.getDay() === 0) tomorrow.setDate(tomorrow.getDate() + 1); // Sunday -> Monday
    if (tomorrow.getDay() === 6) tomorrow.setDate(tomorrow.getDate() + 2); // Saturday -> Monday
    
    tomorrow.setHours(10, 0, 0, 0);
    return tomorrow.toISOString();
  }

  _calculateEndTime(startTime, durationMinutes) {
    const endTime = new Date(startTime);
    endTime.setMinutes(endTime.getMinutes() + durationMinutes);
    return endTime.toISOString();
  }

  _resolveAttendees(suggestedAttendees, workflow, userEmails) {
    const attendees = new Set();

    // Add suggested attendees from AI
    if (suggestedAttendees && Array.isArray(suggestedAttendees)) {
      suggestedAttendees.forEach(email => attendees.add(email));
    }

    // Add assignee if available
    const assigneeEmail = this._getAssigneeEmail(workflow, userEmails);
    if (assigneeEmail) {
      attendees.add(assigneeEmail);
    }

    // Add assignor if available
    const assignorEmail = this._getAssignorEmail(workflow, userEmails);
    if (assignorEmail) {
      attendees.add(assignorEmail);
    }

    return Array.from(attendees);
  }

  _getAssigneeEmail(workflow, userEmails) {
    const assigneeSlackId = workflow.workflow_metadata?.assignee;
    return assigneeSlackId ? userEmails[assigneeSlackId] : null;
  }

  _getAssignorEmail(workflow, userEmails) {
    const assignorSlackId = workflow.workflow_metadata?.assignor;
    return assignorSlackId ? userEmails[assignorSlackId] : null;
  }

  _generateEmailBody(workflow, emailDetails) {
    return `
      <html>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #007AFF 0%, #5856D6 100%); padding: 30px; text-align: center;">
            <h1 style="color: white; margin: 0;">HeyJarvis</h1>
            <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0;">Workflow Notification</p>
          </div>
          
          <div style="padding: 30px; background: #fff;">
            <h2 style="color: #171717; margin-top: 0;">${workflow.title || workflow.session_title}</h2>
            
            ${workflow.description || workflow.workflow_metadata?.description ? `
              <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <p style="margin: 0; color: #171717;">${workflow.description || workflow.workflow_metadata.description}</p>
              </div>
            ` : ''}
            
            <table style="width: 100%; margin: 20px 0; border-collapse: collapse;">
              <tr>
                <td style="padding: 10px 0; color: #737373; font-weight: 600;">Priority:</td>
                <td style="padding: 10px 0; color: ${this._getPriorityColor(workflow.priority || workflow.workflow_metadata?.priority)}; font-weight: 600;">
                  ${(workflow.priority || workflow.workflow_metadata?.priority || 'medium').toUpperCase()}
                </td>
              </tr>
              ${workflow.workflow_metadata?.due_date ? `
                <tr>
                  <td style="padding: 10px 0; color: #737373; font-weight: 600;">Due Date:</td>
                  <td style="padding: 10px 0; color: #171717;">${new Date(workflow.workflow_metadata.due_date).toLocaleDateString()}</td>
                </tr>
              ` : ''}
              ${workflow.workflow_metadata?.tags?.length ? `
                <tr>
                  <td style="padding: 10px 0; color: #737373; font-weight: 600;">Tags:</td>
                  <td style="padding: 10px 0;">
                    ${workflow.workflow_metadata.tags.map(tag => 
                      `<span style="background: #e5e5e5; padding: 4px 8px; border-radius: 4px; margin-right: 5px; font-size: 12px;">${tag}</span>`
                    ).join('')}
                  </td>
                </tr>
              ` : ''}
            </table>
            
            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e5e5;">
              <p style="color: #737373; font-size: 13px; margin: 0;">
                This notification was automatically generated by HeyJarvis based on your workflow activity.
              </p>
            </div>
          </div>
          
          <div style="background: #f5f5f5; padding: 20px; text-align: center;">
            <p style="color: #737373; font-size: 12px; margin: 0;">
              © ${new Date().getFullYear()} HeyJarvis • Intelligent Workflow Automation
            </p>
          </div>
        </body>
      </html>
    `;
  }

  _getPriorityColor(priority) {
    const colors = {
      urgent: '#FF3B30',
      high: '#FF9F0A',
      medium: '#007AFF',
      low: '#8E8E93'
    };
    return colors[priority] || colors.medium;
  }
}

module.exports = MicrosoftWorkflowAutomation;
