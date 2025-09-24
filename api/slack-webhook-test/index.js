/**
 * Simple Slack Webhook Test Endpoint
 * This endpoint handles Slack URL verification and basic event processing
 */

module.exports = async (req, res) => {
  try {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    console.log('Webhook received:', {
      method: req.method,
      headers: req.headers,
      body: req.body
    });

    // Handle Slack URL verification challenge
    if (req.method === 'POST' && req.body && req.body.type === 'url_verification') {
      console.log('URL verification challenge received:', req.body.challenge);
      return res.json({ challenge: req.body.challenge });
    }

    // Handle GET requests (for testing)
    if (req.method === 'GET') {
      return res.json({
        status: 'Slack webhook endpoint is working',
        timestamp: new Date().toISOString(),
        endpoint: '/api/slack-webhook-test'
      });
    }

    // Handle Slack events
    if (req.method === 'POST' && req.body && req.body.type === 'event_callback') {
      console.log('Slack event received:', req.body.event);
      return res.json({ status: 'event_received' });
    }

    // Default response
    return res.json({
      status: 'webhook_ready',
      method: req.method,
      received_at: new Date().toISOString()
    });

  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({
      error: 'Webhook processing failed',
      message: error.message
    });
  }
};
