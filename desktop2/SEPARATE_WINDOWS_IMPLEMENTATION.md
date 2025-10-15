# 🪟 Separate Windows Implementation - Complete

## 🎯 Architecture Change

**Before**: Single window that expanded/collapsed  
**After**: Two completely separate windows

### Window 1: Arc Reactor Orb (Main Window)
- Small window (220x220px)
- Bottom-left corner
- Always visible
- Shows only the Arc Reactor orb
- Clickable menu to trigger actions

### Window 2: Main UI (Secondary Window)
- Standard window (1000x700px)
- Opens on demand when menu item clicked
- Shows Tasks/Copilot interface
- Can be closed independently
- Orb window stays open

## 🔧 Implementation Details

### New Files Created

#### 1. SecondaryWindowManager.js
Location: `/desktop2/main/windows/SecondaryWindowManager.js`

**Features:**
- Creates secondary window on demand
- Manages navigation between routes
- Handles show/hide/toggle
- Prevents window destruction (just hides)
- Opens with specific route (Tasks/Copilot)

**Key Methods:**
```javascript
create(route)      // Create window with initial route
navigate(route)    // Navigate to different route
show()             // Show the window
hide()             // Hide the window
toggle()           // Toggle visibility
destroy()          // Fully close and destroy
```

### Modified Files

#### 2. index.js (Main Process)
- Added `SecondaryWindowManager` import
- Initialized `appState.windows.secondary`
- Window created on demand (not at startup)

#### 3. window-handlers.js (IPC Handlers)
Added new handlers:
```javascript
'window:openSecondary'     // Open secondary window with route
'window:navigateSecondary' // Navigate existing secondary window
'window:expandCopilot'     // Updated to open secondary window
```

#### 4. preload.js (Bridge)
Added new APIs:
```javascript
window.electronAPI.window.openSecondary(route)
window.electronAPI.window.navigateSecondary(route)
```

#### 5. ArcReactor.jsx (React Component)
- Updated `handleMenuItemClick` to call `openSecondary`
- Maps menu items to routes
- No longer navigates within same window
- Keeps orb window active after opening secondary

#### 6. App.jsx (React App)
- Detects if running in orb window or secondary window
- Shows Arc Reactor in orb window
- Shows main UI in secondary window
- Different layout for each window type

#### 7. global.css (Styles)
- Removed `.main-ui-panel` styles (no longer needed)
- Added `.app-secondary` for secondary window
- Simplified layout (no overlay needed)

## 🎬 User Flow

### Opening Tasks/Copilot:
```
1. User sees Arc Reactor orb in bottom-left
2. User clicks orb
3. Menu appears
4. User clicks "Tasks"
5. NEW WINDOW opens with Tasks interface
6. Orb window stays visible in corner
7. User can click orb again for menu
```

### Switching Views:
```
1. Tasks window is open
2. User clicks orb in corner
3. Menu appears over orb
4. User clicks "Chat"
5. Tasks window navigates to Chat
   OR
   Tasks window closes, new Chat window opens
```

### Closing:
```
1. User clicks minimize button in Tasks window
2. Tasks window closes
3. Orb window remains visible
4. User can reopen Tasks anytime
```

## 📊 Window Configuration

### Main Window (Orb)
```javascript
{
  width: 220,
  height: 220,
  transparent: true,
  frame: false,
  alwaysOnTop: true,
  position: 'bottom-left'
}
```

### Secondary Window (UI)
```javascript
{
  width: 1000,
  height: 700,
  minWidth: 800,
  minHeight: 600,
  titleBarStyle: 'hiddenInset',
  backgroundColor: '#1c1c1e',
  vibrancy: 'under-window'
}
```

## 🔄 Route Mapping

Menu items map to routes in secondary window:

| Menu Item | Route      | Content |
|-----------|------------|---------|
| Tasks     | /tasks     | Tasks page |
| Chat      | /copilot   | Copilot page |
| Code      | /copilot   | Copilot page |
| Settings  | /tasks     | Tasks page |

## 🎯 Benefits

✅ **True separation** - windows are completely independent  
✅ **Orb always accessible** - never covered or hidden  
✅ **Better multitasking** - can position windows separately  
✅ **Cleaner architecture** - each window has single purpose  
✅ **Mac-native feel** - multiple windows like native apps  
✅ **Performance** - each window manages own resources  

## 🧪 Testing

### Start the App
```bash
cd /Users/jarvis/Code/HeyJarvis/desktop2
npm run dev
```

### Test Checklist

**Orb Window:**
- [ ] Small window appears in bottom-left
- [ ] Orb is visible and glowing
- [ ] Click orb to show menu
- [ ] Menu appears above orb

**Opening Secondary Window:**
- [ ] Click "Tasks" in menu
- [ ] NEW window opens with Tasks
- [ ] Orb window stays visible
- [ ] Can still click orb

**Navigation:**
- [ ] Click orb again while Tasks open
- [ ] Select "Chat" from menu
- [ ] Secondary window navigates to Chat
- [ ] Or new window opens

**Closing:**
- [ ] Click minimize in secondary window
- [ ] Secondary window closes
- [ ] Orb window remains
- [ ] Can reopen Tasks

## 🚀 Future Enhancements

### Multiple Secondary Windows
Could support multiple secondary windows:
- One for Tasks
- One for Copilot
- One for Code Indexer

### Window Management
- Remember window positions
- Save window state
- Restore on restart

### Inter-Window Communication
- Send data between windows
- Sync state across windows
- Shared context

## 📝 Technical Notes

### Why This Works Better

**Before (Single Window):**
- Complex layout management
- Z-index conflicts
- Pointer-events complexity
- State management issues

**After (Separate Windows):**
- Simple layouts
- No z-index conflicts
- Each window has own pointer-events
- Isolated state

### Route Detection
Secondary window uses URL hash to detect routes:
```javascript
const isOrbWindow = !window.location.hash || window.location.hash === '#/';
```

Orb window: `http://localhost:5173/` or `http://localhost:5173/#/`  
Secondary window: `http://localhost:5173/#/tasks`

---

**Status**: ✅ **IMPLEMENTED**  
**Architecture**: Two separate Electron windows  
**User Experience**: Orb triggers new window, stays visible  
**Ready**: Restart app to test!

**To test, kill and restart:**
```bash
killall Electron
cd /Users/jarvis/Code/HeyJarvis/desktop2 && npm run dev
```


