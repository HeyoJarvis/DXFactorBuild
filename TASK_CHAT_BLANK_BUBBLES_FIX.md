# Task Chat Blank Bubbles Fix

## Problem

When loading task chat history, messages were showing as **blank bubbles** - the UI rendered the message containers but the actual message text was empty.

## Root Cause

**Field name mismatch** between database column and code expectations:

- **Database column**: `message_text` (defined in schema)
- **Code was reading**: `content` (wrong field name)

### Where It Happened

1. **Saving messages** (`SupabaseAdapter.js` line 104):
   ```javascript
   message_text: message,  // ✅ Correct - saves to message_text
   ```

2. **Reading messages** (`task-chat-handlers.js` line 313):
   ```javascript
   content: msg.content,  // ❌ Wrong - tries to read 'content'
   ```

Since `msg.content` was `undefined`, the UI rendered empty bubbles!

## Solution

Updated the field mapping in `task-chat-handlers.js` to read from the correct field:

### Before (WRONG):
```javascript
messages: historyResult.messages.map(msg => ({
  role: msg.role,
  content: msg.content,  // ❌ undefined!
  timestamp: msg.created_at
}))
```

### After (CORRECT):
```javascript
messages: historyResult.messages.map(msg => ({
  role: msg.role,
  content: msg.message_text || msg.content || '',  // ✅ Reads correct field
  timestamp: msg.created_at || msg.timestamp       // ✅ Fallback support
}))
```

## Additional Improvements

Added debug logging to `getSessionMessages()` to help diagnose issues:

```javascript
if (data && data.length > 0) {
  this.logger.debug('Sample message from DB', {
    session_id: sessionId,
    sample: {
      role: data[0].role,
      has_message_text: !!data[0].message_text,
      has_content: !!data[0].content,
      text_length: data[0].message_text?.length || 0
    }
  });
}
```

This logs the first message structure so we can verify which fields exist.

## Database Schema Reference

From `desktop-tables-workflow-sessions.sql`:

```sql
CREATE TABLE conversation_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES conversation_sessions(id) ON DELETE CASCADE,
  message_text TEXT NOT NULL,  -- ✅ This is the correct column
  role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  metadata JSONB DEFAULT '{}',
  timestamp TIMESTAMPTZ DEFAULT NOW()
);
```

## Testing

### Test 1: Load Existing Chat
```bash
1. Open a task that already has chat history
2. Chat should immediately show all previous messages
✅ Messages should display with full text (no blank bubbles)
```

### Test 2: New Message Persistence
```bash
1. Send a new message
2. Close the chat
3. Reopen the chat
✅ New message should appear with full text
```

### Test 3: Multiple Messages
```bash
1. Send several messages back and forth
2. Close and reopen chat
✅ All messages should display correctly in order
```

## Files Modified

1. ✅ `desktop2/main/ipc/task-chat-handlers.js`
   - Fixed field mapping: `msg.message_text || msg.content`
   - Added timestamp fallback: `msg.created_at || msg.timestamp`

2. ✅ `desktop2/main/services/SupabaseAdapter.js`
   - Added debug logging for message structure
   - Helps diagnose similar issues in the future

## Console Logs to Look For

### Debug Log (New):
```json
{
  "level": "debug",
  "message": "Sample message from DB",
  "session_id": "xyz-789",
  "sample": {
    "role": "user",
    "has_message_text": true,
    "has_content": false,
    "text_length": 2
  }
}
```

### Info Log (Existing):
```json
{
  "level": "info",
  "message": "Loaded chat history",
  "taskId": "abc-123",
  "messageCount": 2,
  "routeTo": "tasks-sales"
}
```

## Why This Happened

The codebase has two different message table schemas:

1. **`conversation_messages`** (workflow sessions) - Uses `message_text`
2. **`chat_messages`** (old chat system) - Uses `content`

The code was mixing the two schemas. This fix adds fallback support for both fields while prioritizing the correct one.

## Backward Compatibility

The fix supports both field names:
- `message_text` (current schema) - Priority
- `content` (old schema) - Fallback
- Empty string if neither exists - Prevents crashes

This ensures the code works with both table structures.

---

**Implementation Date**: October 16, 2025  
**Status**: ✅ Complete  
**Testing**: Restart app and test chat loading

