# Direct Orb → Mission Control Flow ✅

## Summary
Implemented a streamlined UX where clicking the Arc Reactor orb directly opens Mission Control (no menu), and the orb intelligently hides/shows based on Mission Control visibility.

## New User Flow

### Before (Old Flow)
```
1. User clicks orb
2. Radial menu appears
3. User clicks "Mission Control" in menu
4. Mission Control opens in secondary window
5. Orb stays visible (always)
```

### After (New Flow)
```
1. User clicks orb → Mission Control opens directly
2. Orb automatically hides
3. User closes Mission Control
4. Orb automatically reappears
```

## Implementation Details

### 1. **ArcReactor.jsx** - Direct Navigation
**File**: `desktop2/renderer2/src/components/ArcReactor/ArcReactor.jsx`

**Changed:**
```javascript
const handleMenuToggle = async () => {
  console.log('🎯 [ARCREACTOR] Orb clicked - opening Mission Control directly');
  
  // Open Mission Control directly (no menu)
  if (window.electronAPI?.window?.openSecondary) {
    await window.electronAPI.window.openSecondary('/mission-control');
    console.log('🪟 [ARCREACTOR] Mission Control window opened');
  }
};
```

**Result**: Clicking the orb now immediately opens Mission Control without showing the radial menu.

---

### 2. **preload.js** - Window State Tracking API
**File**: `desktop2/bridge/preload.js`

**Added:**
```javascript
window: {
  // ... existing methods
  // Secondary window state tracking
  onSecondaryWindowChange: (callback) => {
    const listener = (event, isOpen, route) => callback(isOpen, route);
    ipcRenderer.on('secondary-window:changed', listener);
    return () => ipcRenderer.removeListener('secondary-window:changed', listener);
  }
}
```

**Result**: React components can now listen for secondary window state changes.

---

### 3. **window-handlers.js** - Notify Main Window
**File**: `desktop2/main/ipc/window-handlers.js`

**Added notification when secondary window opens:**
```javascript
ipcMain.handle('window:openSecondary', async (event, route = '/tasks') => {
  // ... existing code
  
  // Notify main window that secondary window opened
  if (windows.main?.getWindow()) {
    windows.main.getWindow().webContents.send('secondary-window:changed', true, route);
    logger.debug('Notified main window: secondary opened', { route });
  }
  
  return { success: true };
});
```

**Result**: Main window is notified when Mission Control opens.

---

### 4. **SecondaryWindowManager.js** - Notify on Close
**File**: `desktop2/main/windows/SecondaryWindowManager.js`

**Changed constructor to accept main window reference:**
```javascript
constructor(logger, mainWindow = null) {
  this.logger = logger;
  this.window = null;
  this.currentRoute = '/tasks';
  this.mainWindow = mainWindow; // Reference to main window for notifications
}
```

**Added notification when window closes:**
```javascript
this.window.on('close', (e) => {
  if (this.window) {
    e.preventDefault();
    this.window.hide();
    
    // Notify main window that secondary window closed
    if (this.mainWindow) {
      this.mainWindow.webContents.send('secondary-window:changed', false, null);
      this.logger.debug('Notified main window: secondary closed');
    }
  }
});
```

**Result**: Main window is notified when Mission Control closes.

---

### 5. **index.js** - Pass Main Window Reference
**File**: `desktop2/main/index.js`

**Changed:**
```javascript
// Create secondary window manager (for Tasks/Copilot UI)
// Pass main window reference for notifications
appState.windows.secondary = new SecondaryWindowManager(
  logger, 
  appState.windows.main.getWindow()
);
```

**Result**: Secondary window manager can now notify main window of state changes.

---

### 6. **App.jsx** - Conditional Orb Visibility
**File**: `desktop2/renderer2/src/App.jsx`

**Added state:**
```javascript
// Orb visibility state - hide when Mission Control is open
const [showOrb, setShowOrb] = useState(true);
```

**Added listener:**
```javascript
// Listen for secondary window (Mission Control) state changes
useEffect(() => {
  if (window.electronAPI?.window?.onSecondaryWindowChange) {
    const cleanup = window.electronAPI.window.onSecondaryWindowChange((isOpen, route) => {
      // Hide orb when Mission Control window is open, show when closed
      const shouldHideOrb = isOpen && route === '/mission-control';
      setShowOrb(!shouldHideOrb);
      console.log(`🪟 Secondary window ${isOpen ? 'opened' : 'closed'}: ${route}, Orb visible: ${!shouldHideOrb}`);
    });
    
    return cleanup;
  }
}, []);
```

**Updated render:**
```javascript
if (isOrbWindow) {
  return (
    <div className="app app-collapsed">
      {showOrb && (
        <ArcReactor
          isCollapsed={true}
          onNavigate={handleArcReactorNavigate}
        />
      )}
    </div>
  );
}
```

**Result**: Orb is hidden when Mission Control is open, shown when it closes.

---

## Architecture Flow

### Opening Mission Control
```
1. User clicks Arc Reactor orb
   ↓
2. ArcReactor.jsx → window.electronAPI.window.openSecondary('/mission-control')
   ↓
3. window-handlers.js → windows.secondary.create('/mission-control')
   ↓
4. window-handlers.js → windows.main.webContents.send('secondary-window:changed', true, '/mission-control')
   ↓
5. App.jsx receives event → setShowOrb(false)
   ↓
6. Orb disappears from view
   ↓
7. Mission Control window opens
```

### Closing Mission Control
```
1. User clicks close button on Mission Control
   ↓
2. SecondaryWindowManager.js → window.on('close') triggered
   ↓
3. SecondaryWindowManager.js → mainWindow.webContents.send('secondary-window:changed', false, null)
   ↓
4. App.jsx receives event → setShowOrb(true)
   ↓
5. Orb reappears
```

---

## Benefits

✅ **Simpler UX**: One click to Mission Control (removed intermediate menu step)
✅ **Cleaner Interface**: Orb hides when not needed
✅ **Automatic Behavior**: No manual show/hide required
✅ **Context Aware**: Orb appears when on different screens
✅ **Extensible**: Can easily add logic for other routes

---

## Testing

### Manual Test Steps

1. **Start the app**
   ```bash
   cd /Users/jarvis/Code/HeyJarvis
   npm run dev:desktop
   ```

2. **Test opening Mission Control**
   - Click the Arc Reactor orb
   - ✅ Mission Control should open immediately
   - ✅ Orb should disappear

3. **Test closing Mission Control**
   - Click the close button (✕) on Mission Control
   - ✅ Mission Control window closes
   - ✅ Orb should reappear

4. **Test with other routes** (optional)
   - Open other pages (Tasks, Settings, etc.)
   - ✅ Orb should remain visible (only hides for Mission Control)

---

## Files Modified

1. ✅ `desktop2/renderer2/src/components/ArcReactor/ArcReactor.jsx` - Direct navigation
2. ✅ `desktop2/bridge/preload.js` - Window state tracking API
3. ✅ `desktop2/main/ipc/window-handlers.js` - Notify on open
4. ✅ `desktop2/main/windows/SecondaryWindowManager.js` - Notify on close
5. ✅ `desktop2/main/index.js` - Pass main window reference
6. ✅ `desktop2/renderer2/src/App.jsx` - Conditional orb visibility

---

## Debug Logging

When testing, you'll see console logs:
```
🎯 [ARCREACTOR] Orb clicked - opening Mission Control directly
🪟 [ARCREACTOR] Mission Control window opened
🪟 Secondary window opened: /mission-control, Orb visible: false
🪟 Secondary window closed: null, Orb visible: true
```

---

✅ **Status**: COMPLETE AND READY TO USE
- Direct orb → Mission Control navigation ✓
- Automatic orb hiding/showing ✓
- Window state tracking system ✓
- No linting errors ✓

**The orb now provides a seamless, one-click path to Mission Control!** 🚀
