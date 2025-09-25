// Vercel API endpoint to serve recent signals to Electron app
module.exports = async (req, res) => {
  try {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    if (req.method !== 'GET') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const { user_id, limit = 10 } = req.query;
    
    if (!user_id) {
      return res.status(400).json({ error: 'user_id required' });
    }

    // Mock signals data (replace with real Slack analysis)
    const signals = [
      {
        id: 'signal_001',
        type: 'market_intelligence',
        title: 'Competitor pricing change detected',
        content: 'Team discussion mentions competitor reduced pricing by 15%',
        source: 'slack_channel_general',
        timestamp: new Date().toISOString(),
        priority: 'high',
        tags: ['pricing', 'competition', 'market'],
        confidence: 0.91
      },
      {
        id: 'signal_002',
        type: 'product_intelligence', 
        title: 'Customer feature request pattern',
        content: 'Multiple conversations show customers requesting dark mode feature',
        source: 'slack_customer_support',
        timestamp: new Date(Date.now() - 1800000).toISOString(),
        priority: 'medium',
        tags: ['feature_request', 'customer_feedback', 'ui'],
        confidence: 0.84
      },
      {
        id: 'signal_003',
        type: 'team_intelligence',
        title: 'Process inefficiency detected',
        content: 'Code review process taking 3x longer than industry average',
        source: 'slack_engineering',
        timestamp: new Date(Date.now() - 3600000).toISOString(),
        priority: 'medium',
        tags: ['process', 'engineering', 'efficiency'],
        confidence: 0.78
      }
    ];

    const limitedSignals = signals.slice(0, parseInt(limit));

    res.json({
      success: true,
      user_id,
      signals: limitedSignals,
      total: limitedSignals.length,
      available: signals.length,
      generated_at: new Date().toISOString()
    });

  } catch (error) {
    console.error('Signals API error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch signals',
      message: error.message 
    });
  }
};
