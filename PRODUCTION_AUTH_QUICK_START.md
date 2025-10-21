# 🚀 Production Auth - Quick Start

## What Changed?

Your HeyJarvis database now supports:

✅ **Multi-role users** (Sales vs Developer = different app experiences)  
✅ **Multi-provider auth** (Slack + Microsoft + Google)  
✅ **Secure integration tokens** (tracked in `integration_connections` table)  
✅ **Audit logging** (compliance-ready)  
✅ **Proper data isolation** (RLS enabled on all tables)

---

## 🎯 Key Changes to Your Schema

### ✨ Users Table - Enhanced

**New Columns:**
```sql
-- Role system (determines which features user sees)
user_role                -- 'sales', 'developer', 'admin'

-- Multi-provider identity
microsoft_user_id        -- Microsoft account ID
microsoft_tenant_id
microsoft_email
google_user_id           -- Google account ID  
google_email
primary_auth_provider    -- Which provider they signed up with

-- Feature flags
enabled_features         -- Array of enabled features
disabled_features        -- Array of disabled features

-- Security
two_factor_enabled
allowed_ip_addresses
is_suspended

-- Enhanced tracking
onboarding_step
total_sessions
total_tasks_created
total_ai_messages
last_login_at
subscription_ends_at
```

### ✨ Tasks Table - Enhanced

**New Columns:**
```sql
-- Workflow routing (determines which UI shows the task)
route_to                 -- 'tasks-sales', 'mission-control', 'architecture'
work_type                -- 'task', 'email', 'calendar', 'code_review', 'outreach'

-- JIRA sync
external_id
external_source
external_url
jira_key
jira_status
jira_synced_at

-- Organization
workflow_metadata
tags
time_spent_minutes
```

### ✨ New Tables

**integration_connections** - Tracks OAuth connections
```sql
- user_id
- integration_name (slack, microsoft, google, jira, hubspot, etc)
- status (active, disconnected, expired, error)
- access_token_encrypted
- refresh_token_encrypted
- token_expires_at
- granted_scopes
- last_synced_at
- error_count
```

**audit_logs** - Security & compliance
```sql
- user_id
- action (user.login, task.create, integration.connect, etc)
- resource_type
- resource_id
- ip_address
- success
- severity
- created_at
```

---

## 🏃 Running the Migration

### Step 1: Backup (CRITICAL!)

```bash
# In Supabase Dashboard: Database → Backups → Create Backup
```

### Step 2: Run Migration

Open Supabase SQL Editor and run:

```sql
-- This file is SAFE - it only ADDS columns and tables
-- Your existing data is preserved
```

Paste the contents of: `data/storage/PRODUCTION_AUTH_MIGRATION.sql`

**Expected results:**
- ✅ New columns added to existing tables
- ✅ New tables created (integration_connections, audit_logs)
- ✅ Existing integration_settings migrated to integration_connections
- ✅ All users assigned default roles

### Step 3: Verify

```sql
-- Check users have roles
SELECT user_role, COUNT(*) FROM users GROUP BY user_role;

-- Check integrations migrated
SELECT COUNT(*) FROM integration_connections;

-- Check RLS enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('users', 'tasks', 'integration_connections');
```

---

## 🔧 Code Changes Required

### 1. Update Task Filtering (CRITICAL)

**File:** `desktop2/main/services/SupabaseAdapter.js`

**Change:** Add role-based filtering to `getUserTasks()`

```javascript
async getUserTasks(userId, filters = {}) {
  // Get user's role
  const { data: userData } = await this.supabase
    .from('users')
    .select('user_role')
    .eq('id', userId)
    .single();

  const userRole = userData?.user_role || 'sales';

  let query = this.supabase
    .from('tasks')
    .select('*')
    .or(`created_by.eq.${userId},assigned_to.eq.${userId}`)
    .order('created_at', { ascending: false });

  // Filter by role
  if (userRole === 'sales') {
    query = query.or('route_to.eq.tasks-sales,work_type.in.(email,calendar)');
  } else if (userRole === 'developer') {
    query = query.or('route_to.eq.mission-control,work_type.in.(email,calendar)');
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}
```

### 2. Save User Role on Login

**File:** `desktop2/main/services/AuthService.js`

**Change:** Add `user_role` to userData in `handleSuccessfulAuth()`

```javascript
const userData = {
  id: user.id,
  email: user.email,
  // ... other fields ...
  
  // NEW: Add role
  user_role: this.determineUserRole(user.email), // or let user choose
  primary_auth_provider: 'slack',
  last_login_at: new Date().toISOString()
};
```

### 3. Use Integration Connections Table

**File:** `desktop2/main/ipc/mission-control-handlers.js`

**Change:** Save to `integration_connections` instead of `users.integration_settings`

```javascript
// OLD WAY (deprecated):
// const { data } = await supabase
//   .from('users')
//   .update({ integration_settings: { microsoft: { ...tokens } } })
//   .eq('id', userId);

// NEW WAY:
const { data } = await supabase
  .from('integration_connections')
  .upsert({
    user_id: userId,
    integration_name: 'microsoft',
    integration_type: 'oauth',
    status: 'active',
    access_token_encrypted: encrypt(tokens.access_token),
    refresh_token_encrypted: encrypt(tokens.refresh_token),
    token_expires_at: tokens.expires_at,
    external_email: tokens.account?.username,
    granted_scopes: tokens.scopes,
    connected_at: new Date().toISOString()
  }, { 
    onConflict: 'user_id,integration_name' 
  });
```

---

## 📊 How Roles Work

### Sales Role
**Sees:**
- Chat
- Tasks (Sales view)
- CRM integrations
- Email composer
- Calendar
- Mission Control (shared view)

**UI Route:** `route_to = 'tasks-sales'`

### Developer Role
**Sees:**
- Chat
- Tasks (Developer view)
- JIRA integration
- GitHub integration
- Code indexer
- Architecture diagram
- Mission Control (shared view)

**UI Route:** `route_to = 'mission-control'`

### Dual-Route Tasks

Tasks with `work_type = 'email'` or `work_type = 'calendar'` appear in **BOTH** views.

---

## 🔐 Security Notes

### Row Level Security (RLS)

RLS is now enabled on all tables. This means:

- Users can **only see their own data**
- Service role (your app) can **bypass RLS** with service role key
- Cross-user data access is **automatically blocked**

**Testing RLS:**
```sql
-- As user A, try to access user B's tasks
SET request.jwt.claims = '{"sub": "user-a-uuid"}';
SELECT * FROM tasks WHERE assigned_to = 'user-b-uuid';
-- Returns empty (blocked by RLS)
```

### Token Encryption

**⚠️ CRITICAL**: Add encryption for tokens:

```bash
# Add to .env
ENCRYPTION_KEY=your-32-character-secret-key-here!!!!!
```

Use the `IntegrationConnectionManager` class from the implementation guide.

---

## 🧪 Testing Checklist

After migration, test:

- [ ] Existing users can log in
- [ ] Tasks appear based on user role
- [ ] Slack integration still works
- [ ] Microsoft/Google OAuth connects
- [ ] Settings page shows integration status
- [ ] Task chats load correctly
- [ ] No duplicate tasks across roles (unless email/calendar)

---

## 🚨 Troubleshooting

### "Tasks not showing up"

**Cause:** User's tasks have wrong `route_to` value

**Fix:**
```sql
-- Set all existing tasks to sales view
UPDATE tasks SET route_to = 'tasks-sales' WHERE route_to IS NULL;

-- Or developer view
UPDATE tasks SET route_to = 'mission-control' WHERE route_to IS NULL;
```

### "Integration status shows disconnected"

**Cause:** Tokens not migrated to `integration_connections`

**Fix:**
```sql
-- Check if migration ran
SELECT COUNT(*) FROM integration_connections;

-- If 0, re-run Step 10 of migration
```

### "Permission denied for table"

**Cause:** RLS blocking service role

**Fix:** Ensure you're using service role key in backend:
```javascript
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY // Not anon key!
);
```

---

## 📁 Files Reference

| File | Purpose |
|------|---------|
| `PRODUCTION_AUTH_SCHEMA.sql` | Full production schema (for reference) |
| `PRODUCTION_AUTH_MIGRATION.sql` | **RUN THIS** - Safe migration from existing schema |
| `PRODUCTION_AUTH_IMPLEMENTATION_GUIDE.md` | Full implementation guide with code examples |
| `PRODUCTION_AUTH_QUICK_START.md` | This file - quick reference |

---

## 🎯 Next Steps

### Immediate (Do Now)
1. ✅ Backup your database
2. ✅ Run `PRODUCTION_AUTH_MIGRATION.sql`
3. ✅ Verify migration succeeded
4. ✅ Update `getUserTasks()` in SupabaseAdapter
5. ✅ Update `handleSuccessfulAuth()` in AuthService

### Week 1
- Migrate integration token storage to `integration_connections`
- Update Settings page to read from `integration_connections`
- Test all OAuth flows

### Week 2
- Implement token encryption
- Add audit logging to critical actions
- Build role selection UI for new users

### Week 3
- Build onboarding flow
- Implement team/company features
- Add admin dashboard

---

## 💡 Key Insights

### Why This Schema?

**Problem:** Your sales and developer features are essentially two different apps, but sharing one user table made it confusing.

**Solution:** The `user_role` enum clearly separates these experiences while keeping them in one codebase.

**Benefits:**
- ✅ Clear feature boundaries
- ✅ Easier to reason about permissions
- ✅ Separate UI experiences
- ✅ Future-proof for more roles

### Why Integration Connections Table?

**Problem:** Storing all OAuth tokens in `users.integration_settings` JSON is hard to query, audit, and secure.

**Solution:** Dedicated table with encryption, health monitoring, and proper indexing.

**Benefits:**
- ✅ Easy to query which integrations are active
- ✅ Track sync status and errors
- ✅ Proper encryption at column level
- ✅ Audit trail for compliance

---

## 📚 Need Help?

- **Full implementation guide:** `PRODUCTION_AUTH_IMPLEMENTATION_GUIDE.md`
- **Schema reference:** `PRODUCTION_AUTH_SCHEMA.sql`
- **Migration script:** `PRODUCTION_AUTH_MIGRATION.sql`

**Questions?** Check the troubleshooting section in the implementation guide.

---

**You're ready for production! 🎉**

