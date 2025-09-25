const express = require('express');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  next();
});

// Debug middleware for Slack requests
app.use((req, res, next) => {
  if (req.url.includes('slack-events')) {
    console.log('🔍 ANY SLACK REQUEST:', {
      method: req.method,
      url: req.url,
      userAgent: req.headers['user-agent'],
      hasSlackSignature: !!req.headers['x-slack-signature'],
      contentType: req.headers['content-type'],
      timestamp: new Date().toISOString()
    });
  }
  next();
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Chat page
app.get('/chat', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist/chat.html'));
});

// API Routes
app.all('/api/auth/slack', (req, res) => {
  require('./api/auth/slack/index')(req, res);
});

app.all('/api/auth/slack/callback', (req, res) => {
  require('./api/auth/slack/callback/index')(req, res);
});

app.all('/api/auth/refresh', (req, res) => {
  require('./api/auth/refresh/index')(req, res);
});

app.all('/api/auth/logout', (req, res) => {
  require('./api/auth/logout/index')(req, res);
});

app.all('/api/chat', (req, res) => {
  require('./api/chat/index')(req, res);
});

app.all('/api/slack-events', (req, res) => {
  require('./api/slack-events/index')(req, res);
});

// Static file serving
app.use(express.static(__dirname));

// Default route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ 
    error: 'API endpoint not found',
    path: req.path,
    method: req.method
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 HeyJarvis server running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`💬 Chat interface: http://localhost:${PORT}/chat`);
  console.log(`🔗 Slack events: http://localhost:${PORT}/api/slack-events`);
  
  // Log environment info
  console.log(`📝 Environment loaded: ${Object.keys(process.env).length} variables`);
  console.log(`🏠 Working directory: ${__dirname}`);
});
