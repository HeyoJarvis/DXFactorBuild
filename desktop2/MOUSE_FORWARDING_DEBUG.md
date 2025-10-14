# 🖱️ Mouse Forwarding Debug Guide

## Problem
Clicks are still passing through to the desktop/applications behind the window when the app is expanded.

## Root Cause Analysis

### Mouse Forwarding in Electron
When `mainWindow.setIgnoreMouseEvents(true, { forward: true })` is called, Electron forwards ALL mouse events through the window to applications behind it. This is needed for collapsed mode (Arc Reactor only) but MUST be disabled in expanded mode.

### Current Implementation

**JavaScript Controls:**
1. `App.jsx` - Master controller that sets forwarding based on `isCollapsed` state
2. `ArcReactor.jsx` - Disables forwarding when expanded
3. `ArcReactorOrb.jsx` - Manages forwarding during orb interactions

**Electron IPC:**
- `window:setMouseForward` - IPC handler in `window-handlers.js`
- Calls `mainWindow.setIgnoreMouseEvents(shouldForward, { forward: true })`

## Debug Steps

### 1. Check Console Logs

Open DevTools console and look for these messages:

**On App Start (Collapsed):**
```
🖱️ Mouse forwarding ENABLED (collapsed mode)
```

**When Clicking Menu Item:**
```
🧭 Navigating from Arc Reactor to: tasks
🖱️ FORCE DISABLED mouse forwarding before expand
✅ Window expanded
🖱️ Mouse forwarding DISABLED (expanded mode)
```

**When Minimizing:**
```
🔽 Minimizing to Arc Reactor orb...
✅ Window collapsed
🖱️ ENABLED mouse forwarding (collapsed mode)
🖱️ Mouse forwarding ENABLED (collapsed mode)
```

### 2. Manual Test

Run this in the DevTools console when expanded:

```javascript
// Check current state
console.log('isCollapsed:', document.querySelector('.app-collapsed') !== null);

// Force disable mouse forwarding
window.electronAPI.window.setMouseForward(false).then(() => {
  console.log('✅ Mouse forwarding manually disabled');
});

// Test click
setTimeout(() => {
  console.log('Try clicking a navigation tab now...');
}, 1000);
```

### 3. Check Electron Main Process Logs

Look in the terminal where `npm run dev` is running for:

```
{"level":"debug","message":"Mouse event forwarding:","service":"desktop2-main","shouldForward":false}
```

If you see `shouldForward: true` when expanded, that's the problem!

## Current Fix Strategy

### Three-Layer Defense:

**Layer 1: App-Level Control (PRIMARY)**
```javascript
// App.jsx useEffect - runs whenever isCollapsed changes
useEffect(() => {
  const shouldForward = isCollapsed;
  window.electronAPI.window.setMouseForward(shouldForward);
}, [isCollapsed]);
```

**Layer 2: Navigation Control (BACKUP)**
```javascript
// App.jsx - force disable before expand
const handleArcReactorNavigate = async (itemId) => {
  await window.electronAPI.window.setMouseForward(false);
  // ... expand window
};
```

**Layer 3: Component Control (CONDITIONAL)**
```javascript
// ArcReactor.jsx - disable when expanded
useEffect(() => {
  if (!isCollapsed) {
    window.electronAPI.window.setMouseForward(false);
  }
}, [isCollapsed]);
```

## Testing Checklist

### Collapsed Mode (Arc Reactor Only)
- [ ] Desktop is clickable
- [ ] Can interact with apps behind window
- [ ] Only Arc Reactor orb receives clicks
- [ ] Console shows: `Mouse forwarding ENABLED`
- [ ] Terminal shows: `shouldForward: true`

### Transition: Collapse → Expand
- [ ] Click Arc Reactor orb → menu appears
- [ ] Click menu item (e.g., "Tasks")
- [ ] Console shows: `FORCE DISABLED mouse forwarding`
- [ ] Console shows: `Mouse forwarding DISABLED (expanded mode)`
- [ ] Terminal shows: `shouldForward: false`

### Expanded Mode (Full UI)
- [ ] **Navigation tabs are clickable** ← CRITICAL TEST
- [ ] **Buttons work** (minimize, task actions, etc.)
- [ ] **NO clicks pass through to desktop** ← CRITICAL TEST
- [ ] Console shows: `Mouse forwarding DISABLED`
- [ ] Terminal shows: `shouldForward: false`

### Transition: Expand → Collapse
- [ ] Click minimize button
- [ ] Console shows: `ENABLED mouse forwarding (collapsed mode)`
- [ ] Desktop becomes clickable again
- [ ] Terminal shows: `shouldForward: true`

## If Still Not Working

### Quick Fixes to Try:

**1. Force Disable in Console:**
```javascript
window.electronAPI.window.setMouseForward(false);
```

**2. Check Window State:**
```javascript
// Should return false when expanded
document.querySelector('.app-collapsed') !== null
```

**3. Restart the App:**
```bash
# Kill and restart
killall -9 Electron
cd /Users/jarvis/Code/HeyJarvis/desktop2
npm run dev
```

**4. Check for Competing Code:**
Search for other calls to `setMouseForward`:
```bash
grep -r "setMouseForward" desktop2/renderer2/src/
```

## Nuclear Option

If nothing works, we can remove the `{ forward: true }` option from Electron:

```javascript
// window-handlers.js - line 94
// OLD:
mainWindow.setIgnoreMouseEvents(shouldForward, { forward: true });

// NEW:
mainWindow.setIgnoreMouseEvents(shouldForward); // No forwarding!
```

This means:
- ✅ Clicks won't pass through in expanded mode
- ❌ In collapsed mode, you'll need to use CSS `pointer-events: none` exclusively

## Verification Commands

```bash
# Watch the logs
tail -f desktop2/logs/*.log | grep "shouldForward"

# Check if process is running
ps aux | grep Electron

# Kill and restart
killall Electron
cd /Users/jarvis/Code/HeyJarvis/desktop2 && npm run dev
```

## Expected Behavior Summary

| Mode | Mouse Forwarding | Desktop Clickable | UI Clickable |
|------|-----------------|-------------------|--------------|
| Collapsed | ✅ ENABLED | ✅ YES | 🎯 Orb only |
| Expanded | ❌ DISABLED | ❌ NO | ✅ YES (all UI) |

---

**Status**: Fix deployed, awaiting test results
**Last Updated**: Now
**Files Modified**: App.jsx, ArcReactor.jsx, ArcReactorOrb.jsx


