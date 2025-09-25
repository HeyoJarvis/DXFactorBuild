/**
 * Logout Endpoint
 * 
 * Invalidates user sessions and clears authentication
 */

const { logout } = require('../../middleware/auth');

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

    // Use the logout method from auth middleware
    await logout(req, res);

  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ 
      error: 'Logout service error',
      message: error.message 
    });
  }
};
