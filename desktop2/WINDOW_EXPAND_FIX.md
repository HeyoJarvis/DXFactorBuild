# 🪟 Window Expand/Collapse Fixed

## Problem
When clicking menu items, the window wasn't expanding from the small 200x200 Arc Reactor orb to the full 656x900 UI.

## ✅ Solution

Updated the window expand/collapse functions to use proper Arc Reactor dimensions instead of the old header/chat dimensions.

### Changes Made

**File**: `MainWindowManager.js`

#### 1. **expandToFullChat()** - Now expands to Arc Reactor full size
```javascript
// Arc Reactor expanded size
const expandedWidth = 656;
const expandedHeight = 900;

// Center the window on screen
const x = Math.floor((screenWidth - expandedWidth) / 2);
const y = Math.floor((screenHeight - expandedHeight) / 2);

this.window.setBounds({ x, y, width: 656, height: 900 });
this.window.setBackgroundColor('#1c1c1e'); // Solid background
```

#### 2. **collapseToHeader()** - Now collapses to Arc Reactor orb
```javascript
// Arc Reactor orb size
const orbWidth = 200;
const orbHeight = 200;

// Position in bottom-left corner
const x = 20;
const y = screenHeight - orbHeight - 20;

this.window.setBounds({ x, y, width: 200, height: 200 });
this.window.setBackgroundColor('#00000000'); // Transparent
```

## 🎯 Window States

### Collapsed (Arc Reactor Orb Only)
- **Size**: 200x200 pixels
- **Position**: Bottom-left corner (x: 20, y: screen_height - 220)
- **Background**: Transparent (`#00000000`)
- **Resizable**: No
- **Content**: Just the Arc Reactor orb

### Expanded (Full UI)
- **Size**: 656x900 pixels
- **Position**: Centered on screen
- **Background**: Solid dark (`#1c1c1e`)
- **Resizable**: Yes (minimum 656x900)
- **Content**: Navigation + Routes (Copilot/Tasks) + Arc Reactor overlay

## 🧪 Test Now!

The app should still be running. Try this:

### 1. Click a Menu Item
1. Click the Arc Reactor orb to open menu
2. Click **"Tasks"** or **"AI Copilot"**
3. Window should **expand to 656x900** and **center on screen**
4. You should see the full UI with navigation

### 2. Minimize Back
1. In expanded mode, click the **minimize button** in navigation
2. Window should **shrink to 200x200**
3. Window should **move to bottom-left corner**
4. Only Arc Reactor orb visible

### 3. Check Logs
Watch the terminal/DevTools console for:
```
🔄 Expanding window to full UI...
✅ Window expanded to 656x900 at (536, 93)  ← Your screen position may vary
```

And when minimizing:
```
🔄 Collapsing window to Arc Reactor orb...
✅ Window collapsed to Arc Reactor orb
```

## 📊 Dimensions Reference

### Before (Broken):
```javascript
// Was using old chat dimensions
fullChatDefaults = {
  width: 1200,  // ❌ Too wide
  height: 800   // ❌ Not tall enough
}
```

### After (Fixed):
```javascript
// Arc Reactor dimensions
expanded = {
  width: 656,   // ✅ Perfect for Arc Reactor UI
  height: 900   // ✅ Tall enough for content
}

collapsed = {
  width: 200,   // ✅ Just big enough for orb
  height: 200   // ✅ Square orb window
}
```

## 🎨 Visual Flow

```
Arc Reactor Orb (200x200, bottom-left)
    ↓
User clicks menu item
    ↓
Window expands to 656x900 (centered)
    ↓
Full UI visible: Navigation + Content + Orb overlay
    ↓
User clicks minimize
    ↓
Window collapses back to 200x200 (bottom-left)
    ↓
Only orb visible again
```

## 🚀 Ready to Test!

**No need to restart** - the changes are in the main process and will be used next time you click a menu item.

Try clicking **"Tasks"** from the Arc Reactor menu now - the window should expand to full size and center on your screen! 🎉

