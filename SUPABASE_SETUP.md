# 🚀 Supabase Setup Guide for HeyJarvis

This guide will walk you through setting up Supabase as the database backend for HeyJarvis.

## 📋 What You Need from Supabase

You need **3 values** from your Supabase project:

1. **SUPABASE_URL** - Your project URL
2. **SUPABASE_ANON_KEY** - Public anonymous key (for client-side operations)
3. **SUPABASE_SERVICE_ROLE_KEY** - Private service key (for admin operations)

---

## 🔑 Step 1: Get Your Supabase Credentials

### 1.1 Create a Supabase Account (if you don't have one)

1. Go to [https://supabase.com](https://supabase.com)
2. Click "Start your project"
3. Sign up with GitHub, Google, or email

### 1.2 Create a New Project

1. Click "New Project"
2. Choose an organization or create one
3. Fill in project details:
   - **Name**: `heyjarvis` (or your preferred name)
   - **Database Password**: Generate a strong password (save it!)
   - **Region**: Choose closest to your users
   - **Pricing Plan**: Free tier is fine to start
4. Click "Create new project"
5. Wait 2-3 minutes for setup to complete

### 1.3 Get Your API Credentials

1. Once your project is ready, click on **Settings** (⚙️) in the left sidebar
2. Navigate to **API** section
3. You'll see:

```
Project URL: https://xxxxxxxxxxxxx.supabase.co
```
👆 This is your **SUPABASE_URL**

Scroll down to **Project API keys**:

```
anon public: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```
👆 This is your **SUPABASE_ANON_KEY**

```
service_role secret: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```
👆 This is your **SUPABASE_SERVICE_ROLE_KEY**

⚠️ **IMPORTANT**: Never commit the service_role key to git! It has admin access.

---

## 🔧 Step 2: Configure Your Environment

1. Open your `.env` file in the project root
2. Replace the placeholder values:

```bash
# Supabase Database
SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6...

# JWT Secret for session management (generate a random string)
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
```

3. Generate a strong JWT secret:
```bash
# On Linux/Mac:
openssl rand -base64 32

# Or use Node:
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

4. Save the `.env` file

---

## 📊 Step 3: Set Up the Database Schema

### Option A: Using the SQL Editor (Recommended)

1. Go to your Supabase dashboard
2. Click on **SQL Editor** (📝) in the left sidebar
3. Click **New Query**
4. Open the file: `data/storage/supabase-schema-improved.sql`
5. Copy **ALL** the contents
6. Paste into the SQL Editor
7. Click **Run** or press `Ctrl+Enter`
8. Wait for completion (should take 5-10 seconds)
9. You should see: ✅ Success. No rows returned

### Option B: Using the Migration Script

```bash
cd data/migrations
node supabase-setup.js
```

This script will:
- Test your connection
- Check if schema exists
- Execute the SQL schema
- Create sample data
- Verify the setup

---

## ✅ Step 4: Verify Your Setup

Run the verification script:

```bash
node scripts/verify-supabase.js
```

You should see:
```
🚀 Supabase Connection Verification

✅ SUPABASE_URL: https://xxxxx.supabase.co...
✅ SUPABASE_ANON_KEY: Configured
✅ Successfully connected to Supabase!
✅ Table 'users' ✓
✅ Table 'teams' ✓
✅ Table 'signals' ✓
... (and more)

📊 Verification Summary
✅ Passed: 25
⚠️  Warnings: 0
❌ Failed: 0

🎉 All checks passed! Your Supabase is ready to use.
```

---

## 🎯 Step 5: Test the Integration

### 5.1 Test Basic Operations

Create a test file:

```bash
node -e "
const SupabaseClient = require('./data/storage/supabase-client');

async function test() {
  const client = new SupabaseClient();
  
  // Test connection
  const connected = await client.testConnection();
  console.log('Connected:', connected);
  
  // Get stats
  const stats = await client.getStats();
  console.log('Database stats:', stats);
}

test();
"
```

### 5.2 Test with Demo Script

```bash
node demo.js
```

This will:
- Connect to Supabase
- Create test signals
- Process them through the AI pipeline
- Store results in the database

---

## 📁 What Got Created in Your Database

Your Supabase database now has:

### Core Tables:
- **users** - User accounts and profiles
- **teams** - Team workspaces
- **companies** - Enterprise organizations
- **sources** - RSS feeds, APIs, data sources
- **signals** - Competitive intelligence signals
- **feedback** - User feedback for AI learning
- **signal_deliveries** - Delivery tracking

### Chat System:
- **chat_conversations** - Chat history
- **chat_messages** - Individual messages
- **user_sessions** - Authentication sessions

### Slack Integration:
- **slack_conversations** - Captured Slack conversations
- **conversation_contexts** - Context for AI responses

### Analytics:
- **daily_metrics** - Aggregated usage metrics

### Sample Data:
- Demo Company
- Product Team
- 2 sample sources (TechCrunch, Hacker News)

---

## 🔐 Security Features Enabled

### Row Level Security (RLS)
✅ All tables have RLS enabled
✅ Users can only see their own data
✅ Team members can see team data
✅ Service role bypasses RLS for admin operations

### Indexes
✅ Optimized indexes for fast queries
✅ Full-text search on signals
✅ Composite indexes for common patterns

### Constraints
✅ CHECK constraints on score fields (0-1 range)
✅ Foreign key constraints with proper CASCADE
✅ UNIQUE constraints on email, slug, external_id
✅ Soft delete support

---

## 🎨 Supabase Dashboard Features

### Explore Your Data
1. Click **Table Editor** to browse data
2. Click **Database** to see schema
3. Click **API** to see auto-generated REST API

### Real-time Monitoring
1. Click **Database > Logs** to see queries
2. Click **Database > Extensions** to manage extensions
3. Click **Database > Replication** for backups

### Built-in Features You Get:
- ✅ Auto-generated REST API
- ✅ Auto-generated GraphQL API (optional)
- ✅ Real-time subscriptions
- ✅ Authentication (if needed)
- ✅ Storage buckets (for files)
- ✅ Edge Functions (serverless)

---

## 🚨 Troubleshooting

### Error: "relation does not exist"
**Solution**: Schema not installed. Go back to Step 3.

### Error: "JWT expired" or "Invalid JWT"
**Solution**: Check your SUPABASE_ANON_KEY is correct.

### Error: "Connection refused"
**Solution**: Check your SUPABASE_URL is correct and project is active.

### Error: "permission denied"
**Solution**: RLS policies might be blocking. Use service_role key for admin operations.

### Warning: "Tables exist but empty"
**Solution**: This is normal. Data will be created as you use the system.

---

## 📚 Next Steps

1. ✅ Credentials configured
2. ✅ Schema installed
3. ✅ Connection verified

Now you can:
- Start the Slack bot: `npm run dev:delivery`
- Start the desktop app: `npm run dev:desktop`
- Run the demo: `node demo.js`
- Test integrations: `node test-complete-system.js`

---

## 🔗 Useful Links

- **Supabase Docs**: https://supabase.com/docs
- **SQL Reference**: https://supabase.com/docs/guides/database
- **RLS Policies**: https://supabase.com/docs/guides/auth/row-level-security
- **Supabase JS Client**: https://supabase.com/docs/reference/javascript/introduction

---

## 💡 Pro Tips

1. **Backup Your Database**
   - Supabase does daily backups on paid plans
   - For free tier, export manually: `Database > Backups`

2. **Monitor Performance**
   - Check `Database > Logs` regularly
   - Enable `pg_stat_statements` extension
   - Watch for slow queries

3. **Use Prepared Statements**
   - The SupabaseClient already does this
   - Prevents SQL injection
   - Better performance

4. **Real-time Subscriptions**
   ```javascript
   const subscription = client.subscribeToSignals(userId, (payload) => {
     console.log('New signal:', payload);
   });
   ```

5. **Batch Operations**
   ```javascript
   // Instead of multiple inserts
   await supabase.from('signals').insert([signal1, signal2, signal3]);
   ```

---

## 🎉 You're All Set!

Your HeyJarvis system is now connected to Supabase with a production-ready schema. All data will persist across restarts, and you have real-time capabilities ready to use.

Need help? Check the logs or run `node scripts/verify-supabase.js` to diagnose issues.

