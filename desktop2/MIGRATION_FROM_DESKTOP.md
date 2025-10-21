# 🔄 Migration from Desktop to Desktop2

## ✅ Completed

### 1. Supabase Adapter
- ✅ Added `getTaskByExternalId()` method
- ✅ Added `getTaskChatHistory()` method
- Desktop2's SupabaseAdapter now has feature parity with Desktop

### 2. Architecture
- ✅ Separate windows implementation (orb + secondary window)
- ✅ Working Arc Reactor orb with menu
- ✅ Click-through bug fixed

## 📋 Remaining Tasks

### 3. Task Chat with AI Action Items
**Location in Desktop**: `/desktop/renderer/task-chat.html`

**Key Features to Copy**:
- Light, vibey UI design (white background, gradients)
- AI action item extraction from chat
- Sub-task creation from action items
- Message bubbles with clean typography
- Loading states and animations

**Implementation Notes**:
```javascript
// System prompt includes:
ACTION ITEM EXTRACTION:
[ACTION_ITEM: title=..., priority=..., description=...]

// Parser extracts and creates sub-tasks:
const actionItemRegex = /\[ACTION_ITEM:\s*title=([^,]+),\s*priority=(urgent|high|medium|low),\s*description=([^\]]+)\]/gi;
```

### 4. Light/Vibey Chat Design
**Source**: `/desktop/renderer/unified.html`

**Design Characteristics**:
- White background (`#ffffff`)
- Light gray chat area (`#f8f9fa`)
- Gradient header (`linear-gradient(135deg, #667eea 0%, #764ba2 100%)`)
- Clean message bubbles with shadows
- Smooth animations
- Modern iOS-style interface

**CSS Structure**:
```css
body {
  background: #ffffff;
  font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display';
}

.chat-container {
  background: #f8f9fa; /* Light gray */
}

.message-user {
  background: #007AFF; /* iOS blue */
  color: white;
}

.message-assistant {
  background: white;
  border: 1px solid #e5e7eb;
}
```

### 5. Tasks Page Redesign
**Current**: Dark theme
**Target**: Light, clean design matching chat

**Changes Needed**:
- Update `Tasks.css` to light theme
- Match gradient header from chat
- Update task cards to white with shadows
- Update input styling
- Update filter buttons

## 📁 Files to Migrate

### Priority 1: Chat Redesign
1. Copy `/desktop/renderer/task-chat.html` styling to `/desktop2/renderer2/src/pages/Copilot.jsx`
2. Copy action item extraction logic
3. Update message components

### Priority 2: Tasks Page
1. Copy light theme CSS from desktop
2. Update `Tasks.jsx` component
3. Update `Tasks.css` styling

### Priority 3: Task Handlers
1. Verify task IPC handlers have action item support
2. Add task chat endpoints
3. Test task creation with AI

## 🎨 Design System

### Colors
```css
--bg-primary: #ffffff;
--bg-secondary: #f8f9fa;
--bg-tertiary: #e5e7eb;

--gradient-primary: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
--gradient-secondary: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%);

--text-primary: #171717;
--text-secondary: #6b7280;
--text-tertiary: #9ca3af;

--accent-blue: #007AFF;
--accent-purple: #764ba2;
--accent-green: #10b981;
```

### Typography
```css
font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', Roboto, sans-serif;

h1: 22px, 700 weight, -0.02em letter-spacing
h2: 18px, 600 weight
body: 14px, 400 weight
small: 12px, 400 weight
```

### Spacing
```css
--spacing-xs: 4px;
--spacing-sm: 8px;
--spacing-md: 16px;
--spacing-lg: 24px;
--spacing-xl: 32px;
```

### Shadows
```css
--shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.1);
--shadow-md: 0 4px 12px rgba(0, 0, 0, 0.1);
--shadow-lg: 0 8px 24px rgba(0, 0, 0, 0.15);
```

## 🚀 Implementation Strategy

### Step 1: Update Copilot Page (Chat)
```bash
# Copy key sections from task-chat.html
# Update Copilot.jsx with:
- Light background
- New message bubble styling
- Gradient header
- Action item display
- Clean input field
```

### Step 2: Update Tasks Page
```bash
# Update Tasks.jsx and Tasks.css
- Light theme colors
- Gradient header
- White task cards with shadows
- Clean filter buttons
- Smooth animations
```

### Step 3: Add Action Item Logic
```bash
# In task-chat handlers:
- Add action item extraction regex
- Create sub-task creation logic
- Update AI system prompt
- Test with sample tasks
```

## 📝 Quick Reference

### Desktop Files to Reference
- `/desktop/renderer/task-chat.html` - Task chat UI
- `/desktop/renderer/unified.html` - Main chat UI
- `/desktop/AI_ACTION_ITEMS_FIX.md` - Action item implementation
- `/desktop/main/supabase-adapter.js` - Database methods

### Desktop2 Files to Update
- `/desktop2/renderer2/src/pages/Copilot.jsx` - Chat interface
- `/desktop2/renderer2/src/pages/Copilot.css` - Chat styling
- `/desktop2/renderer2/src/pages/Tasks.jsx` - Tasks page
- `/desktop2/renderer2/src/pages/Tasks.css` - Tasks styling
- `/desktop2/main/ipc/task-chat-handlers.js` - Task chat logic

## 🧪 Testing Checklist

### After Migration:
- [ ] Chat has light, clean design
- [ ] Messages display with proper styling
- [ ] AI action items are extracted
- [ ] Sub-tasks are created from action items
- [ ] Tasks page matches light theme
- [ ] All interactions work smoothly
- [ ] No visual regressions

---

**Status**: In Progress  
**Next Step**: Copy chat styling from task-chat.html to Copilot.jsx  
**Reference**: See desktop/AI_ACTION_ITEMS_FIX.md for action item implementation details




