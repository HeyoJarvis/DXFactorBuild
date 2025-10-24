# Draggable Mode Toggle Header

## 🎯 Goal
Make the ModeToggle header (with "Personal", "Switch to Team", and user name) draggable so users can move the window by dragging this header area.

## ✅ Solution
Added `-webkit-app-region: drag` to the ModeToggle container and `-webkit-app-region: no-drag` to interactive elements (buttons, dropdown).

## 📝 Changes Made

### File: `desktop2/renderer2/src/components/MissionControl/ModeToggle.css`

#### 1. Made Container Draggable
```css
.mode-toggle-container {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 24px;
  background: rgba(15, 23, 42, 0.95);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  position: sticky;
  top: 0;
  z-index: 100;
  -webkit-app-region: drag; /* ✅ Make header draggable */
  cursor: move; /* ✅ Visual feedback */
}
```

#### 2. Kept Buttons Clickable
```css
.mode-switch-button {
  /* ... existing styles ... */
  -webkit-app-region: no-drag; /* ✅ Keep button clickable */
}

.mode-back-button {
  /* ... existing styles ... */
  -webkit-app-region: no-drag; /* ✅ Keep button clickable */
}
```

#### 3. Kept Dropdown Clickable
```css
.team-selector-dropdown {
  /* ... existing styles ... */
  -webkit-app-region: no-drag; /* ✅ Keep dropdown clickable */
}
```

## 🎨 User Experience

### Header Layout:
```
┌─────────────────────────────────────────────────────────────────┐
│ HeyJarvis                                       [- □ ×]         │ ← Native title bar
├─────────────────────────────────────────────────────────────────┤
│ [🏠 Personal] [Switch to Team →]        [👤 User Name] [⌘+T]   │ ← DRAGGABLE!
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│                    Mission Control Content                      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Interaction Zones:

**Draggable Areas** (move window):
- Empty space in the header
- Around the "Personal" badge
- Around the user name/avatar
- Around the keyboard shortcut hint

**Clickable Areas** (no drag):
- "Switch to Team" button
- "Back to Personal" button
- Team selector dropdown
- User avatar (if clickable)

## 🔧 How It Works

### `-webkit-app-region: drag`
- Makes the element act as a window drag handle
- User can click and drag to move the window
- Only works in Electron apps with native frames

### `-webkit-app-region: no-drag`
- Overrides the drag behavior for child elements
- Allows buttons, inputs, and dropdowns to remain interactive
- Essential for functional UI elements within a draggable area

### Cursor Feedback
- `cursor: move` on the container provides visual feedback
- Shows that the header can be dragged
- Buttons still show `cursor: pointer` when hovered

## 🎯 Benefits

1. **Intuitive Window Movement**
   - Users can drag the header to move the window
   - Familiar behavior from other desktop apps
   - No need for a separate drag handle

2. **Functional Elements Preserved**
   - All buttons remain clickable
   - Dropdown still works normally
   - No loss of functionality

3. **Clean Design**
   - No separate title bar needed
   - Header serves dual purpose (navigation + dragging)
   - Maximizes content space

4. **Native Feel**
   - Matches behavior of apps like VS Code, Slack, Discord
   - Professional desktop app experience

## 📊 Comparison with Other Apps

### VS Code:
- Title bar is draggable
- Buttons in title bar are clickable
- Same pattern we're using

### Slack:
- Header area is draggable
- Interactive elements remain functional
- Same pattern we're using

### Discord:
- Top bar is draggable
- Buttons and controls work normally
- Same pattern we're using

## 🧪 Testing

To verify the draggable header:
1. Restart the app: `npm run dev:desktop`
2. Click the Arc Reactor orb
3. Click Mission Control
4. **Expected**:
   - Click and drag the dark header area → window moves
   - Click "Switch to Team" button → mode changes (no drag)
   - Click team dropdown → dropdown opens (no drag)
   - Click user avatar → stays in place (no drag)
   - Cursor shows "move" icon over draggable areas
   - Cursor shows "pointer" over buttons

## 🎨 Visual Feedback

### Draggable Area:
- Dark blue/slate background
- `cursor: move` when hovering over empty space
- Entire header width is draggable (except buttons)

### Interactive Elements:
- Buttons have hover effects
- `cursor: pointer` when hovering
- Click works normally (no drag)

## 🚀 Future Enhancements

Possible improvements:
1. Add subtle visual indicator (e.g., dots or grip lines) to show draggable area
2. Add double-click to maximize/restore window
3. Add right-click context menu for window controls
4. Add smooth drag animations

## 📋 Platform Support

- ✅ **macOS**: Full support with `hiddenInset` title bar style
- ✅ **Windows**: Full support with native frame
- ✅ **Linux**: Full support with native frame

## 🔍 Technical Notes

### Electron Window Configuration:
```javascript
// In SecondaryWindowManager.js
{
  frame: true, // Native frame required
  titleBarStyle: 'hiddenInset', // macOS: Hide title text, keep traffic lights
  // ... other options
}
```

### CSS Requirement:
- Must use `-webkit-app-region` (Chromium/Electron specific)
- Standard CSS `draggable` attribute doesn't work for window dragging
- Only works in Electron, not in web browsers

### Z-Index Considerations:
- Header has `z-index: 100` to stay on top
- Ensures drag handle is always accessible
- Doesn't interfere with modals or overlays

