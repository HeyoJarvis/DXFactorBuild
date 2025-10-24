# Notification Testing Guide 🧪

## How to Trigger Test Notifications

### Method 1: Keyboard Shortcut (Easiest!) ⌨️

**Press:** `Cmd + K` then `N` (macOS) or `Ctrl + K` then `N` (Windows/Linux)

**Steps:**
1. Press and release `Cmd + K` (you'll see "Cmd+K pressed" in console)
2. Within 2 seconds, press `N`
3. Notification appears!

**Why this shortcut?**
- Avoids conflicts with Cursor/VS Code (Cmd+Shift+N = new window)
- Two-key sequence is less likely to trigger accidentally
- Common pattern (like Cmd+K Cmd+S in VS Code)

---

### Method 2: Browser Console 🖥️

**Best for quick testing since the orb window is small!**

1. Click on the orb window to focus it
2. Right-click → "Inspect Element" or press `Cmd + Option + I` (macOS)
3. Go to Console tab
4. Type: `window.testNotification()`
5. Press Enter

**Result:** "You have a new task" appears beside the orb!

---

### Method 3: Real JIRA Sync (Production Testing) 🔄

1. **Connect JIRA:**
   - Open Mission Control (click orb)
   - Go to Settings → Integrations
   - Connect your JIRA account

2. **Trigger sync:**
   - In console: `window.electronAPI.jira.syncTasks()`
   - Or wait for auto-sync (every 5 minutes)

3. **Create test in JIRA:**
   - Go to your JIRA instance
   - Create a new issue assigned to you
   - Sync will detect it and show notification

---

## Expected Behavior

### Visual:
```
   ┌─────────────────────┐
   │ You have a new task │  ← Slides in from left
   └─────────────────────┘
          [Orb]
```

### Animation:
1. **Slide in** (0.4s) - Bouncy entrance from left
2. **Pulse** (continuous) - Border glows and pulses
3. **Hold** - Visible for 5 seconds
4. **Fade out** - Smoothly disappears

### Console Output:
```
🎹 Cmd+K pressed, now press N for test notification
🎹 Keyboard shortcut triggered: Cmd+K then N
🧪 Triggering test notification: {type: 'new_task', taskKey: 'TEST-123', ...}
🔔 New notification received: {type: 'new_task', ...}
```

---

## Testing Different Message Types

| Notification Type | Message Displayed |
|------------------|-------------------|
| `new_task` | "You have a new task" |
| `jira_task_synced` | "You have a new task" |
| `task_updated` | "Progress on PROJ-123" |
| `jira_update` | "Progress on PROJ-123" |
| `status_change` | "Task moved to In Progress" |
| `requirements_generated` | "Product requirements ready" |
| `pr_review` | "PR requires your review" |

---

## Troubleshooting

### "Nothing happens when I press Cmd+K then N"
**Solutions:**
- ✅ Make sure the orb window has focus (click on it first)
- ✅ Press `Cmd+K`, release, then press `N` within 2 seconds
- ✅ Check console for "Cmd+K pressed" message
- ✅ Only works in development mode

### "window.testNotification is not defined"
**Solutions:**
- ✅ Only available in development mode (`NODE_ENV=development`)
- ✅ Refresh the orb window
- ✅ Check console for JavaScript errors

### "Badge appears but shows no text"
**Solutions:**
- ✅ Check console logs for the notification object
- ✅ Verify `formatNotificationMessage()` is working
- ✅ Look for React errors

### "Badge doesn't disappear"
**Solutions:**
- ✅ Check if multiple notifications are queuing
- ✅ Look for errors in console preventing setTimeout
- ✅ Wait the full 5 seconds

---

## Advanced Testing

### Multiple Notifications:
```javascript
// In console
for (let i = 0; i < 3; i++) {
  setTimeout(() => window.testNotification(), i * 1000);
}
```
**Expected:** Shows 3 notifications, one at a time, each for 5 seconds

### Rapid Fire:
```javascript
// Test queuing
window.testNotification();
setTimeout(() => window.testNotification(), 100);
setTimeout(() => window.testNotification(), 200);
```
**Expected:** Should queue and display sequentially

---

## Quick Reference

| Action | Command |
|--------|---------|
| **Test notification** | `Cmd+K` then `N` or `window.testNotification()` |
| **Check if available** | `typeof window.testNotification` (should be "function") |
| **View notification** | Look at orb for floating text badge |
| **Clear notification** | Wait 5 seconds or refresh |
| **Open DevTools** | `Cmd+Option+I` (must focus orb window first) |

---

## Best Practice for Testing

Since the orb is a small window that's always on top:

1. **Use console method** - Easier to access DevTools
2. **Have Cursor/IDE on another screen** - So you can see the orb
3. **Focus the orb window** - Click on it before using keyboard shortcut
4. **Watch the console** - Logs show exactly what's happening

---

## Summary

**Fastest Test:**
1. Focus the orb window (click on it)
2. Press `Cmd + K` then `N`
3. See notification appear!

**Most Reliable:**
1. Right-click orb → Inspect
2. Console: `window.testNotification()`
3. See notification appear!

**Real World Test:**
1. Connect JIRA
2. Create test issue in JIRA
3. Trigger sync
4. See real notification!

✅ **Ready to test!** The two-key sequence prevents conflicts with other apps.
