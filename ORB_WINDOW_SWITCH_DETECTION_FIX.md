# Orb Window Switch Detection Fix ✅

## Problem
When Mission Control was maximized and you switched to a different window (e.g., clicked on Chrome, VS Code, etc.), the orb didn't reappear. It only appeared when Mission Control was fully closed.

## Root Cause
The `SecondaryWindowManager` was only sending notifications to the main window (to show/hide the orb) in these cases:
- ✅ Window closed (`close` event)
- ❌ Window lost focus (no `blur` event handler)
- ❌ Window minimized (no `minimize` event handler)

We needed to listen for more window state changes!

## Solution
Added comprehensive window state event handlers to detect when the user switches away from or back to Mission Control.

### New Event Handlers Added

**File**: `desktop2/main/windows/SecondaryWindowManager.js`

#### 1. Blur Event (User Switched to Different Window)
```javascript
this.window.on('blur', () => {
  this.logger.debug('Secondary window lost focus (blur)');
  // Notify main window that user switched away - show orb
  if (this.mainWindow) {
    this.mainWindow.webContents.send('secondary-window:changed', false, null);
    this.logger.debug('Notified main window: secondary blurred (show orb)');
  }
});
```

**Triggered When:**
- User clicks on another application window
- User switches to another window with Cmd+Tab (macOS) or Alt+Tab (Windows)
- User clicks on desktop or another app

**Result:** Orb appears! ✅

---

#### 2. Focus Event (User Switched Back to Mission Control)
```javascript
this.window.on('focus', () => {
  this.logger.debug('Secondary window gained focus');
  // Notify main window that user is back - hide orb
  if (this.mainWindow) {
    this.mainWindow.webContents.send('secondary-window:changed', true, this.currentRoute);
    this.logger.debug('Notified main window: secondary focused (hide orb)');
  }
});
```

**Triggered When:**
- User clicks back on Mission Control window
- User switches back with Cmd+Tab or Alt+Tab
- User clicks Mission Control in dock/taskbar

**Result:** Orb hides! ✅

---

#### 3. Minimize Event
```javascript
this.window.on('minimize', () => {
  this.logger.debug('Secondary window minimized');
  // Show orb when minimized
  if (this.mainWindow) {
    this.mainWindow.webContents.send('secondary-window:changed', false, null);
    this.logger.debug('Notified main window: secondary minimized (show orb)');
  }
});
```

**Triggered When:**
- User clicks minimize button (−)
- User uses keyboard shortcut to minimize

**Result:** Orb appears! ✅

---

#### 4. Restore Event (From Minimize)
```javascript
this.window.on('restore', () => {
  this.logger.debug('Secondary window restored');
  // Hide orb when restored
  if (this.mainWindow) {
    this.mainWindow.webContents.send('secondary-window:changed', true, this.currentRoute);
    this.logger.debug('Notified main window: secondary restored (hide orb)');
  }
});
```

**Triggered When:**
- User clicks Mission Control in dock/taskbar to restore
- User restores from minimized state

**Result:** Orb hides! ✅

---

### Enhanced Existing Methods

#### Updated `show()` Method
```javascript
show() {
  // ... show logic ...
  
  // Notify main window that secondary is now visible and focused
  if (this.mainWindow) {
    this.mainWindow.webContents.send('secondary-window:changed', true, this.currentRoute);
    this.logger.debug('Notified main window: secondary shown (hide orb)');
  }
}
```

#### Updated `hide()` Method
```javascript
hide() {
  if (this.window) {
    this.window.hide();
    
    // Notify main window that secondary is hidden - show orb
    if (this.mainWindow) {
      this.mainWindow.webContents.send('secondary-window:changed', false, null);
      this.logger.debug('Notified main window: secondary hidden (show orb)');
    }
  }
}
```

---

## Complete Event Flow

### Scenario 1: User Opens Mission Control
```
1. User clicks orb
   ↓
2. SecondaryWindowManager.create() or show()
   ↓
3. Window shown and focused
   ↓
4. Send: secondary-window:changed(true, '/mission-control')
   ↓
5. ✅ Orb HIDES
```

### Scenario 2: User Switches to Chrome
```
1. User clicks Chrome window
   ↓
2. Mission Control loses focus (blur event)
   ↓
3. Send: secondary-window:changed(false, null)
   ↓
4. ✅ Orb APPEARS
```

### Scenario 3: User Switches Back to Mission Control
```
1. User clicks Mission Control or Cmd+Tab
   ↓
2. Mission Control gains focus (focus event)
   ↓
3. Send: secondary-window:changed(true, '/mission-control')
   ↓
4. ✅ Orb HIDES
```

### Scenario 4: User Minimizes Mission Control
```
1. User clicks minimize button
   ↓
2. Mission Control minimized (minimize event)
   ↓
3. Send: secondary-window:changed(false, null)
   ↓
4. ✅ Orb APPEARS
```

### Scenario 5: User Closes Mission Control
```
1. User clicks close button (✕)
   ↓
2. Window prevented from destroying (close event)
   ↓
3. Window hidden instead
   ↓
4. Send: secondary-window:changed(false, null)
   ↓
5. ✅ Orb APPEARS
```

---

## Debug Logging

When switching windows, you'll now see detailed logs:

### When Switching Away:
```
Secondary window lost focus (blur)
Notified main window: secondary blurred (show orb)
```

### When Switching Back:
```
Secondary window gained focus
Notified main window: secondary focused (hide orb)
```

### When Minimizing:
```
Secondary window minimized
Notified main window: secondary minimized (show orb)
```

### When Restoring:
```
Secondary window restored
Notified main window: secondary restored (hide orb)
```

---

## Testing Checklist

### ✅ Test All Window States

1. **Open Mission Control**
   - Click orb
   - ✅ Mission Control opens maximized
   - ✅ Orb disappears

2. **Switch to Another Window**
   - Click Chrome, VS Code, Terminal, etc.
   - ✅ Orb reappears immediately

3. **Switch Back with Click**
   - Click Mission Control window
   - ✅ Orb disappears

4. **Switch Back with Cmd+Tab (macOS) / Alt+Tab (Windows)**
   - Use keyboard shortcut to switch to Mission Control
   - ✅ Orb disappears

5. **Minimize Mission Control**
   - Click minimize button (−)
   - ✅ Orb reappears

6. **Restore from Dock/Taskbar**
   - Click Mission Control in dock
   - ✅ Mission Control restores
   - ✅ Orb disappears

7. **Close Mission Control**
   - Click close button (✕)
   - ✅ Window hides (doesn't destroy)
   - ✅ Orb reappears

8. **Multi-Desktop Test (macOS)**
   - Open Mission Control on Desktop 1
   - Swipe to Desktop 2
   - ✅ Orb appears on Desktop 2
   - Swipe back to Desktop 1
   - ✅ Orb disappears (Mission Control visible)

---

## Summary

### Events Now Monitored:
| Event | Action | Orb State |
|-------|--------|-----------|
| `close` | Hide window | Show Orb ✅ |
| `blur` | Lost focus | Show Orb ✅ |
| `focus` | Gained focus | Hide Orb ✅ |
| `minimize` | Minimized | Show Orb ✅ |
| `restore` | Restored | Hide Orb ✅ |
| `show()` | Window shown | Hide Orb ✅ |
| `hide()` | Window hidden | Show Orb ✅ |

### Result:
The orb now intelligently shows/hides based on whether Mission Control is:
- ✅ Visible and focused → Hide orb
- ✅ Hidden, minimized, or not focused → Show orb

---

✅ **Status**: COMPLETE
- Blur event handler added ✓
- Focus event handler added ✓
- Minimize event handler added ✓
- Restore event handler added ✓
- Show/hide methods updated ✓
- Debug logging enhanced ✓

**The orb now appears whenever you switch away from Mission Control!** 🎉
