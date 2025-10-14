# 🚨 Emergency Escape & Testing Guide

## 🛡️ Emergency Quit Shortcuts (ALWAYS AVAILABLE)

If the window is blocking your screen, you can **ALWAYS** quit using these keyboard shortcuts:

### macOS / Windows Shortcuts:
- **`Cmd+Q`** (Mac) or **`Ctrl+Q`** (Windows) - Quit app
- **`Cmd+Escape`** (Mac) or **`Ctrl+Escape`** (Windows) - Force quit
- **`Cmd+Shift+Q`** (Mac) or **`Ctrl+Shift+Q`** (Windows) - Also quit

### Terminal Fallback:
If shortcuts don't work, from ANY terminal run:
```bash
killall -9 Electron
```

## 🧪 Testing the Arc Reactor

### Step 1: Start the App
```bash
cd /Users/jarvis/Code/HeyJarvis/desktop2
npm run dev
```

### Step 2: What You Should See
- **Small 200x200 window** in the bottom-left corner
- **Arc Reactor orb** visible and glowing
- **Desktop remains clickable** - you can interact with other apps/files
- **No full-screen blocking**

### Step 3: Test Arc Reactor Interaction
1. **Hover over the orb** - cursor should change to "grab" hand
2. **Click the orb** - radial menu should appear above it
3. **Click a menu item** - window should expand and show that view
4. **Desktop clickable** - try clicking desktop icons/files (should work!)

### Step 4: Test Dragging
1. **Click and hold** the orb
2. **Move mouse** - orb should follow
3. **Release** - orb stays in new position
4. Orb should **stay within screen bounds** (doesn't disappear)

### Step 5: Test Role Toggle
1. **Click the orb** to open menu
2. **Role toggle** should appear at top of menu
3. **Click toggle** - should switch between "Developer" and "Sales"
4. **Menu items change** based on role:
   - **Developer**: AI Copilot, Tasks, Code Indexer, GitHub
   - **Sales**: AI Copilot, Tasks, CRM Dashboard, Deals

### Step 6: Test Expansion
1. **Click any menu item** (e.g., "Tasks")
2. **Window expands** to 656x900
3. **Content loads** (Tasks page visible)
4. **Arc Reactor still visible** in expanded mode

### Step 7: Test Minimize
1. In expanded mode, click **minimize** button in Navigation
2. **Window shrinks** back to 200x200
3. **Only Arc Reactor visible**

## ✅ What's Fixed

### 1. **No More Full-Screen Blocking**
- Window starts at **200x200** in bottom-left corner
- **Not** full-screen transparent overlay
- Desktop remains fully accessible

### 2. **Removed Loading Screen & Header**
- App starts **directly with Arc Reactor orb**
- No loading animation
- No JarvisHeader intermediate state

### 3. **Emergency Escape**
- **Global keyboard shortcuts** registered FIRST (before anything else)
- Always available, even if window is frozen/blocking
- Multiple escape routes (Cmd+Q, Cmd+Escape, Cmd+Shift+Q)

### 4. **Mouse Event Handling**
- Window **doesn't block clicks** by default
- Only the **Arc Reactor elements** capture mouse events
- CSS `pointer-events: none` on transparent areas

### 5. **Dynamic Resizing**
- **Collapsed**: 200x200 (Arc Reactor only)
- **Expanded**: 656x900 (Full UI)
- Smooth transitions via IPC

## 🐛 Known Issues & Troubleshooting

### Issue: Window still blocks screen
**Solution**: Press `Cmd+Q` or `Cmd+Escape` immediately, then check logs:
```bash
tail -50 /tmp/desktop2-dev.log | grep -i "mouse\|transparent"
```

### Issue: Can't see the orb
**Solution**: Check bottom-left corner of screen. If not visible:
```bash
# Stop app
killall -9 Electron

# Check logs for window position
tail -50 /tmp/desktop2-dev.log | grep "Window created"
```

### Issue: Orb disappears when dragging
**Solution**: This should be fixed with position clamping. If it still happens:
1. Press `Cmd+Q` to quit
2. Check `ArcReactorOrb.jsx` handleMouseMove for clamping logic

### Issue: Menu doesn't open
**Solution**: 
1. Check console logs: `tail -50 /tmp/desktop2-dev.log`
2. Look for "Arc Reactor" or "menu" errors
3. Verify IPC handlers are registered

## 📊 Key Changes Made

### App.jsx
- ✅ Removed `LoadingScreen` import and usage
- ✅ Removed `JarvisHeader` import and usage
- ✅ Start with `isCollapsed={true}` (Arc Reactor only)
- ✅ No intermediate states - goes straight to Arc Reactor

### MainWindowManager.js
- ✅ Start with **200x200 window** (not full-screen)
- ✅ Position at **bottom-left** (x: 20, y: screenHeight - 220)
- ✅ `setIgnoreMouseEvents(false)` - don't block clicks
- ✅ Still transparent, but small window area

### index.js (Main Process)
- ✅ Import `globalShortcut` from electron
- ✅ Register **emergency shortcuts FIRST** in `setupEmergencyShortcuts()`
- ✅ Call `setupEmergencyShortcuts()` before creating windows
- ✅ Three escape routes: Cmd+Q, Cmd+Escape, Cmd+Shift+Q

### CSS (global.css)
- ✅ `#root { pointer-events: none }` - let clicks pass through
- ✅ `.app { pointer-events: auto }` - re-enable for expanded mode
- ✅ `.app-collapsed { pointer-events: none }` - pass through in collapsed mode

### ArcReactor Components
- ✅ Only Arc Reactor elements have `pointer-events: auto`
- ✅ Mouse enter/leave handlers to manage click forwarding
- ✅ Position clamping to keep orb on screen

## 🎯 Testing Checklist

Before reporting issues, verify:

- [ ] Window is 200x200 in bottom-left corner
- [ ] Desktop icons/files are clickable
- [ ] Arc Reactor orb is visible
- [ ] Orb changes cursor to "grab" on hover
- [ ] Quick click opens menu
- [ ] Menu items are visible and styled correctly
- [ ] Clicking menu item expands window
- [ ] Role toggle works (switches between Developer/Sales)
- [ ] Dragging works (hold and move)
- [ ] Orb stays within screen bounds
- [ ] Emergency quit works (Cmd+Q)

## 🚀 Start Testing Now!

```bash
cd /Users/jarvis/Code/HeyJarvis/desktop2
npm run dev
```

**Remember**: If anything goes wrong, press **`Cmd+Q`** or **`Cmd+Escape`** to quit immediately! 🛡️

