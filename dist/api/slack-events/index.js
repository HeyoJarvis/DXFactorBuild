/**
 * Simplified Slack Events Handler
 * Captures and stores Slack conversations without heavy dependencies
 */

module.exports = async (req, res) => {
console.log('🔍 INCOMING REQUEST:', {
    method: req.method,
    url: req.url,
    headers: {
      'content-type': req.headers['content-type'],
      'user-agent': req.headers['user-agent'],
      'x-slack-signature': req.headers['x-slack-signature'] ? 'present' : 'missing'
    },
    bodyType: typeof req.body,
    bodyKeys: req.body ? Object.keys(req.body) : 'no body'
  });

  try {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    console.log('Slack event received:', {
      method: req.method,
      body: req.body,
      timestamp: new Date().toISOString()
    });

    // Handle Slack URL verification
    if (req.method === 'POST' && req.body && req.body.type === 'url_verification') {
      console.log('URL verification challenge:', req.body.challenge);
      return res.json({ challenge: req.body.challenge });
    }

    // Handle Slack events
    if (req.method === 'POST' && req.body && req.body.type === 'event_callback') {
      const event = req.body.event;
      
      console.log('Processing event:', {
        type: event.type,
        user: event.user,
        channel: event.channel,
        text: event.text?.substring(0, 100) + '...',
        ts: event.ts
      });

      // Store events in global memory for now (in production, use database)
      if (!global.slackEvents) {
        global.slackEvents = [];
      }

      // Add event to memory
      global.slackEvents.unshift({
        id: `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: event.type,
        user: event.user,
        channel: event.channel,
        text: event.text,
        timestamp: event.ts,
        received_at: new Date().toISOString(),
        raw_event: event
      });

      // Keep only last 50 events
      if (global.slackEvents.length > 50) {
        global.slackEvents = global.slackEvents.slice(0, 50);
      }

      // Work request detection (skip messages from admin user)
      if (event.type === 'message' && event.text && event.user !== 'U08NCU64UKH') {
        console.log('🔍 Checking for work request:', { 
          user: event.user, 
          text: event.text.substring(0, 50) + '...' 
        });
        
        const text = event.text.toLowerCase();
        const workRequestPatterns = [
          'can you', 'could you', 'please help', 'need you to', 'urgent', 'asap',
          'would you', 'help me', 'assist me', 'i need', 'request', 'task',
          'fix', 'bug', 'issue', 'problem', 'implement', 'build', 'create'
        ];
        
        const matchedPatterns = workRequestPatterns.filter(pattern => text.includes(pattern));
        const isWorkRequest = matchedPatterns.length > 0;
        
        console.log('🔍 Pattern check result:', { 
          isWorkRequest, 
          matchedPatterns,
          totalPatterns: workRequestPatterns.length 
        });
        
        if (isWorkRequest) {
          // Determine urgency
          let urgency = 'medium';
          if (/urgent|asap|emergency|critical|immediate/.test(text)) {
            urgency = 'urgent';
          } else if (/important|soon|quickly|priority/.test(text)) {
            urgency = 'high';
          } else if (/when you can|no rush|whenever/.test(text)) {
            urgency = 'low';
          }

          // Determine work type
          let workType = 'other';
          if (/code|develop|program|build|implement|debug|fix/.test(text)) {
            workType = 'coding';
          } else if (/design|ui|ux|mockup/.test(text)) {
            workType = 'design';
          } else if (/analyze|research|investigate|review/.test(text)) {
            workType = 'analysis';
          } else if (/help|support|assist|explain/.test(text)) {
            workType = 'support';
          }

          console.log('🔔 WORK REQUEST DETECTED:', {
            user: event.user,
            channel: event.channel,
            message: event.text.substring(0, 100) + (event.text.length > 100 ? '...' : ''),
            urgency: urgency,
            workType: workType,
            confidence: Math.min(0.5 + (matchedPatterns.length * 0.2), 1.0),
            matchedPatterns: matchedPatterns,
            timestamp: new Date().toISOString()
          });
        }
      } else if (event.type === 'message' && event.user === 'U08NCU64UKH') {
        console.log('🔍 Skipping message from admin user (you)');
      }

      return res.json({ 
        status: 'event_processed',
        event_type: event.type,
        stored_events: global.slackEvents.length
      });
    }

    // Handle GET requests - return stored events
    if (req.method === 'GET') {
      const { action } = req.query;

      switch (action) {
        case 'events':
          return res.json({
            events: global.slackEvents || [],
            count: (global.slackEvents || []).length,
            status: 'active'
          });

        case 'latest':
          const latestEvents = (global.slackEvents || []).slice(0, 5);
          return res.json({
            latest_events: latestEvents,
            count: latestEvents.length
          });

        case 'status':
          return res.json({
            status: 'active',
            total_events: (global.slackEvents || []).length,
            last_event: global.slackEvents?.[0]?.received_at || 'none',
            endpoint: '/api/slack-events'
          });

        default:
          return res.json({
            status: 'slack_events_handler_ready',
            available_actions: ['events', 'latest', 'status'],
            total_events: (global.slackEvents || []).length
          });
      }
    }

    return res.json({ 
      status: 'unknown_request',
      method: req.method 
    });

  } catch (error) {
    console.error('Slack events handler error:', error);
    res.status(500).json({
      error: 'Event processing failed',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
};
