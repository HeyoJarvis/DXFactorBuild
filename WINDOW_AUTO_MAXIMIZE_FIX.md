# Window Auto-Maximize Fix

## 🐛 Problem
When clicking Mission Control (or any page) from the Arc Reactor orb, the secondary window would open at a fixed size (1280x820px) instead of filling the entire screen like a normal desktop application.

**User Experience Issue:**
- Window opens in the center of the screen at a small size
- User has to manually click the maximize button
- Doesn't feel like a native full-screen desktop app

## ✅ Solution
Modified `SecondaryWindowManager.js` to **automatically maximize** the window when it's created and when it's shown.

## 📝 Changes Made

### File: `desktop2/main/windows/SecondaryWindowManager.js`

#### 1. Auto-Maximize on Window Creation (lines 82-84)
```javascript
this.window.once('ready-to-show', () => {
  this.logger.info('Secondary window ready to show');
  
  // CRITICAL: Ensure mouse events are NOT ignored (this is a clickable window)
  this.window.setIgnoreMouseEvents(false);
  this.logger.info('Mouse events enabled for secondary window');
  
  this.window.show();
  
  // ✅ NEW: Maximize the window to fill the screen (like a normal desktop app)
  this.window.maximize();
  this.logger.info('Secondary window maximized');
  
  // Setup maximum visibility (same as Arc Reactor)
  this.setupMaximumVisibility();
  
  // Setup enhanced always-on-top behavior (same as Arc Reactor)
  this.setupEnhancedAlwaysOnTop();
  
  if (isDev) {
    this.window.webContents.openDevTools({ mode: 'detached' });
  }
});
```

#### 2. Auto-Maximize When Showing Existing Window (lines 232-235)
```javascript
show() {
  if (!this.window) {
    this.create();
    return;
  }

  // Ensure mouse events are enabled before showing
  this.window.setIgnoreMouseEvents(false);
  this.window.show();
  
  // ✅ NEW: Maximize the window to fill the screen
  if (!this.window.isMaximized()) {
    this.window.maximize();
  }
  
  this.window.focus();
  this.logger.info('Secondary window shown and maximized with mouse events enabled');
}
```

## 🎯 Result

### Before:
```
User clicks Mission Control
  ↓
Window opens at 1280x820px (centered)
  ↓
User manually clicks maximize button
  ↓
Window fills screen
```

### After:
```
User clicks Mission Control
  ↓
Window opens **already maximized** (fills entire screen)
  ↓
Ready to use immediately!
```

## 🪟 Window Behavior

### Initial Creation:
1. Window is created with base size (1280x820)
2. Window is shown
3. **Window is immediately maximized** via `window.maximize()`
4. Result: Window fills the entire screen

### Re-Showing Existing Window:
1. Check if window is already maximized
2. If not, maximize it
3. Focus the window
4. Result: Consistent maximized experience

## 🎨 User Experience Benefits

1. **Native Desktop Feel**: Opens like any other desktop application (VS Code, Slack, etc.)
2. **No Manual Action Required**: User doesn't need to click maximize
3. **Consistent Behavior**: All pages (Tasks, Mission Control, Copilot, etc.) open maximized
4. **User Control Preserved**: User can still un-maximize/resize if they want
5. **Professional Appearance**: Looks polished and intentional

## 🔧 Technical Details

### Electron BrowserWindow API:
- `window.maximize()`: Maximizes the window to fill the screen
- `window.isMaximized()`: Checks if the window is currently maximized
- `window.unmaximize()`: User can un-maximize via standard window controls

### Platform Support:
- ✅ **macOS**: Works perfectly with native maximize behavior
- ✅ **Windows**: Works with Windows 11 acrylic effects
- ✅ **Linux**: Standard maximize behavior

## 🧪 Testing

To verify the fix:
1. Start the app: `npm run dev:desktop`
2. Click the Arc Reactor orb
3. Click any menu item (Mission Control, Tasks, Copilot, etc.)
4. **Expected**: Window opens **already maximized**, filling the entire screen
5. **Expected**: No need to click maximize button
6. **Expected**: User can still un-maximize if desired

## 📊 Affected Pages

All secondary windows now open maximized:
- ✅ Mission Control
- ✅ Tasks (Developer & Sales)
- ✅ Copilot
- ✅ Architecture Diagram
- ✅ Code Indexer
- ✅ Settings
- ✅ Team Chat

## 🚀 Impact

- **Better UX**: Immediate full-screen experience
- **More Professional**: Matches user expectations for desktop apps
- **Less Friction**: One less click for the user
- **Consistent**: All pages behave the same way

