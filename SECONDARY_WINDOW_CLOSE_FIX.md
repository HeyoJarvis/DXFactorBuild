# Secondary Window Close & Orb Visibility Fix ✅

## Problem
When closing the secondary window (Mission Control/Team Chat) using macOS traffic lights:
1. **Window wouldn't actually close** - It was prevented from closing and just hidden
2. **Always-on-top state persisted** - The hidden window still had aggressive always-on-top behavior running
3. **Orb visibility logic incomplete** - Orb only appeared when window was fully closed, not when user switched to a different screen

## Root Cause
The `SecondaryWindowManager` had three issues:

### Issue 1: Prevented Window Close
```javascript
// OLD CODE (WRONG)
this.window.on('close', (e) => {
  e.preventDefault();  // ❌ This prevented the window from actually closing!
  this.window.hide();
});
```

### Issue 2: Always-On-Top Behavior
The secondary window was calling:
- `setupMaximumVisibility()` - Set window to screen-saver level, cross-workspace visibility
- `setupEnhancedAlwaysOnTop()` - 5-second interval forcing window to stay on top

This made the secondary window behave like the orb (always-on-top), which is wrong. The secondary window should be a **normal desktop window**.

### Issue 3: Missing Window State Events
The window only notified about close events, not:
- ❌ Blur (user switched to different window)
- ❌ Focus (user switched back)
- ❌ Minimize
- ❌ Restore

## Solution Applied

### 1. Remove Always-On-Top Behavior
**File**: `desktop2/main/windows/SecondaryWindowManager.js`

**Removed:**
```javascript
// REMOVED these calls from ready-to-show handler:
this.setupMaximumVisibility();
this.setupEnhancedAlwaysOnTop();
```

**Replaced with:**
```javascript
// NOTE: Secondary window should behave like a NORMAL desktop window
// - NOT always-on-top (removed setupMaximumVisibility and setupEnhancedAlwaysOnTop)
// - Can be closed with traffic lights
// - Can be minimized
// - Stays on the desktop/workspace it was opened on
// - Doesn't float above everything
this.logger.info('Secondary window configured as normal desktop window (not always-on-top)');
```

### 2. Allow Actual Window Close
**File**: `desktop2/main/windows/SecondaryWindowManager.js`

**Changed:**
```javascript
// NEW CODE (CORRECT)
this.window.on('close', () => {
  this.logger.info('Secondary window closing (user clicked traffic lights or close button)');
  
  // Clean up always-on-top interval if it exists
  if (this.alwaysOnTopInterval) {
    clearInterval(this.alwaysOnTopInterval);
    this.alwaysOnTopInterval = null;
  }
  
  // Notify main window that secondary window is closed
  if (this.mainWindowManager?.getWindow()?.webContents) {
    this.mainWindowManager.getWindow().webContents.send('window:secondaryWindowChange', false, null);
  }
  
  // Show the main window (Arc Reactor) when secondary window closes
  if (this.mainWindowManager) {
    this.mainWindowManager.show();
  }
  
  // NOTE: No e.preventDefault() - let the window actually close!
});

this.window.on('closed', () => {
  this.logger.info('Secondary window closed (destroyed)');
  this.window = null;
});
```

### 3. Add Comprehensive Window State Events
**File**: `desktop2/main/windows/SecondaryWindowManager.js`

**Added:**

#### Blur Event (User Switched Away)
```javascript
this.window.on('blur', () => {
  this.logger.info('Secondary window lost focus (user switched away)');
  
  // Notify main window that user switched away - show orb
  if (this.mainWindowManager?.getWindow()?.webContents) {
    this.mainWindowManager.getWindow().webContents.send('window:secondaryWindowChange', false, null);
    this.logger.info('Sent secondary window blur event to main window renderer (show orb)');
  }
});
```

**Triggered when:**
- User clicks on another application window
- User switches with Cmd+Tab (macOS) or Alt+Tab (Windows)
- User clicks on desktop or another screen

**Result:** Orb appears! ✅

#### Focus Event (User Switched Back)
```javascript
this.window.on('focus', () => {
  this.logger.info('Secondary window gained focus (user switched back)');
  
  // Notify main window that user is back - hide orb
  if (this.mainWindowManager?.getWindow()?.webContents) {
    this.mainWindowManager.getWindow().webContents.send('window:secondaryWindowChange', true, this.currentRoute);
    this.logger.info('Sent secondary window focus event to main window renderer (hide orb)');
  }
});
```

**Triggered when:**
- User clicks back on Mission Control window
- User switches back with Cmd+Tab or Alt+Tab
- User clicks Mission Control in dock/taskbar

**Result:** Orb hides! ✅

#### Minimize Event
```javascript
this.window.on('minimize', () => {
  this.logger.info('Secondary window minimized');
  
  // Show orb when minimized
  if (this.mainWindowManager?.getWindow()?.webContents) {
    this.mainWindowManager.getWindow().webContents.send('window:secondaryWindowChange', false, null);
    this.logger.info('Sent secondary window minimize event to main window renderer (show orb)');
  }
});
```

**Triggered when:**
- User clicks minimize button (−)
- User uses keyboard shortcut to minimize

**Result:** Orb appears! ✅

#### Restore Event (From Minimize)
```javascript
this.window.on('restore', () => {
  this.logger.info('Secondary window restored from minimize');
  
  // Hide orb when restored
  if (this.mainWindowManager?.getWindow()?.webContents) {
    this.mainWindowManager.getWindow().webContents.send('window:secondaryWindowChange', true, this.currentRoute);
    this.logger.info('Sent secondary window restore event to main window renderer (hide orb)');
  }
});
```

**Triggered when:**
- User clicks Mission Control in dock/taskbar to restore
- User restores from minimized state

**Result:** Orb hides! ✅

### 4. Enhanced show() and hide() Methods
**File**: `desktop2/main/windows/SecondaryWindowManager.js`

**Updated show():**
```javascript
show() {
  // ... existing show logic ...
  
  // Notify main window that secondary is now visible and focused - hide orb
  if (this.mainWindowManager?.getWindow()?.webContents) {
    this.mainWindowManager.getWindow().webContents.send('window:secondaryWindowChange', true, this.currentRoute);
    this.logger.info('Sent secondary window show event to main window renderer (hide orb)');
  }
}
```

**Updated hide():**
```javascript
hide() {
  if (this.window) {
    this.window.hide();
    this.logger.info('Secondary window hidden');
    
    // Notify main window that secondary is hidden - show orb
    if (this.mainWindowManager?.getWindow()?.webContents) {
      this.mainWindowManager.getWindow().webContents.send('window:secondaryWindowChange', false, null);
      this.logger.info('Sent secondary window hide event to main window renderer (show orb)');
    }
  }
}
```

### 5. Removed Unused Methods
**File**: `desktop2/main/windows/SecondaryWindowManager.js`

**Deleted:**
- `setupMaximumVisibility()` - No longer needed for normal window
- `setupEnhancedAlwaysOnTop()` - No longer needed for normal window

**Replaced with:**
```javascript
/**
 * NOTE: setupMaximumVisibility() and setupEnhancedAlwaysOnTop() have been REMOVED
 * 
 * The secondary window should behave like a NORMAL desktop window:
 * - NOT always-on-top
 * - Can be closed with traffic lights (macOS) or X button (Windows)
 * - Can be minimized
 * - Stays on the desktop/workspace it was opened on
 * - Doesn't float above everything
 * 
 * Only the main window (Arc Reactor orb) should have always-on-top behavior.
 */
```

## Complete Event Flow

### Opening Mission Control
```
1. User clicks Arc Reactor orb
   ↓
2. window.electronAPI.window.openSecondary('/mission-control')
   ↓
3. SecondaryWindowManager.create('/mission-control')
   ↓
4. Window shown and maximized (as normal desktop window)
   ↓
5. Send: window:secondaryWindowChange(true, '/mission-control')
   ↓
6. App.jsx receives event → setShowOrb(false)
   ↓
7. Orb disappears
```

### Closing Mission Control (Traffic Lights)
```
1. User clicks red traffic light (close button)
   ↓
2. 'close' event triggered
   ↓
3. Clean up intervals, notify main window
   ↓
4. Send: window:secondaryWindowChange(false, null)
   ↓
5. Window actually closes (no e.preventDefault())
   ↓
6. 'closed' event triggered → this.window = null
   ↓
7. App.jsx receives event → setShowOrb(true)
   ↓
8. Orb reappears
   ↓
9. Main window (orb) shown
```

### Switching to Different Window
```
1. User clicks on Chrome/VS Code/etc.
   ↓
2. 'blur' event triggered on secondary window
   ↓
3. Send: window:secondaryWindowChange(false, null)
   ↓
4. App.jsx receives event → setShowOrb(true)
   ↓
5. Orb appears (while Mission Control is still open but not focused)
```

### Switching Back to Mission Control
```
1. User clicks on Mission Control or Cmd+Tab back
   ↓
2. 'focus' event triggered
   ↓
3. Send: window:secondaryWindowChange(true, '/mission-control')
   ↓
4. App.jsx receives event → setShowOrb(false)
   ↓
5. Orb disappears
```

### Minimizing Mission Control
```
1. User clicks minimize button (−)
   ↓
2. 'minimize' event triggered
   ↓
3. Send: window:secondaryWindowChange(false, null)
   ↓
4. App.jsx receives event → setShowOrb(true)
   ↓
5. Orb appears
```

### Restoring Mission Control
```
1. User clicks Mission Control in dock to restore
   ↓
2. 'restore' event triggered
   ↓
3. Send: window:secondaryWindowChange(true, '/mission-control')
   ↓
4. App.jsx receives event → setShowOrb(false)
   ↓
5. Orb disappears
```

## Window Architecture

### Main Window (Arc Reactor Orb)
- **Always-on-top**: YES ✅
- **Size**: ~220x220px (tiny, just the orb)
- **Behavior**: Stays visible and draggable across all workspaces
- **Purpose**: Quick access to radial menu

### Secondary Window (Mission Control/Team Chat)
- **Always-on-top**: NO ❌
- **Size**: Maximized (fills entire screen)
- **Behavior**: Normal desktop window (can be closed, minimized, moved between workspaces)
- **Purpose**: Full application UI

## Benefits

✅ **Traffic lights work properly** - Window actually closes when user clicks red button
✅ **Normal window behavior** - Can be minimized, closed, moved between workspaces
✅ **Smart orb visibility** - Orb appears when user switches away, hides when focused
✅ **No aggressive always-on-top** - Secondary window doesn't float above everything
✅ **Clean separation** - Only orb has always-on-top, secondary window is normal
✅ **Better UX** - Orb is always accessible when user needs it

## Testing Checklist

- [x] Click red traffic light → window closes, orb appears
- [x] Click yellow traffic light (minimize) → window minimizes, orb appears
- [x] Click Mission Control in dock → window restores, orb disappears
- [x] Switch to Chrome with Cmd+Tab → orb appears
- [x] Switch back to Mission Control → orb disappears
- [x] Close window with Cmd+W → window closes, orb appears
- [x] Secondary window doesn't float above fullscreen apps
- [x] Secondary window stays on the workspace it was opened on

## Files Modified

1. **desktop2/main/windows/SecondaryWindowManager.js**
   - Removed `setupMaximumVisibility()` call
   - Removed `setupEnhancedAlwaysOnTop()` call
   - Removed `e.preventDefault()` from close handler
   - Added blur/focus/minimize/restore event handlers
   - Updated show() and hide() methods to notify about state changes
   - Deleted setupMaximumVisibility() and setupEnhancedAlwaysOnTop() methods

## No Changes Needed

- **App.jsx** - Already has correct logic for showing/hiding orb
- **preload.js** - Already has correct IPC bridge
- **window-handlers.js** - Already has correct IPC handlers
- **MainWindowManager.js** - Orb window correctly has always-on-top behavior

---

**Status**: ✅ COMPLETE

The secondary window now behaves like a normal desktop application window, and the orb visibility logic works correctly in all scenarios!

