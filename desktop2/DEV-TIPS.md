# HeyJarvis Desktop2 - Development Tips

## Quick Restart (when app doesn't show up)

When the Electron window doesn't appear, use this quick restart command:

```bash
npm run restart
```

This will:
- ✅ Kill all Electron processes
- ✅ Clear ports 5173 (Vite) and 8890 (OAuth)
- ✅ Restart the dev server fresh

**Alternative:** Run the script directly:
```bash
./restart-dev.sh
```

## Common Issues

### 1. Window Doesn't Show Up
**Symptoms:** Dev server starts, logs show app is running, but no window appears

**Solution:**
```bash
npm run restart
```

### 2. Port Already in Use
**Symptoms:** Error: `EADDRINUSE: address already in use :::5173` or `:::8890`

**Solution:**
```bash
# Kill specific port
lsof -ti:5173 | xargs kill -9   # Vite
lsof -ti:8890 | xargs kill -9   # OAuth server

# Or use the restart script
npm run restart
```

### 3. Stale Cache Issues
**Symptoms:** Code changes not reflecting, old data persisting

**Solution:**
```bash
# Clear Electron cache manually
rm -rf ~/Library/Application\ Support/@heyjarvis/desktop2/Cache
rm -rf ~/Library/Application\ Support/@heyjarvis/desktop2/Code\ Cache

# Then restart
npm run restart
```

### 4. Multiple Electron Instances Running
**Symptoms:** Multiple HeyJarvis icons in dock, weird behavior

**Solution:**
```bash
# Kill all Electron processes
pkill -9 -f "electron"

# Then start fresh
npm run dev
```

## Development Workflow

### Normal Start
```bash
npm run dev
```

### Clean Restart (recommended when issues occur)
```bash
npm run restart
```

### Production Build
```bash
npm run build
```

### Build Output Location
After building, the app will be in:
```
desktop2/dist/mac-arm64/HeyJarvis.app
desktop2/dist/HeyJarvis-2.0.0-arm64.dmg
```

## Debugging

### View Electron Logs
Logs are written to console and files. To see all logs:
```bash
# Main process logs (backend)
tail -f logs/*.log

# Renderer process logs (frontend)
Open DevTools in the Electron window: Cmd+Option+I
```

### Check Running Processes
```bash
# Check if Electron is running
ps aux | grep electron | grep -v grep

# Check ports
lsof -i :5173  # Vite dev server
lsof -i :8890  # OAuth server
```

## Tips for Faster Development

1. **Use the restart script** instead of manually force-quitting
2. **Keep DevTools open** (Cmd+Option+I) to see frontend errors
3. **Watch the terminal** for backend/main process errors
4. **Build less often** - only build when you need to test the packaged app

## Environment Variables

Make sure you have a `.env` file in the root directory with:
```env
ANTHROPIC_API_KEY=your_key
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret
GOOGLE_REDIRECT_URI=http://localhost:8890/auth/google/callback
# ... etc
```

## Known Issues

- **Window doesn't show on first launch**: Use `npm run restart`
- **CRM connection errors**: Normal if CRM service isn't running (optional)
- **Slack WebSocket timeouts**: Non-critical warnings, safe to ignore
- **Winston transport warnings**: Logging configuration notices, safe to ignore
