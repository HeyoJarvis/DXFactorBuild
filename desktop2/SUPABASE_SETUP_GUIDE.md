# HeyJarvis Supabase Setup Guide

## Quick Start

### 1. Create New Supabase Project

1. Go to [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. Click "New Project"
3. Choose your organization
4. Enter project details:
   - **Name**: `heyjarvis-prod` (or your preferred name)
   - **Database Password**: Generate a strong password (save it!)
   - **Region**: Choose closest to your users
5. Click "Create new project"
6. Wait for project to be ready (~2 minutes)

### 2. Run Database Setup

1. In your Supabase project, go to **SQL Editor** (left sidebar)
2. Click "New query"
3. Open the file `SUPABASE_SETUP.sql` from this directory
4. Copy the entire contents
5. Paste into the SQL Editor
6. Click "Run" (or press Cmd/Ctrl + Enter)
7. Wait for completion (should see "Success" message)

### 3. Configure Email Authentication

1. Go to **Authentication** > **Providers** (left sidebar)
2. Find **Email** provider
3. Enable it
4. **Important Settings**:
   - ✅ Enable Email provider
   - ✅ Confirm email: **Disabled** (for faster testing, enable later)
   - ✅ Secure email change: Enabled
   - ✅ Secure password change: Enabled

### 4. Get Your API Credentials

1. Go to **Settings** > **API** (left sidebar)
2. Copy these values:
   - **Project URL** (e.g., `https://xxxxx.supabase.co`)
   - **anon public** key (starts with `eyJ...`)

### 5. Update Your .env File

Update your `.env` file in the `desktop2` directory:

```bash
# Supabase Configuration
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Optional: For encryption (generate a random 32-character string)
ENCRYPTION_KEY=your-random-32-char-encryption-key-here
```

### 6. Test Your Setup

1. Restart your app: `npm run dev`
2. You should see the email login screen
3. Try signing up with a test email:
   - Email: `test@example.com`
   - Password: `TestPassword123!`
4. You should be logged in and see Mission Control

## Database Schema Overview

### Tables Created

1. **`users`** - User profiles and settings
   - Linked to Supabase Auth
   - Stores JIRA integration tokens
   - Tracks user role (developer, admin, pm, etc.)

2. **`conversation_sessions`** - Tasks/Issues
   - Stores both JIRA-synced and manual tasks
   - Contains JIRA metadata (status, priority, story points, etc.)
   - Supports task chat history

3. **`conversation_messages`** - AI Chat Messages
   - Stores chat messages for each task
   - Tracks AI model usage and tokens

4. **`reports`** - Generated Reports
   - Feature/Epic reports
   - Person/Team reports (hidden but available)

5. **`user_activity`** - Analytics
   - Tracks user actions
   - For future analytics dashboard

### Key Features

✅ **Row Level Security (RLS)** - Users can only access their own data
✅ **Auto-timestamps** - `created_at` and `updated_at` managed automatically
✅ **JIRA Integration** - Full support for JIRA metadata and sync
✅ **Task Chat** - Each task has its own AI chat history
✅ **Reports** - Store and retrieve generated reports
✅ **Email Auth** - Simple email/password authentication

## Troubleshooting

### Issue: "relation does not exist"
**Solution**: Make sure you ran the entire SQL setup script. Try running it again.

### Issue: "permission denied for schema public"
**Solution**: The script includes GRANT statements. Make sure you're running as the project owner.

### Issue: Email signup not working
**Solution**: 
1. Check that Email provider is enabled in Authentication > Providers
2. Verify SUPABASE_URL and SUPABASE_ANON_KEY in your .env file
3. Restart your app after updating .env

### Issue: JIRA integration not saving
**Solution**: 
1. Check that `integration_settings` column exists in `users` table
2. Verify RLS policies allow updates to the users table
3. Check browser console for errors

## Next Steps

### 1. Connect JIRA

1. Go to Settings in your app
2. Click "Connect" on JIRA integration
3. Follow OAuth flow
4. Your JIRA tasks will start syncing automatically

### 2. Customize User Roles

Update user roles in Supabase Dashboard:

```sql
UPDATE public.users
SET user_role = 'pm'  -- or 'developer', 'admin', 'functional'
WHERE email = 'your-email@example.com';
```

### 3. Enable Email Confirmation (Production)

For production, enable email confirmation:

1. Go to Authentication > Providers > Email
2. Enable "Confirm email"
3. Configure email templates in Authentication > Email Templates

### 4. Set Up Custom Domain (Optional)

1. Go to Settings > Custom Domains
2. Follow instructions to add your domain
3. Update SUPABASE_URL in .env

## Database Maintenance

### Backup Your Data

Supabase provides automatic backups, but you can also:

```sql
-- Export all users
SELECT * FROM public.users;

-- Export all tasks
SELECT * FROM public.conversation_sessions;
```

### Clean Up Old Data

```sql
-- Delete completed tasks older than 90 days
DELETE FROM public.conversation_sessions
WHERE is_completed = true
AND completed_at < NOW() - INTERVAL '90 days';

-- Delete old activity logs
DELETE FROM public.user_activity
WHERE created_at < NOW() - INTERVAL '30 days';
```

## Support

If you encounter issues:

1. Check Supabase Dashboard > Logs for errors
2. Check browser console for frontend errors
3. Check terminal for backend errors
4. Verify all environment variables are set correctly

## Schema Diagram

```
auth.users (Supabase Auth)
    ↓
public.users (Your app profiles)
    ↓
public.conversation_sessions (Tasks)
    ↓
public.conversation_messages (Task chat)

public.reports (Generated reports)
public.user_activity (Analytics)
```

## Important Notes

- **Never commit your .env file** - It contains sensitive credentials
- **Use strong passwords** - Especially for production
- **Enable 2FA** - On your Supabase account
- **Monitor usage** - Check Supabase Dashboard > Usage regularly
- **RLS is enabled** - Users can only access their own data

