# Authentication Implementation Guide

## ✅ What's Been Implemented

We've successfully implemented a complete Slack OAuth authentication system for HeyJarvis with user-specific data isolation.

### Components Created

#### 1. **AuthService** (`desktop/services/auth-service.js`)
- Handles Slack OAuth flow via Supabase Auth
- Manages user sessions with automatic token refresh
- Persistent session storage using `electron-store`
- Secure credential encryption

**Key Features:**
- `signInWithSlack()` - Opens OAuth window and handles callback
- `loadSession()` - Restores existing sessions on app start
- `signOut()` - Clears session and logs user out
- Automatic token refresh before expiration

#### 2. **Login Screen** (`desktop/renderer/login.html`)
- Beautiful, modern UI matching HeyJarvis design
- Slack OAuth integration
- Loading states and error handling
- Features list to onboard users

#### 3. **Main Process Integration** (`desktop/main.js`)
- Custom protocol handler for OAuth callbacks (`heyjarvis://`)
- IPC handlers for auth operations:
  - `auth:sign-in-slack`
  - `auth:sign-out`
  - `auth:get-user`
- App initialization flow with session restoration
- Automatic window management (login vs. main app)

#### 4. **Preload Bridge** (`desktop/bridge/preload.js`)
- Secure IPC bridge for authentication
- Exposed API: `window.electronAPI.auth.*`

#### 5. **Database Schema** (`data/storage/auth-schema.sql`)
- User profiles table with Slack integration
- Row Level Security (RLS) policies
- User-specific chat conversations and messages
- User-specific task assignments
- Session management tables

## 🚀 Setup Instructions

### Step 1: Run Database Migration

1. Go to your Supabase project: https://supabase.com/dashboard
2. Navigate to **SQL Editor**
3. Copy and paste the entire contents of `data/storage/auth-schema.sql`
4. Click **Run** to execute the migration

This will create:
- ✅ `users` table with Slack identity fields
- ✅ `chat_conversations` table (user-specific)
- ✅ `chat_messages` table (user-specific)
- ✅ `tasks` table with assignment fields
- ✅ `user_sessions` table for session tracking
- ✅ RLS policies for data isolation
- ✅ Indexes for performance
- ✅ Triggers for automatic timestamps

### Step 2: Configure Slack App (if not already done)

Your Slack app should already have these configured, but verify:

1. Go to https://api.slack.com/apps
2. Select your app
3. Go to **OAuth & Permissions**
4. Verify **Redirect URLs**:
   ```
   https://ydbujcuddfgiubjjajuq.supabase.co/auth/v1/callback
   ```
5. Verify **User Token Scopes**:
   - `identity.basic`
   - `identity.email`
   - `identity.avatar`
   - `identity.team`

### Step 3: Test the Authentication

1. **Start the app:**
   ```bash
   npm run dev:desktop
   ```

2. **You should see:**
   - If no existing session: Login screen with "Sign in with Slack" button
   - If existing session: Main HeyJarvis interface

3. **Click "Continue with Slack":**
   - OAuth window opens
   - Authenticate with your Slack workspace
   - Automatically redirected back to HeyJarvis
   - Main interface loads with your user data

4. **Session Persistence:**
   - Close and reopen the app
   - Should automatically restore your session
   - No need to re-authenticate

## 📊 How User Data Works

### User Identification
Every user has:
- **Supabase Auth ID** (UUID) - Primary identifier
- **Slack User ID** - Links to Slack identity
- **Email** - From Slack profile
- **Name & Avatar** - From Slack profile

### Data Isolation

All user data is automatically isolated using Row Level Security (RLS):

```sql
-- Example: Users only see their own chats
CREATE POLICY "Users can view own messages" ON chat_messages
  FOR SELECT
  USING (auth.uid() = user_id);
```

This means:
- ✅ Users can only see their own chat history
- ✅ Users can only see tasks assigned to them or created by them
- ✅ No cross-user data leakage
- ✅ Automatic enforcement at database level

### Task Assignment

Tasks now support:
- `assigned_to` - User the task is assigned to
- `created_by` - User who created the task
- Users can see tasks they created or are assigned to

## 🔒 Security Features

1. **Encrypted Session Storage**
   - Sessions stored locally with encryption
   - Uses `ENCRYPTION_KEY` from `.env`

2. **Row Level Security**
   - Database-level data isolation
   - Cannot be bypassed by application code

3. **Secure IPC Bridge**
   - Context isolation enabled
   - No direct access to Node.js APIs from renderer

4. **Token Refresh**
   - Automatic refresh before expiration
   - Seamless user experience

## 🎯 Next Steps

### User Interface Updates

You'll want to update the main interface to show user info:

```javascript
// Get current user
const user = await window.electronAPI.auth.getUser();

// Display user info
console.log('Logged in as:', user.name);
console.log('Email:', user.email);
console.log('Avatar:', user.avatar_url);
```

### Logout Button

Add a logout button somewhere in your UI:

```javascript
async function logout() {
  await window.electronAPI.auth.signOut();
  // App will automatically show login screen
}
```

### User-Specific Queries

When fetching data, it's now automatically filtered by user:

```javascript
// Supabase automatically uses auth.uid() in RLS policies
const { data: tasks } = await supabase
  .from('tasks')
  .select('*')
  .eq('status', 'pending');
// Returns only tasks for current user
```

## 📝 What's Left to Do

- [ ] Add user profile display in main UI
- [ ] Add logout button in settings/menu
- [ ] Update task creation to set `created_by` and `assigned_to`
- [ ] Update chat messages to link to `user_id`
- [ ] Add user avatar display
- [ ] Add "Switch Account" functionality (optional)

## 🐛 Troubleshooting

### "No valid session" on startup
- Session may have expired
- Clear stored session: Delete `~/.config/heyjarvis-auth/config.json`
- Re-authenticate

### OAuth window doesn't open
- Check Slack app configuration
- Verify redirect URLs in Slack app settings
- Check console for errors

### Database permission errors
- Ensure auth-schema.sql was run successfully
- Check RLS policies are enabled
- Verify user is authenticated in Supabase

### Session not persisting
- Check `ENCRYPTION_KEY` is set in `.env`
- Verify `electron-store` is installed: `npm list electron-store`

## 🎉 Success!

You now have:
- ✅ Complete Slack OAuth authentication
- ✅ User-specific data isolation
- ✅ Persistent sessions
- ✅ Secure credential management
- ✅ Beautiful login UI

Users can now sign in with their Slack identity and have their own private workspace in HeyJarvis!

