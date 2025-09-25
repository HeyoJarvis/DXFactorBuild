// Vercel API endpoint to serve insights to Electron app
module.exports = async (req, res) => {
  try {
    // Set CORS headers for Electron app
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    if (req.method !== 'GET') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const { user_id } = req.query;
    
    if (!user_id) {
      return res.status(400).json({ error: 'user_id required' });
    }

    // Mock competitive intelligence data (replace with real analysis)
    const insights = [
      {
        id: 'insight_001',
        type: 'competitive_signal',
        title: 'New competitor feature detected',
        description: 'Analysis of Slack conversations reveals team discussing competitor\'s new AI feature',
        priority: 'high',
        timestamp: new Date().toISOString(),
        source: 'slack_analysis',
        confidence: 0.87,
        actions: [
          'Research competitor feature',
          'Schedule team discussion',
          'Update product roadmap'
        ]
      },
      {
        id: 'insight_002', 
        type: 'workflow_optimization',
        title: 'Communication bottleneck identified',
        description: 'Team workflow analysis shows 23% delay in project handoffs',
        priority: 'medium',
        timestamp: new Date(Date.now() - 3600000).toISOString(),
        source: 'workflow_analysis',
        confidence: 0.92,
        actions: [
          'Implement async handoff process',
          'Create status dashboard',
          'Automate progress updates'
        ]
      }
    ];

    res.json({
      success: true,
      user_id,
      insights,
      total: insights.length,
      generated_at: new Date().toISOString()
    });

  } catch (error) {
    console.error('Insights API error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch insights',
      message: error.message 
    });
  }
};
