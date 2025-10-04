/**
 * AI-Powered Work Request Detector
 * 
 * Uses Claude to intelligently detect work requests instead of rigid pattern matching
 */

const AIAnalyzer = require('../../core/signals/enrichment/ai-analyzer');

class AIWorkRequestDetector {
  constructor(options = {}) {
    this.options = {
      model: 'claude-3-5-haiku-20241022', // Fast & cheap for quick analysis
      temperature: 0.1, // Low temperature for consistent detection
      ...options
    };
    
    this.aiAnalyzer = new AIAnalyzer();
  }

  /**
   * Analyze message using AI to detect if it's a work request
   */
  async analyzeForWorkRequest(message, context = {}) {
    try {
      const prompt = `You are a work request detector for a team collaboration tool. Analyze if this Slack message is a work request/task assignment.

MESSAGE: "${message.text}"

CONTEXT:
- Sender: ${context.user || 'unknown'}
- Channel: ${context.channel || 'unknown'}

Classify this message and respond in JSON format:
{
  "isWorkRequest": true/false,
  "confidence": 0.0-1.0,
  "reasoning": "brief explanation",
  "urgency": "low|medium|high|urgent",
  "workType": "coding|design|analysis|support|meeting|review|other",
  "taskTitle": "extracted task title (max 100 chars)",
  "estimatedEffort": "quick|medium|large"
}

GUIDELINES:
- isWorkRequest = true if it's asking someone to do something, requesting action, assigning work
- isWorkRequest = true for: "can you...", "please...", "need you to...", "finish...", "complete...", "work on...", "collaborate..."
- isWorkRequest = false for: greetings, questions, status updates, casual chat
- Even casual phrasing like "Avi finish the MVP" should be detected as a work request
- confidence should be 0.7+ for clear requests, 0.5-0.7 for implicit requests, <0.5 for unclear

Respond ONLY with valid JSON.`;

      const response = await this.aiAnalyzer.anthropic.messages.create({
        model: this.options.model,
        max_tokens: 300,
        temperature: this.options.temperature,
        messages: [{
          role: 'user',
          content: prompt
        }]
      });

      const analysisText = response.content[0].text;
      
      // Parse JSON response
      const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.error('❌ AI response not JSON:', analysisText);
        return this.fallbackAnalysis(message);
      }

      const analysis = JSON.parse(jsonMatch[0]);
      
      // Validate and normalize
      return {
        isWorkRequest: Boolean(analysis.isWorkRequest),
        confidence: Number(analysis.confidence) || 0,
        reasoning: analysis.reasoning || 'AI analysis',
        urgency: analysis.urgency || 'medium',
        workType: analysis.workType || 'other',
        taskTitle: analysis.taskTitle || this.extractTaskTitle(message.text),
        estimatedEffort: analysis.estimatedEffort || 'medium',
        metadata: {
          messageLength: message.text.length,
          timestamp: message.timestamp || new Date(),
          channel: context.channel,
          user: context.user,
          aiModel: this.options.model
        }
      };

    } catch (error) {
      console.error('❌ AI work request analysis failed:', error.message);
      // Fallback to simple pattern matching
      return this.fallbackAnalysis(message);
    }
  }

  /**
   * Fallback to simple pattern matching if AI fails
   */
  fallbackAnalysis(message) {
    const text = message.text.toLowerCase();
    
    // Simple keyword detection
    const workKeywords = [
      'can you', 'could you', 'please', 'need you to',
      'finish', 'complete', 'work on', 'collaborate',
      'help', 'fix', 'build', 'create', 'update'
    ];
    
    const hasKeyword = workKeywords.some(keyword => text.includes(keyword));
    
    return {
      isWorkRequest: hasKeyword,
      confidence: hasKeyword ? 0.6 : 0.1,
      reasoning: 'Fallback pattern matching (AI unavailable)',
      urgency: text.includes('urgent') || text.includes('asap') ? 'urgent' : 'medium',
      workType: 'other',
      taskTitle: this.extractTaskTitle(message.text),
      estimatedEffort: 'medium',
      metadata: {
        messageLength: message.text.length,
        timestamp: message.timestamp || new Date(),
        fallback: true
      }
    };
  }

  /**
   * Extract task title from message
   */
  extractTaskTitle(text) {
    // Remove mentions
    const cleanText = text.replace(/<@[UW][A-Z0-9]+(|[^>]+)?>/g, '').trim();
    
    // Remove common prefixes
    const withoutPrefixes = cleanText
      .replace(/^(hey|hi|hello|yo),?\s+/i, '')
      .replace(/^(can you|could you|please)\s+/i, '')
      .replace(/^(I need you to|need you to)\s+/i, '')
      .trim();
    
    // Take first sentence or first 100 chars
    const firstSentence = withoutPrefixes.split(/[.!?]/)[0].trim();
    return firstSentence.length > 100 
      ? firstSentence.substring(0, 97) + '...' 
      : firstSentence || 'Task from Slack';
  }

  /**
   * Batch analyze multiple messages (useful for backlog processing)
   */
  async analyzeBatch(messages, context = {}) {
    const analyses = [];
    
    for (const message of messages) {
      const analysis = await this.analyzeForWorkRequest(message, context);
      analyses.push({ message, analysis });
      
      // Small delay to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    return analyses;
  }

  /**
   * Health check
   */
  async healthCheck() {
    try {
      const testMessage = { text: 'Can you help me with this?' };
      const result = await this.analyzeForWorkRequest(testMessage, {});
      return {
        status: 'healthy',
        aiAvailable: !result.metadata?.fallback,
        model: this.options.model
      };
    } catch (error) {
      return {
        status: 'degraded',
        error: error.message,
        fallbackAvailable: true
      };
    }
  }
}

module.exports = AIWorkRequestDetector;

