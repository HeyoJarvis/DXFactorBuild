/**
 * Workflow Handlers - Processes Slack workflow steps and interactions
 * 
 * Features:
 * 1. Multi-step workflow management
 * 2. User onboarding flows
 * 3. Settings configuration workflows
 * 4. Feedback collection workflows
 */

class WorkflowHandlers {
  constructor() {
    this.activeWorkflows = new Map(); // userId -> workflow state
  }
  
  /**
   * Start a new workflow for a user
   */
  async startWorkflow(workflowType, userId, initialData = {}) {
    const workflow = {
      id: this.generateWorkflowId(),
      type: workflowType,
      userId,
      currentStep: 0,
      data: initialData,
      startedAt: Date.now(),
      lastActivity: Date.now()
    };
    
    this.activeWorkflows.set(userId, workflow);
    
    switch (workflowType) {
      case 'onboarding':
        return await this.handleOnboardingStep(workflow, 0);
      case 'settings':
        return await this.handleSettingsStep(workflow, 0);
      case 'feedback':
        return await this.handleFeedbackStep(workflow, 0);
      default:
        throw new Error(`Unknown workflow type: ${workflowType}`);
    }
  }
  
  /**
   * Continue an existing workflow
   */
  async continueWorkflow(userId, stepData) {
    const workflow = this.activeWorkflows.get(userId);
    
    if (!workflow) {
      throw new Error('No active workflow found for user');
    }
    
    workflow.data = { ...workflow.data, ...stepData };
    workflow.lastActivity = Date.now();
    workflow.currentStep++;
    
    switch (workflow.type) {
      case 'onboarding':
        return await this.handleOnboardingStep(workflow, workflow.currentStep);
      case 'settings':
        return await this.handleSettingsStep(workflow, workflow.currentStep);
      case 'feedback':
        return await this.handleFeedbackStep(workflow, workflow.currentStep);
      default:
        throw new Error(`Unknown workflow type: ${workflow.type}`);
    }
  }
  
  /**
   * Handle onboarding workflow steps
   */
  async handleOnboardingStep(workflow, step) {
    switch (step) {
      case 0:
        return this.createOnboardingWelcome();
      case 1:
        return this.createRoleSelection();
      case 2:
        return this.createInterestSelection(workflow.data.role);
      case 3:
        return this.createNotificationPreferences();
      case 4:
        return this.createOnboardingComplete(workflow.data);
      default:
        this.completeWorkflow(workflow.userId);
        return { completed: true };
    }
  }
  
  /**
   * Handle settings workflow steps
   */
  async handleSettingsStep(workflow, step) {
    switch (step) {
      case 0:
        return this.createSettingsOverview();
      case 1:
        return this.createNotificationSettings();
      case 2:
        return this.createSourceSettings();
      case 3:
        return this.createSettingsComplete(workflow.data);
      default:
        this.completeWorkflow(workflow.userId);
        return { completed: true };
    }
  }
  
  /**
   * Handle feedback workflow steps
   */
  async handleFeedbackStep(workflow, step) {
    switch (step) {
      case 0:
        return this.createFeedbackForm();
      case 1:
        return this.createFeedbackComplete(workflow.data);
      default:
        this.completeWorkflow(workflow.userId);
        return { completed: true };
    }
  }
  
  /**
   * Create onboarding welcome
   */
  createOnboardingWelcome() {
    return {
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: "*👋 Welcome to HeyJarvis!*\n\nI'm your AI-powered competitive intelligence assistant. Let's get you set up with personalized insights."
          }
        },
        {
          type: "actions",
          elements: [
            {
              type: "button",
              text: { type: "plain_text", text: "🚀 Get Started" },
              action_id: "onboarding_continue",
              style: "primary"
            },
            {
              type: "button",
              text: { type: "plain_text", text: "⏭️ Skip Setup" },
              action_id: "onboarding_skip"
            }
          ]
        }
      ]
    };
  }
  
  /**
   * Create role selection
   */
  createRoleSelection() {
    return {
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: "*What's your role?*\nThis helps me tailor insights to your needs."
          }
        },
        {
          type: "actions",
          elements: [
            {
              type: "button",
              text: { type: "plain_text", text: "👔 Executive" },
              action_id: "role_executive",
              value: "executive"
            },
            {
              type: "button",
              text: { type: "plain_text", text: "📊 Product Manager" },
              action_id: "role_pm",
              value: "product_manager"
            },
            {
              type: "button",
              text: { type: "plain_text", text: "💼 Sales" },
              action_id: "role_sales",
              value: "sales"
            },
            {
              type: "button",
              text: { type: "plain_text", text: "📈 Marketing" },
              action_id: "role_marketing",
              value: "marketing"
            },
            {
              type: "button",
              text: { type: "plain_text", text: "🔧 Other" },
              action_id: "role_other",
              value: "other"
            }
          ]
        }
      ]
    };
  }
  
  /**
   * Create settings overview
   */
  createSettingsOverview() {
    return {
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: "*⚙️ Settings*\nWhat would you like to configure?"
          }
        },
        {
          type: "actions",
          elements: [
            {
              type: "button",
              text: { type: "plain_text", text: "🔔 Notifications" },
              action_id: "settings_notifications",
              style: "primary"
            },
            {
              type: "button",
              text: { type: "plain_text", text: "📡 Sources" },
              action_id: "settings_sources"
            },
            {
              type: "button",
              text: { type: "plain_text", text: "🎯 Preferences" },
              action_id: "settings_preferences"
            }
          ]
        }
      ]
    };
  }
  
  /**
   * Complete workflow
   */
  completeWorkflow(userId) {
    this.activeWorkflows.delete(userId);
    console.log(`✅ Workflow completed for user ${userId}`);
  }
  
  /**
   * Generate workflow ID
   */
  generateWorkflowId() {
    return `workflow_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  /**
   * Clean up expired workflows
   */
  cleanupExpiredWorkflows() {
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours
    
    for (const [userId, workflow] of this.activeWorkflows.entries()) {
      if (now - workflow.lastActivity > maxAge) {
        this.activeWorkflows.delete(userId);
        console.log(`🧹 Cleaned up expired workflow for user ${userId}`);
      }
    }
  }
}

module.exports = WorkflowHandlers;
