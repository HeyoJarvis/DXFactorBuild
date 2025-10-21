# 🔒 Persistent Authentication - Implementation Plan

## Current Problem
- Integrations connect successfully
- But lose connection when navigating between pages
- Services reset on page navigation
- Need to re-authenticate every session

## Root Cause Analysis

### What's Working ✅
1. Services stored in `appState.services` (persists across navigation)
2. Tokens saved to database
3. Auto-initialization on app startup

### What's Broken ❌
1. Connection check is TOO STRICT - requires service to be initialized
2. If service initialization fails silently, shows as disconnected
3. No automatic re-initialization when service becomes uninitialized

## Solution Architecture

### Three-Tier Persistence Strategy

#### Tier 1: In-Memory Service (Fast)
- Services stay initialized in `appState.services`
- Persist across page navigation
- Lost only on app restart

#### Tier 2: Database Tokens (Medium)
- Tokens stored in `users.integration_settings`
- Survive app restarts
- Used to re-initialize services

#### Tier 3: Token Refresh (Slow)
- Refresh tokens automatically when expired
- Keep services alive indefinitely
- Only fail if refresh token expires

### Implementation Changes

#### 1. Relaxed Connection Check
**Current (Too Strict):**
```javascript
const connected = serviceReady && hasTokens;  // Both required
```

**New (Smart Check):**
```javascript
// If service is ready, it's connected (regardless of DB check)
if (serviceReady) {
  return { connected: true };
}

// If service not ready but has tokens, try to initialize
if (hasTokens) {
  await autoInitializeService(userId);
  return { connected: service.isInitialized };
}

// No tokens = not connected
return { connected: false };
```

#### 2. Auto-Recovery on Check
When checking connection, if service isn't initialized but tokens exist, automatically initialize it:

```javascript
async function checkConnectionWithAutoInit(serviceName, userId) {
  const service = appState.services[serviceName];
  
  // Already initialized? Great!
  if (service?.isInitialized) {
    return { connected: true, source: 'memory' };
  }
  
  // Not initialized but has tokens? Initialize now!
  const tokens = await getTokensFromDB(userId, serviceName);
  if (tokens) {
    logger.info(`Auto-initializing ${serviceName} from stored tokens`);
    await service.initialize(userId);
    return { connected: service.isInitialized, source: 'auto-init' };
  }
  
  // No tokens = never connected
  return { connected: false, source: 'no-tokens' };
}
```

#### 3. Service Health Monitoring
Add periodic health checks to ensure services stay alive:

```javascript
// Check every 5 minutes
setInterval(async () => {
  const userId = appState.services.auth?.currentUser?.id;
  if (!userId) return;
  
  for (const [name, service] of Object.entries(appState.services)) {
    if (service.isConnected && !service.isConnected()) {
      logger.warn(`${name} service lost connection, re-initializing...`);
      await service.initialize(userId);
    }
  }
}, 5 * 60 * 1000);
```

#### 4. Disconnect Handler
Only clear auth when explicitly disconnected:

```javascript
async function disconnectIntegration(serviceName, userId) {
  // 1. Clear in-memory service
  const service = appState.services[serviceName];
  if (service) {
    service.isInitialized = false;
    service.graphService = null; // or gmailService, jiraCore, etc.
  }
  
  // 2. Clear database tokens
  await clearTokensFromDB(userId, serviceName);
  
  // 3. Emit event
  logger.info(`${serviceName} disconnected by user`);
}
```

## Implementation Steps

### Step 1: Update Connection Checks
- [ ] Modify `microsoft:checkConnection` to auto-initialize
- [ ] Modify `google:checkConnection` to auto-initialize
- [ ] Modify `jira:checkConnection` to auto-initialize

### Step 2: Add Disconnect Handlers
- [ ] Create `microsoft:disconnect` IPC handler
- [ ] Create `google:disconnect` IPC handler
- [ ] Create `jira:disconnect` IPC handler

### Step 3: Add Health Monitoring
- [ ] Implement periodic service health checks
- [ ] Auto-recover failed services

### Step 4: Update UI
- [ ] Add "Disconnect" button in Settings
- [ ] Show connection source (memory/auto-init/fresh)

## Expected Behavior After Fix

### Scenario 1: Fresh Connection
1. User clicks "Connect" → OAuth flow
2. Tokens saved to DB ✅
3. Service initialized in memory ✅
4. Shows "Connected" ✅
5. Features work ✅

### Scenario 2: Navigate Between Pages
1. User goes to Tasks page
2. Services stay in `appState.services` ✅
3. Come back to Settings
4. `checkConnection` finds service initialized ✅
5. Shows "Connected" immediately ✅
6. Features work ✅

### Scenario 3: App Restart
1. App restarts
2. User logs in
3. `autoInitializeUserIntegrations` runs ✅
4. Services initialized from DB tokens ✅
5. Go to Settings
6. Shows "Connected" ✅
7. Features work ✅

### Scenario 4: Service Lost (Edge Case)
1. Service somehow becomes uninitialized
2. User goes to Settings
3. `checkConnection` detects service not ready
4. Finds tokens in DB ✅
5. Auto-initializes service ✅
6. Shows "Connected" ✅
7. Features work ✅

### Scenario 5: Explicit Disconnect
1. User clicks "Disconnect" button
2. Service cleared from memory ✅
3. Tokens removed from DB ✅
4. Shows "Not Connected" ✅
5. Features don't work ✅
6. Must re-authenticate to reconnect ✅

## Benefits

✅ **Persistent** - Auth survives page navigation
✅ **Resilient** - Auto-recovers if service lost
✅ **Fast** - Uses in-memory service when available
✅ **Reliable** - Falls back to DB tokens
✅ **Clean** - Only clears on explicit disconnect
✅ **User-friendly** - No unexpected re-authentication

## Testing Checklist

- [ ] Connect integration → Navigate away → Come back → Still connected
- [ ] Connect integration → Restart app → Still connected
- [ ] Connect integration → Wait 1 hour → Still connected
- [ ] Click disconnect → Shows disconnected
- [ ] After disconnect → Restart app → Still disconnected
- [ ] Reconnect after disconnect → Works


