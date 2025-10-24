# Window Maximize - Native Traffic Lights Replacement ✅

## Summary
The maximize button now works exactly like native macOS traffic lights - filling the entire available screen space.

## Problem Fixed
Previous attempts used wrong display detection and screen bounds. Now uses:
1. **Correct Display Detection**: Finds the display where the window currently is
2. **Usable Screen Space**: Uses `workArea` instead of `bounds` to exclude menu bar/taskbar
3. **Proper State Tracking**: Stores previous bounds for accurate restore

## Technical Implementation

**File**: `desktop2/main/ipc/window-handlers.js`

### Key Changes

```javascript
// 1. Get the display where the window IS (not primary display)
const windowBounds = window.getBounds();
const display = screen.getDisplayMatching(windowBounds);

// 2. Get workArea (usable screen space, excluding menu bar/taskbar)
const workArea = display.workArea;

// 3. Clear all size constraints
window.setMinimumSize(0, 0);
window.setMaximumSize(0, 0);

// 4. Set window to fill entire workArea
window.setBounds({
  x: workArea.x,
  y: workArea.y,
  width: workArea.width,
  height: workArea.height
});
```

### workArea vs bounds

**bounds**: Full screen dimensions (0, 0, 2560, 1440)
- Includes menu bar on macOS
- Includes taskbar on Windows

**workArea**: Usable screen space (0, 25, 2560, 1415)
- Excludes menu bar on macOS
- Excludes taskbar on Windows
- This is what we want for proper desktop-like maximization

### State Tracking

```javascript
// Store window state
windowStates.set(window, {
  previousBounds: { x, y, width, height },
  isMaximized: false
});

// On maximize:
state.previousBounds = window.getBounds();  // Save current
state.isMaximized = true;

// On restore:
window.setBounds(state.previousBounds);     // Restore saved
state.isMaximized = false;
```

## Behavior

### First Click (Maximize)
```
Click □ Button
  ↓
Store current window bounds
  ↓
Get current display's workArea
  ↓
Fill entire workArea
  ↓
Window expands to full desktop
```

### Second Click (Restore)
```
Click □ Button again
  ↓
Restore previous stored bounds
  ↓
Window returns to previous size/position
```

## Multi-Monitor Support

Works perfectly with multiple displays:
- If window is on Display 1 → Maximizes to Display 1's workArea
- If window is on Display 2 → Maximizes to Display 2's workArea
- Uses `screen.getDisplayMatching(windowBounds)` to find correct display

## Platform Compatibility

✅ **macOS**
- Respects menu bar (doesn't go behind it)
- Respects dock (if docked on side)
- True desktop application behavior

✅ **Windows**
- Respects taskbar placement
- Works with different taskbar positions
- True desktop application behavior

✅ **Linux**
- Fills available screen space
- Works with panel/taskbar

## Example Scenario

**Before (Problem)**
```
Window bounds: x=100, y=100, width=500, height=500
Click maximize
→ Partially fills screen, leaves gaps
```

**After (Fixed)**
```
Window bounds: x=100, y=100, width=500, height=500
Click maximize
→ Gets display workArea: x=0, y=25, width=2560, height=1415
→ Sets window to exact workArea dimensions
→ Window fills entire desktop properly
```

## Logging

Check DevTools console to see:
```
Window maximized to full screen: 2560x1415 at (0, 25)
Window restored to previous size
```

Different configurations show:
- macOS: y=25 (menu bar height)
- Windows: y=0 (taskbar at bottom)
- Multi-monitor: Different coordinates for each display

## Files Modified
1. ✅ `desktop2/main/ipc/window-handlers.js`
   - Added windowStates WeakMap for state tracking
   - Rewrote `window:maximize` handler
   - Rewrote `window:toggleMaximize` handler
   - Now uses correct display detection
   - Now uses workArea instead of bounds

## Testing

✅ **Visual Test**
1. Open Mission Control
2. Click maximize button (□)
3. Window should expand to fill ENTIRE screen
4. No visible gaps or margins
5. Click again to restore

✅ **Multi-Monitor Test**
1. Open on Display 1, click maximize → fills Display 1
2. Move window to Display 2, click maximize → fills Display 2
3. Restore on Display 2 → returns to size before Display 2 maximize

✅ **State Test**
1. Resize window to custom size
2. Click maximize
3. Click restore
4. Window should return to exact previous size/position

---

✅ **Status**: COMPLETE - NOW BEHAVES LIKE NATIVE TRAFFIC LIGHTS
- Fills entire available screen ✓
- Excludes menu bar/taskbar ✓
- Stores and restores previous position ✓
- Works on multi-monitor setups ✓
- True desktop application behavior ✓

The window now maximizes exactly like a native desktop application!
