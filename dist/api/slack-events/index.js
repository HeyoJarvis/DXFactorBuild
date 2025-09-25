/**
 * Simplified Slack Events Handler
 * Captures and stores Slack conversations without heavy dependencies
 */

module.exports = async (req, res) => {
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
