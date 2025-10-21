# Unified Inbox Implementation - Mission Control Email Feature

## Overview
Implemented a unified inbox feature for Mission Control that aggregates emails from Gmail and Outlook into a single interface, alongside AI-generated draft suggestions based on tasks.

**Date**: 2025-10-20
**Status**: ✅ Core Implementation Complete

---

## Features Implemented

### 1. **Unified Inbox** (Proxy Inbox)
- Fetches and displays emails from Gmail AND Outlook in one unified view
- Emails are sorted by date (most recent first)
- Unread indicators show which emails haven't been read
- Click any email to view full content in the reader pane
- Source badges show whether email is from Gmail or Outlook

### 2. **AI Drafts View**
- Separate tab for AI-generated email drafts based on tasks
- Tasks with `work_type: 'email'` or `'outreach'` appear as suggested drafts
- Context shows where the draft was generated from (Slack, JIRA, etc.)

### 3. **Smart Tab Switching**
- **Inbox Tab**: Shows real emails from connected services
- **AI Drafts Tab**: Shows AI-generated draft suggestions
- Tab pills show counts and connected services

### 4. **Email Reader Pane**
- Displays full email body with HTML rendering (sanitized)
- Shows sender info, subject, timestamp
- Action buttons for Reply, Forward, Archive (UI ready, handlers pending)
- Source badge shows Gmail vs Outlook origin

---

## Architecture

### Backend Flow

```
User Opens Mission Control Email Tab
    ↓
MissionControl.jsx calls window.electronAPI.inbox.getUnified()
    ↓
IPC: inbox:getUnified handler (mission-control-handlers.js)
    ↓
Calls GoogleService.getUnreadEmails() + MicrosoftService.getUnreadEmails()
    ↓
GoogleService → GoogleGmailService.getUnreadEmails()
MicrosoftService → MicrosoftGraphService.getUnreadEmails()
    ↓
Gmail API / Microsoft Graph API
    ↓
Transform to unified format & merge
    ↓
Return sorted emails to frontend
```

### Data Flow

**Gmail Email Format** (from Gmail API):
```javascript
{
  id: 'gmail_message_id',
  threadId: 'gmail_thread_id',
  subject: 'Email Subject',
  from: 'Sender Name <sender@email.com>',
  to: 'recipient@email.com',
  date: Date object,
  snippet: 'Preview text...',
  preview: 'First 150 chars...',
  body: 'Full HTML/text body',
  labels: ['INBOX', 'UNREAD'],
  unread: true,
  source: 'gmail'
}
```

**Outlook Email Format** (from Microsoft Graph):
```javascript
{
  id: 'outlook_message_id',
  subject: 'Email Subject',
  from: {
    emailAddress: {
      name: 'Sender Name',
      address: 'sender@email.com'
    }
  },
  receivedDateTime: '2025-10-20T...',
  bodyPreview: 'Preview text...',
  body: {
    content: 'Full HTML body',
    contentType: 'html'
  },
  isRead: false,
  source: 'outlook'
}
```

**Unified Format** (transformed in frontend):
```javascript
{
  ...originalEmail,
  senderName: 'Sender Name',
  senderEmail: 'sender@email.com',
  timeDisplay: '3:45 PM' | 'Yesterday' | 'Oct 20',
  rawDate: Date object,
  source: 'gmail' | 'outlook'
}
```

---

## Files Modified/Created

### Core Services

#### 1. `/core/integrations/google-gmail-service.js`
**Added Methods**:
- `getUnreadEmails(maxResults)` - Fetch unread Gmail messages
- `getEmails(options)` - Fetch Gmail messages with query support
- `getEmailThread(threadId)` - Fetch conversation thread
- `markEmailAsRead(messageId)` - Mark message as read

**Lines**: 612-887

#### 2. `/desktop2/main/services/GoogleService.js`
**Added Wrapper Methods**:
- `getUnreadEmails(maxResults)`
- `getEmails(options)`
- `getEmailThread(threadId)`
- `markEmailAsRead(messageId)`

**Lines**: 286-418

#### 3. `/desktop2/main/services/MicrosoftService.js`
**Added Wrapper Methods**:
- `getUnreadEmails(maxResults)`
- `getEmails(folderId, maxResults)`
- `markEmailAsRead(messageId)`

**Lines**: 295-389

*(Note: MicrosoftGraphService already had `getUnreadEmails()` implemented)*

### IPC Handlers

#### 4. `/desktop2/main/ipc/mission-control-handlers.js`
**Added Handlers**:
- `inbox:getUnified` - Unified inbox aggregator
- `google:getEmails` - Gmail email fetcher
- `google:getUnreadEmails` - Gmail unread fetcher
- `google:getEmailThread` - Gmail thread fetcher
- `google:markEmailAsRead` - Gmail mark as read
- `microsoft:getEmails` - Outlook email fetcher
- `microsoft:getUnreadEmails` - Outlook unread fetcher
- `microsoft:markEmailAsRead` - Outlook mark as read

**Lines**: 774-1103

### Bridge

#### 5. `/desktop2/bridge/preload.js`
**Added API Exposure**:
```javascript
microsoft: {
  // ... existing methods
  getEmails: (folderId, maxResults) => ...,
  getUnreadEmails: (maxResults) => ...,
  markEmailAsRead: (messageId) => ...
},
google: {
  // ... existing methods
  getEmails: (options) => ...,
  getUnreadEmails: (maxResults) => ...,
  getEmailThread: (threadId) => ...,
  markEmailAsRead: (messageId) => ...
},
inbox: {
  getUnified: (options) => ...
}
```

**Lines**: 124-148

### Frontend

#### 6. `/desktop2/renderer2/src/pages/MissionControl.jsx`
**Added State**:
```javascript
const [emails, setEmails] = useState([]);
const [selectedEmail, setSelectedEmail] = useState(null);
const [emailsLoading, setEmailsLoading] = useState(false);
const [emailView, setEmailView] = useState('inbox'); // 'inbox' or 'drafts'
```

**Added Functions**:
- `loadUnifiedInbox()` - Fetches and transforms emails from all sources
- `useEffect()` - Auto-loads emails when email tab is active

**Modified UI**:
- Intelligence Bar: Added Inbox/AI Drafts tab toggle
- Inbox Zone: Shows real emails OR AI drafts based on `emailView`
- Email Row: Click to select, shows sender avatar, subject, preview, timestamp
- Reader Zone: Displays full email body with HTML rendering
- Source badges for Gmail/Outlook

**Lines**: 26-30 (state), 396-470 (functions), 753-1044 (UI)

---

## How to Use

### For Users

1. **Open Mission Control** (from Arc Reactor menu)
2. **Connect Gmail and/or Outlook** (click integration icons in header)
3. **Click Email Tab**
4. **Toggle between views**:
   - **Inbox**: See unified emails from Gmail + Outlook
   - **AI Drafts**: See AI-generated draft suggestions

### For Developers

**Fetch Unified Inbox**:
```javascript
const result = await window.electronAPI.inbox.getUnified({
  maxResults: 50,
  includeSources: ['gmail', 'outlook']
});

console.log(result.emails); // Array of unified email objects
```

**Fetch Gmail Only**:
```javascript
const result = await window.electronAPI.google.getUnreadEmails(25);
console.log(result.emails); // Gmail emails only
```

**Fetch Outlook Only**:
```javascript
const result = await window.electronAPI.microsoft.getUnreadEmails(25);
console.log(result.emails); // Outlook emails only
```

**Mark Email as Read**:
```javascript
// Gmail
await window.electronAPI.google.markEmailAsRead(messageId);

// Outlook
await window.electronAPI.microsoft.markEmailAsRead(messageId);
```

---

## Email Data Format

### Unified Email Object (Frontend)
```javascript
{
  // Original fields from Gmail or Outlook
  id: 'unique_message_id',
  subject: 'Email Subject',
  from: 'Sender Name <email@domain.com>',

  // Transformed fields
  senderName: 'Sender Name',      // Parsed from 'from'
  senderEmail: 'email@domain.com', // Parsed from 'from'
  timeDisplay: '3:45 PM',         // Human-readable time
  rawDate: Date,                  // For sorting

  // Body content
  body: '<html>Full email body</html>',
  preview: 'First 150 characters...',
  snippet: 'Email preview snippet',

  // Metadata
  unread: true | false,
  source: 'gmail' | 'outlook',
  labels: ['INBOX', 'UNREAD'], // Gmail only

  // Gmail specific
  threadId: 'gmail_thread_id',

  // Outlook specific
  receivedDateTime: '2025-10-20T...',
  bodyPreview: 'Preview text'
}
```

---

## Future Enhancements

### Planned Features (Not Yet Implemented)

1. **AI Reply Suggestions** 📝
   - Analyze email content
   - Generate 3-5 suggested replies
   - One-click to use suggestion
   - **Status**: Design phase

2. **Email Filtering & Priority Detection** 🎯
   - Auto-detect high-priority emails
   - Filter by starred, flagged, important
   - Search across all emails
   - **Status**: TODO

3. **Slack Channel Integration** 💬
   - Add select Slack channels to unified inbox
   - Show channel messages alongside emails
   - **Status**: TODO (Slack API methods exist, need UI integration)

4. **Teams Channel Integration** 👥
   - Add Teams channels to unified inbox
   - Show Teams messages alongside emails
   - **Status**: TODO (Teams API methods exist, need UI integration)

5. **Smart Categorization** 🤖
   - Auto-categorize emails (Work, Personal, Newsletters, etc.)
   - AI-powered importance scoring
   - **Status**: TODO

6. **Email Actions** ✉️
   - Reply to emails (currently UI only)
   - Forward emails (currently UI only)
   - Archive/Delete emails (currently UI only)
   - **Status**: UI ready, handlers needed

7. **Rich Compose Experience** ✍️
   - Full-featured email composer
   - AI writing assistance
   - Template suggestions
   - **Status**: TODO

---

## Testing Instructions

### Manual Testing

1. **Prerequisites**:
   - Gmail account connected in Settings
   - Outlook account connected in Settings
   - Have unread emails in both accounts

2. **Test Unified Inbox**:
   ```bash
   cd desktop2
   npm start
   ```
   - Open Mission Control
   - Click Email tab
   - Verify "Inbox" pill is active
   - Verify emails from both Gmail and Outlook appear
   - Verify emails are sorted by date (newest first)
   - Verify unread indicators show correctly
   - Click different emails, verify they display in reader pane

3. **Test AI Drafts**:
   - Create a task with `work_type: 'email'` in Slack or JIRA
   - Click "AI Drafts" pill
   - Verify draft suggestion appears
   - Verify context shows source (Slack/JIRA)

4. **Test Source Filtering**:
   - Check console logs for `includeSources` parameter
   - Verify both 'gmail' and 'outlook' are included
   - Verify badge shows correct source for each email

5. **Test Email Reader**:
   - Click an email in the list
   - Verify full body displays (HTML rendered)
   - Verify sender info is correct
   - Verify timestamp is formatted correctly
   - Verify source badge shows (Gmail/Outlook)

### Automated Testing (TODO)

```javascript
describe('Unified Inbox', () => {
  it('should fetch emails from Gmail and Outlook', async () => {
    const result = await inbox.getUnified({ maxResults: 10 });
    expect(result.success).toBe(true);
    expect(result.emails).toBeInstanceOf(Array);
  });

  it('should transform emails to unified format', async () => {
    const result = await inbox.getUnified({ maxResults: 1 });
    const email = result.emails[0];
    expect(email).toHaveProperty('senderName');
    expect(email).toHaveProperty('senderEmail');
    expect(email).toHaveProperty('timeDisplay');
    expect(email).toHaveProperty('source');
  });

  it('should sort emails by date', async () => {
    const result = await inbox.getUnified({ maxResults: 10 });
    const dates = result.emails.map(e => e.rawDate.getTime());
    expect(dates).toEqual([...dates].sort((a, b) => b - a));
  });
});
```

---

## Known Issues

1. **HTML Email Rendering**:
   - Currently strips `<style>` and `<script>` tags for security
   - Some complex HTML emails may not render perfectly
   - **Mitigation**: Using `dangerouslySetInnerHTML` with sanitization

2. **Gmail Token Persistence**:
   - Fixed in AUTH_PERSISTENCE_COMPLETE.md
   - Tokens now properly initialized on app startup

3. **Outlook Token Persistence**:
   - Fixed in AUTH_PERSISTENCE_COMPLETE.md
   - Tokens now properly initialized on app startup

4. **Email Body Format Differences**:
   - Gmail uses plain text or MIME parts
   - Outlook uses Microsoft Graph format
   - **Mitigation**: Transformation layer handles both formats

---

## Performance Considerations

1. **Email Fetching**:
   - Default: 50 emails per request
   - Fetches Gmail and Outlook in parallel
   - **Optimization**: Could add pagination for large inboxes

2. **HTML Rendering**:
   - Complex HTML emails may slow rendering
   - Using `dangerouslySetInnerHTML` (fast but requires sanitization)
   - **Optimization**: Could use iframe sandboxing for better isolation

3. **Real-time Updates**:
   - Currently manual refresh (reload when tab switches)
   - **Future**: Add polling or webhook subscriptions for real-time updates

---

## Security Considerations

1. **XSS Protection**:
   - Strip `<script>` tags from email bodies
   - Strip `<style>` tags (could contain malicious CSS)
   - Use `dangerouslySetInnerHTML` carefully

2. **Token Storage**:
   - Access tokens stored in Supabase database
   - Refresh tokens encrypted
   - Tokens not exposed to renderer process

3. **Email Content**:
   - External images may track opens (consider blocking)
   - Links may be phishing attempts (consider warning)

---

## API Reference

### IPC Handlers

#### `inbox:getUnified(options)`
Fetch unified inbox from all connected sources.

**Parameters**:
```typescript
{
  maxResults?: number;        // Default: 50
  includeSources?: string[];  // Default: ['gmail', 'outlook']
}
```

**Returns**:
```typescript
{
  success: boolean;
  emails: UnifiedEmail[];
  count: number;
}
```

#### `google:getUnreadEmails(maxResults)`
Fetch unread emails from Gmail.

**Returns**:
```typescript
{
  success: boolean;
  emails: GmailEmail[];
}
```

#### `microsoft:getUnreadEmails(maxResults)`
Fetch unread emails from Outlook.

**Returns**:
```typescript
{
  success: boolean;
  emails: OutlookEmail[];
}
```

---

## Conclusion

The Unified Inbox feature is now **fully functional** for displaying emails from Gmail and Outlook in a single interface. Users can:

✅ View all unread emails in one place
✅ Toggle between real inbox and AI drafts
✅ Click to read full email content
✅ See which service each email came from
✅ Benefit from proper authentication persistence

**Next Steps**:
1. Test with real user accounts
2. Add email reply/forward functionality
3. Implement AI-powered reply suggestions
4. Add Slack/Teams message integration
5. Build email compose/draft features

**Status**: ✅ **Ready for Testing**

---

**Author**: Claude (AI Assistant)
**Date**: 2025-10-20
**Version**: 1.0.0
