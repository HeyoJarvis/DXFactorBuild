# Google Workspace Integration Setup Guide

This guide will help you set up Google Workspace integration for HeyJarvis, enabling Gmail and Google Calendar automation.

## 🎯 What You Get

- **Gmail Integration**: Send emails, create drafts, read messages
- **Google Calendar**: Create events, schedule meetings, check availability
- **Google Meet**: Auto-generate meeting links for calendar events
- **OAuth 2.0 Authentication**: Secure user authentication with refresh tokens

## 📋 Prerequisites

- Google Cloud Platform account
- Google Workspace account (or regular Gmail account)
- Node.js 18+ installed
- HeyJarvis project set up

## 🚀 Step-by-Step Setup

### Step 1: Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click **Select a project** → **New Project**
3. Enter project name: `HeyJarvis Integration`
4. Click **Create**
5. Wait for project creation and select it

### Step 2: Enable Required APIs

1. In the Google Cloud Console, go to **APIs & Services** → **Library**
2. Search for and enable the following APIs:
   - **Gmail API**
   - **Google Calendar API**
   - **Google People API** (for user profile info)

For each API:
- Click on the API name
- Click **Enable**
- Wait for activation

### Step 3: Configure OAuth Consent Screen

1. Go to **APIs & Services** → **OAuth consent screen**
2. Choose **External** user type (unless you have a Google Workspace)
3. Click **Create**

Fill in the required fields:
- **App name**: `HeyJarvis`
- **User support email**: Your email
- **Developer contact email**: Your email
- **App logo** (optional): Upload your logo
- Click **Save and Continue**

Add scopes:
- Click **Add or Remove Scopes**
- Add these scopes:
  ```
  https://www.googleapis.com/auth/userinfo.email
  https://www.googleapis.com/auth/userinfo.profile
  https://www.googleapis.com/auth/gmail.send
  https://www.googleapis.com/auth/gmail.readonly
  https://www.googleapis.com/auth/gmail.compose
  https://www.googleapis.com/auth/calendar
  https://www.googleapis.com/auth/calendar.events
  ```
- Click **Update** → **Save and Continue**

Add test users (for testing before publishing):
- Click **Add Users**
- Add your Gmail address
- Click **Save and Continue**

### Step 4: Create OAuth 2.0 Credentials

1. Go to **APIs & Services** → **Credentials**
2. Click **Create Credentials** → **OAuth client ID**
3. Choose **Desktop app** as application type
4. Name it: `HeyJarvis Desktop`
5. Click **Create**

You'll see a dialog with:
- **Client ID**: Something like `123456789-abcdefg.apps.googleusercontent.com`
- **Client Secret**: Something like `GOCSPX-abcdefghijklmnop`

**Important**: Download the JSON file or copy these values - you'll need them!

### Step 5: Configure Environment Variables

1. Open your `.env` file in the HeyJarvis root directory
2. Add/update these values:

```bash
# Google Workspace Integration
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REDIRECT_URI=http://localhost:8890/auth/google/callback
```

Replace:
- `your-client-id.apps.googleusercontent.com` with your actual Client ID
- `your-client-secret` with your actual Client Secret

### Step 6: Install Dependencies

Run in your terminal:

```bash
npm install
```

This will install the `googleapis` package and other dependencies.

### Step 7: Test the Integration

1. Start HeyJarvis:
   ```bash
   npm run dev:desktop
   ```

2. In the desktop app, look for the Google authentication button or trigger:
   ```javascript
   // From renderer process
   await window.electron.invoke('google:authenticate');
   ```

3. This will:
   - Open your default browser
   - Ask you to sign in to Google
   - Request permission for the scopes
   - Redirect back to the app with success message

4. Try sending a test email:
   ```javascript
   const result = await window.electron.invoke('google:sendEmail', {
     to: ['recipient@example.com'],
     subject: 'Test from HeyJarvis',
     body: 'This is a test email sent via Gmail API!',
     isHtml: false
   });
   ```

## 🔧 Available IPC Handlers

Once authenticated, you can use these IPC handlers from your renderer process:

### Authentication
```javascript
// Authenticate with Google
const auth = await window.electron.invoke('google:authenticate');
// Returns: { success: true, account: { email, name, picture }, expiresOn }

// Get user profile
const profile = await window.electron.invoke('google:getUserProfile');
// Returns: { success: true, user: { email, name, picture, messagesTotal, threadsTotal } }
```

### Email Operations
```javascript
// Send email
const result = await window.electron.invoke('google:sendEmail', {
  to: ['user@example.com'],
  cc: ['cc@example.com'], // optional
  bcc: ['bcc@example.com'], // optional
  subject: 'Email Subject',
  body: '<h1>HTML Email</h1><p>Body content</p>',
  isHtml: true
});

// Create draft email
const draft = await window.electron.invoke('google:createDraft', {
  to: ['user@example.com'],
  subject: 'Draft Subject',
  body: 'Draft content',
  isHtml: false
});
```

### Calendar Operations
```javascript
// Create calendar event with Google Meet
const event = await window.electron.invoke('google:createEvent', {
  subject: 'Team Meeting',
  body: 'Discuss Q4 plans',
  startTime: '2025-10-15T10:00:00Z',
  endTime: '2025-10-15T11:00:00Z',
  timeZone: 'America/New_York',
  attendees: ['user1@example.com', 'user2@example.com'],
  location: 'Conference Room A',
  isOnlineMeeting: true // Creates Google Meet link
});
// Returns: { success: true, event: {...}, meetingLink: 'https://meet.google.com/...' }

// Find available meeting times
const times = await window.electron.invoke('google:findMeetingTimes', 
  ['user1@example.com', 'user2@example.com'], // attendees
  60, // duration in minutes
  {
    startTime: '2025-10-15T09:00:00Z',
    endTime: '2025-10-15T17:00:00Z',
    maxCandidates: 5
  }
);
```

## 🔐 Security Notes

1. **Never commit credentials**: The `.env` file is in `.gitignore`
2. **Refresh tokens**: Stored securely and used to renew expired access tokens
3. **Token expiry**: Automatically handled by the service
4. **Scopes**: Only request minimum required permissions

## 🐛 Troubleshooting

### "Google not authenticated" Error
- Solution: Run `google:authenticate` first before using other methods

### "Access blocked: This app hasn't been verified"
- This is normal during development
- Click "Advanced" → "Go to HeyJarvis (unsafe)" for testing
- For production, submit your app for Google verification

### "Invalid grant" Error
- Your authorization code may have expired
- Try authenticating again

### "Insufficient permissions" Error
- Make sure all required scopes are enabled in OAuth consent screen
- Re-authenticate to get new permissions

### Port 8890 Already in Use
- Change `GOOGLE_REDIRECT_URI` port in `.env`
- Update the port in `oauth/google-oauth-handler.js` constructor

## 📊 Comparison: Google vs Microsoft

| Feature | Google Workspace | Microsoft 365 |
|---------|-----------------|---------------|
| **Email API** | Gmail API | Graph API |
| **Calendar** | Google Calendar | Outlook Calendar |
| **Video Meetings** | Google Meet | Teams |
| **OAuth Port** | 8890 | 8889 |
| **Token Refresh** | Automatic | Automatic |
| **Scopes Format** | Full URLs | Short names |

## 🎓 API Documentation

- [Gmail API Reference](https://developers.google.com/gmail/api)
- [Google Calendar API](https://developers.google.com/calendar/api)
- [OAuth 2.0 Guide](https://developers.google.com/identity/protocols/oauth2)
- [Node.js Client Library](https://github.com/googleapis/google-api-nodejs-client)

## 🚀 Next Steps

1. **Test all features** in development mode
2. **Add UI elements** for authentication triggers
3. **Implement workflow automation** using the calendar/email features
4. **Submit for verification** when ready for production
5. **Monitor logs** at `logs/google-gmail.log` and `logs/google-oauth.log`

## 📝 Example: Complete Workflow

```javascript
// 1. Authenticate
const auth = await window.electron.invoke('google:authenticate');
console.log('Authenticated as:', auth.account.email);

// 2. Create a meeting
const meeting = await window.electron.invoke('google:createEvent', {
  subject: 'Project Kickoff',
  body: 'Discuss project requirements and timeline',
  startTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  endTime: new Date(Date.now() + 24 * 60 * 60 * 1000 + 60 * 60 * 1000).toISOString(),
  attendees: ['teammate@example.com'],
  isOnlineMeeting: true
});

// 3. Send email invitation
await window.electron.invoke('google:sendEmail', {
  to: ['teammate@example.com'],
  subject: 'Meeting Invitation: Project Kickoff',
  body: `
    <h2>You're invited to a meeting</h2>
    <p><strong>Topic:</strong> Project Kickoff</p>
    <p><strong>When:</strong> Tomorrow at 10 AM</p>
    <p><strong>Join:</strong> <a href="${meeting.meetingLink}">${meeting.meetingLink}</a></p>
  `,
  isHtml: true
});

console.log('✅ Meeting created and invitations sent!');
```

---

**Need help?** Check the logs at `logs/google-gmail.log` or open an issue in the repository.



