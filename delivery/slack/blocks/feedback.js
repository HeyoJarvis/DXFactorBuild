/**
 * Feedback Handler - Processes user feedback on signals
 * 
 * Features:
 * 1. Thumbs up/down feedback
 * 2. Detailed feedback collection
 * 3. Learning from user preferences
 * 4. Feedback analytics
 */

class FeedbackHandler {
  constructor() {
    this.feedbackTypes = {
      relevant: 'relevant',
      irrelevant: 'irrelevant',
      mute_source: 'mute_source',
      too_frequent: 'too_frequent',
      wrong_priority: 'wrong_priority'
    };
  }
  
  /**
   * Process feedback from user interaction
   */
  async processFeedback(feedbackData) {
    const { 
      signal_id, 
      user_id, 
      feedback_type, 
      timestamp = Date.now(),
      metadata = {} 
    } = feedbackData;
    
    // Store feedback (in production, would save to database)
    const feedback = {
      id: this.generateFeedbackId(),
      signal_id,
      user_id,
      feedback_type,
      timestamp,
      metadata
    };
    
    console.log('📝 Feedback received:', feedback);
    
    // Update user preferences based on feedback
    await this.updateUserPreferences(user_id, feedback);
    
    return feedback;
  }
  
  /**
   * Update user preferences based on feedback
   */
  async updateUserPreferences(userId, feedback) {
    // In production, would update user preference model
    console.log(`🎯 Updating preferences for user ${userId} based on ${feedback.feedback_type} feedback`);
    
    switch (feedback.feedback_type) {
      case 'irrelevant':
        console.log('   - Decreasing relevance score for similar signals');
        break;
      case 'mute_source':
        console.log('   - Adding source to muted list');
        break;
      case 'too_frequent':
        console.log('   - Reducing notification frequency');
        break;
      case 'wrong_priority':
        console.log('   - Adjusting priority classification');
        break;
      default:
        console.log('   - Positive feedback, reinforcing signal type');
    }
  }
  
  /**
   * Create feedback buttons for a signal
   */
  createFeedbackButtons(signalId) {
    return {
      type: "actions",
      elements: [
        {
          type: "button",
          text: { type: "plain_text", text: "👍 Relevant" },
          action_id: "feedback_relevant",
          value: signalId,
          style: "primary"
        },
        {
          type: "button", 
          text: { type: "plain_text", text: "👎 Not Relevant" },
          action_id: "feedback_irrelevant",
          value: signalId
        },
        {
          type: "button",
          text: { type: "plain_text", text: "🔇 Mute Source" },
          action_id: "feedback_mute_source",
          value: signalId,
          style: "danger"
        }
      ]
    };
  }
  
  /**
   * Create detailed feedback modal
   */
  createFeedbackModal(signalId, triggerId) {
    return {
      type: "modal",
      callback_id: "detailed_feedback",
      title: {
        type: "plain_text",
        text: "Signal Feedback"
      },
      submit: {
        type: "plain_text",
        text: "Submit"
      },
      close: {
        type: "plain_text",
        text: "Cancel"
      },
      private_metadata: JSON.stringify({ signal_id: signalId }),
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: "Help us improve by providing detailed feedback:"
          }
        },
        {
          type: "input",
          block_id: "feedback_type",
          element: {
            type: "radio_buttons",
            action_id: "feedback_type_selection",
            options: [
              {
                text: { type: "plain_text", text: "Not relevant to my role" },
                value: "not_relevant"
              },
              {
                text: { type: "plain_text", text: "Too frequent notifications" },
                value: "too_frequent"
              },
              {
                text: { type: "plain_text", text: "Wrong priority level" },
                value: "wrong_priority"
              },
              {
                text: { type: "plain_text", text: "Source is not trustworthy" },
                value: "untrusted_source"
              }
            ]
          },
          label: {
            type: "plain_text",
            text: "What's the issue?"
          }
        },
        {
          type: "input",
          block_id: "feedback_comments",
          element: {
            type: "plain_text_input",
            action_id: "comments",
            multiline: true,
            placeholder: {
              type: "plain_text",
              text: "Any additional comments? (optional)"
            }
          },
          label: {
            type: "plain_text",
            text: "Comments"
          },
          optional: true
        }
      ]
    };
  }
  
  /**
   * Generate unique feedback ID
   */
  generateFeedbackId() {
    return `feedback_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

module.exports = FeedbackHandler;
