/**
 * Authentication Refresh Endpoint
 * 
 * Validates session tokens and returns fresh tokens with user data
 */

const { refresh } = require('../../middleware/auth');

module.exports = async (req, res) => {
  try {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    // Use the refresh method from auth middleware
    await refresh(req, res);

  } catch (error) {
    console.error('Auth refresh error:', error);
    res.status(500).json({ 
      error: 'Authentication service error',
      message: error.message 
    });
  }
};
