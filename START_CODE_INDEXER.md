# How to Start Code Indexer

## Problem
Code Indexer shows "GitHub not connected" because the Engineering Intelligence API server isn't running.

## Solution

You need to run **TWO** processes:

### Terminal 1: Engineering Intelligence API Server
```bash
cd /Users/jarvis/Code/HeyJarvis
node api/server.js
```

This starts the API at `http://localhost:3000` which handles:
- GitHub repository listing
- Code indexing
- AI-powered code queries

### Terminal 2: Desktop App
```bash
cd /Users/jarvis/Code/HeyJarvis/desktop2
npm run dev
```

This starts your Electron app.

## Verify It's Working

1. **Check API is running:**
   ```bash
   curl http://localhost:3000/health
   # Should return: {"status":"healthy"}
   ```

2. **Check GitHub connection:**
   ```bash
   curl http://localhost:3000/api/engineering/repos
   # Should list your GitHub repositories
   ```

3. **Open Code Indexer in app:**
   - Should see repositories loaded
   - Status should show "Code Indexer is ready (using GitHub App)"

## Environment Variables Required

Make sure your `.env` file has:

```bash
# GitHub App (Primary)
GITHUB_APP_ID=2081293
GITHUB_APP_INSTALLATION_ID=89170981
GITHUB_APP_PRIVATE_KEY_PATH=/Users/jarvis/Code/HeyJarvis/sales-information.2025-10-07.private-key.pem

# Engineering Intelligence API
API_BASE_URL=http://localhost:3000

# OpenAI (for embeddings)
OPENAI_API_KEY=sk-xxxxxxxxxxxxx

# Anthropic (for AI)
ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxxx

# Supabase (for vector storage)
SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
SUPABASE_ANON_KEY=xxxxxxxxxxxxx
```

## Quick Start Script

Or use this one-liner to start both:

```bash
# Start API in background, then start desktop app
node api/server.js & cd desktop2 && npm run dev
```

## Troubleshooting

**"Cannot find module 'express'"**
```bash
cd /Users/jarvis/Code/HeyJarvis
npm install
```

**"Port 3000 already in use"**
```bash
# Kill existing process
lsof -ti:3000 | xargs kill -9
# Then restart
node api/server.js
```

**"GitHub token not configured"**
- Check `.env` file has `GITHUB_APP_ID`, `GITHUB_APP_INSTALLATION_ID`, `GITHUB_APP_PRIVATE_KEY_PATH`
- Or fallback to `GITHUB_TOKEN=ghp_xxxxxxxxxxxxx`

