# 🚀 Production Auth Implementation Guide

## Overview

This guide walks you through upgrading HeyJarvis to production-ready authentication with:

- ✅ **Multi-role support** (Sales vs Developer = separate apps)
- ✅ **Multi-provider OAuth** (Slack, Microsoft, Google)
- ✅ **Proper user isolation** with Row Level Security
- ✅ **Integration token management**
- ✅ **Audit logging** for compliance
- ✅ **Zero downtime migration** from existing schema

---

## 🎯 Key Concepts

### User Roles = Separate Apps

The `user_role` enum determines which features a user sees:

```sql
-- Sales users see:
- Chat, Tasks (Sales), CRM, Email, Calendar, Mission Control

-- Developer users see:
- Chat, Tasks (Developer), JIRA, GitHub, Code Indexer, Architecture

-- Admin users see:
- Everything + Admin panel
```

### Multi-Provider Identity

Users can authenticate with **Slack, Microsoft, or Google**. The system tracks:

1. **Primary auth provider** (how they signed up)
2. **All connected identities** (Slack ID, Microsoft ID, Google ID)
3. **Integration tokens** stored securely in `integration_connections`

### Data Isolation

Every table uses RLS (Row Level Security) to ensure:
- Users only see their own data
- Tasks are filtered by `created_by` or `assigned_to`
- Conversations are private to the user
- Service role (your app) can access everything

---

## 📋 Migration Steps

### Step 1: Backup Your Data

```bash
# Export your current Supabase schema
npx supabase db dump --db-url "YOUR_SUPABASE_URL" > backup.sql

# Or use Supabase Dashboard: Database > Backups
```

### Step 2: Run the Migration

In your Supabase SQL Editor, run this **in order**:

```bash
# 1. Run the safe migration (enhances existing tables)
cat data/storage/PRODUCTION_AUTH_MIGRATION.sql

# This will:
# - Add new columns to existing tables (safe)
# - Create new tables (integration_connections, audit_logs)
# - Migrate your integration_settings data
# - Set default user roles
```

**⚠️ Important**: The migration is **non-destructive**. It only adds columns and creates new tables. Your existing data is preserved.

### Step 3: Verify Migration

```sql
-- Check that all users have roles assigned
SELECT user_role, COUNT(*) 
FROM public.users 
GROUP BY user_role;

-- Verify integration_connections migration
SELECT user_id, integration_name, status 
FROM public.integration_connections 
LIMIT 10;

-- Check RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('users', 'tasks', 'integration_connections');
```

---

## 🔧 Code Updates Required

### 1. Update SupabaseAdapter for Role-Based Tasks

```javascript
// desktop2/main/services/SupabaseAdapter.js

async getUserTasks(userId, filters = {}) {
  try {
    // Get user's role first
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

    // Role-based filtering
    if (userRole === 'sales') {
      // Sales sees sales tasks + dual-route tasks (email/calendar)
      query = query.or('route_to.eq.tasks-sales,work_type.in.(email,calendar)');
    } else if (userRole === 'developer') {
      // Developer sees mission-control tasks + dual-route tasks
      query = query.or('route_to.eq.mission-control,work_type.in.(email,calendar)');
    }

    // Apply additional filters
    if (filters.status) {
      query = query.eq('status', filters.status);
    }
    if (filters.workType) {
      query = query.eq('work_type', filters.workType);
    }

    const { data, error } = await query;
    if (error) throw error;

    return data || [];
  } catch (error) {
    this.logger.error('Error fetching user tasks', { userId, error: error.message });
    throw error;
  }
}
```

### 2. Update AuthService to Save User Role

```javascript
// desktop2/main/services/AuthService.js

async handleSuccessfulAuth(session) {
  try {
    this.currentSession = session;
    
    const { data: { user }, error } = await this.supabase.auth.getUser();
    if (error) throw error;

    const slackIdentity = user.identities?.find(id => id.provider === 'slack');
    const slackData = slackIdentity?.identity_data || {};
    
    // Determine role based on email or let user choose during onboarding
    const userRole = this.determineUserRole(user.email);

    const userData = {
      id: user.id,
      email: user.email,
      name: slackData.name || user.user_metadata?.name || user.email?.split('@')[0],
      avatar_url: slackData.image_512 || slackData.image_192 || user.user_metadata?.avatar_url,
      
      // Identity fields
      slack_user_id: slackData.sub || slackData.user_id,
      slack_team_id: slackData.team_id,
      slack_team_name: slackData.team_name,
      
      // Role & auth
      user_role: userRole,
      primary_auth_provider: 'slack',
      
      // Timestamps
      last_login_at: new Date().toISOString(),
      last_active_at: new Date().toISOString()
    };
    
    // Upsert user
    const { data: dbUser, error: dbError } = await this.supabase
      .from('users')
      .upsert(userData, { onConflict: 'id' })
      .select()
      .single();
    
    if (dbError) {
      this.logger.warn('Failed to upsert user', { error: dbError.message });
      this.currentUser = userData;
    } else {
      this.currentUser = dbUser;
    }
    
    // Preserve integration_settings across logins
    this.store.set('user', this.currentUser);
    this.store.set('session', this.currentSession);
    
    this.logger.info('User authenticated', { 
      userId: this.currentUser.id, 
      role: this.currentUser.user_role 
    });
    
  } catch (error) {
    this.logger.error('handleSuccessfulAuth failed', { error: error.message });
    throw error;
  }
}

determineUserRole(email) {
  // You can customize this logic
  if (email.includes('dev') || email.includes('eng')) {
    return 'developer';
  }
  return 'sales'; // Default to sales
}
```

### 3. Add Integration Connection Tracking

```javascript
// desktop2/main/services/IntegrationConnectionManager.js (NEW FILE)

class IntegrationConnectionManager {
  constructor({ supabaseAdapter, logger }) {
    this.supabase = supabaseAdapter.supabase;
    this.logger = logger;
  }

  async saveConnection(userId, integration, tokens) {
    try {
      const connectionData = {
        user_id: userId,
        integration_name: integration, // 'microsoft', 'google', 'jira', etc
        integration_type: 'oauth',
        status: 'active',
        
        // Store encrypted tokens (encrypt in your app layer)
        access_token_encrypted: this.encrypt(tokens.access_token),
        refresh_token_encrypted: tokens.refresh_token ? this.encrypt(tokens.refresh_token) : null,
        token_expires_at: tokens.expires_at || null,
        
        // Provider-specific data
        external_user_id: tokens.user_id || null,
        external_account_name: tokens.account_name || null,
        external_email: tokens.email || null,
        
        granted_scopes: tokens.scopes || [],
        connection_metadata: {
          tenant_id: tokens.tenant_id,
          cloud_id: tokens.cloud_id,
          site_url: tokens.site_url,
          ...tokens.metadata
        },
        
        connected_at: new Date().toISOString()
      };

      const { data, error } = await this.supabase
        .from('integration_connections')
        .upsert(connectionData, { 
          onConflict: 'user_id,integration_name',
          ignoreDuplicates: false 
        })
        .select()
        .single();

      if (error) throw error;

      this.logger.info('Integration connection saved', { 
        userId, 
        integration, 
        connectionId: data.id 
      });

      return { success: true, connection: data };
    } catch (error) {
      this.logger.error('Failed to save integration connection', { 
        userId, 
        integration, 
        error: error.message 
      });
      throw error;
    }
  }

  async getConnection(userId, integration) {
    try {
      const { data, error } = await this.supabase
        .from('integration_connections')
        .select('*')
        .eq('user_id', userId)
        .eq('integration_name', integration)
        .eq('status', 'active')
        .single();

      if (error && error.code !== 'PGRST116') throw error; // Ignore "not found"

      if (data) {
        // Decrypt tokens before returning
        return {
          ...data,
          access_token: this.decrypt(data.access_token_encrypted),
          refresh_token: data.refresh_token_encrypted ? this.decrypt(data.refresh_token_encrypted) : null
        };
      }

      return null;
    } catch (error) {
      this.logger.error('Failed to get integration connection', { 
        userId, 
        integration, 
        error: error.message 
      });
      return null;
    }
  }

  async updateConnectionStatus(userId, integration, status, errorMessage = null) {
    try {
      const updateData = {
        status,
        last_health_check_at: new Date().toISOString()
      };

      if (errorMessage) {
        updateData.last_error = errorMessage;
        updateData.last_error_at = new Date().toISOString();
        updateData.error_count = this.supabase.raw('error_count + 1');
      } else {
        updateData.last_synced_at = new Date().toISOString();
        updateData.sync_count = this.supabase.raw('sync_count + 1');
      }

      const { error } = await this.supabase
        .from('integration_connections')
        .update(updateData)
        .eq('user_id', userId)
        .eq('integration_name', integration);

      if (error) throw error;

      this.logger.info('Integration connection status updated', { 
        userId, 
        integration, 
        status 
      });
    } catch (error) {
      this.logger.error('Failed to update connection status', { 
        userId, 
        integration, 
        error: error.message 
      });
    }
  }

  encrypt(text) {
    // Use your encryption library (crypto-js, etc)
    // For now, placeholder - IMPLEMENT PROPER ENCRYPTION
    const crypto = require('crypto');
    const algorithm = 'aes-256-cbc';
    const key = Buffer.from(process.env.ENCRYPTION_KEY || 'your-32-char-secret-key-here!!', 'utf-8');
    const iv = crypto.randomBytes(16);
    
    const cipher = crypto.createCipheriv(algorithm, key, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    return iv.toString('hex') + ':' + encrypted;
  }

  decrypt(text) {
    // Match your encryption method
    const crypto = require('crypto');
    const algorithm = 'aes-256-cbc';
    const key = Buffer.from(process.env.ENCRYPTION_KEY || 'your-32-char-secret-key-here!!', 'utf-8');
    
    const parts = text.split(':');
    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = parts[1];
    
    const decipher = crypto.createDecipheriv(algorithm, key, iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }
}

module.exports = IntegrationConnectionManager;
```

### 4. Update Settings Page to Use Integration Connections

```javascript
// desktop2/renderer2/src/pages/Settings.jsx

async function checkIntegrationStatuses() {
  setLoading(true);
  try {
    const statuses = {};

    // Check all integrations via API
    if (window.electronAPI?.integrations?.getConnections) {
      const connections = await window.electronAPI.integrations.getConnections();
      
      connections.forEach(conn => {
        statuses[conn.integration_name] = {
          connected: conn.status === 'active',
          enabled: conn.status === 'active',
          lastSynced: conn.last_synced_at,
          error: conn.last_error
        };
      });
    }

    // Update state
    setIntegrations(prev => {
      const updated = { ...prev };
      Object.keys(statuses).forEach(key => {
        if (updated[key]) {
          updated[key] = { ...updated[key], ...statuses[key] };
        }
      });
      return updated;
    });

  } catch (error) {
    console.error('Error checking integration statuses:', error);
  } finally {
    setLoading(false);
  }
}
```

---

## 🔐 Security Considerations

### 1. Token Encryption

**⚠️ CRITICAL**: Never store OAuth tokens in plain text!

```javascript
// Add to your .env
ENCRYPTION_KEY=your-32-character-secret-key-here

// Use a proper encryption library
npm install crypto-js
```

### 2. Row Level Security (RLS)

The migration enables RLS on all tables. Test it:

```sql
-- As a user, try to access another user's tasks
SELECT * FROM tasks WHERE assigned_to != auth.uid();
-- Should return empty (RLS blocks it)
```

### 3. Audit Logging

Log important user actions:

```javascript
// After user logs in
await supabase.rpc('log_audit_event', {
  p_user_id: user.id,
  p_action: 'user.login',
  p_resource_type: 'user',
  p_resource_id: user.id,
  p_success: true,
  p_metadata: { provider: 'slack', ip: req.ip }
});

// After integration connected
await supabase.rpc('log_audit_event', {
  p_user_id: user.id,
  p_action: 'integration.connected',
  p_resource_type: 'integration',
  p_resource_id: connectionId,
  p_description: 'Microsoft 365 connected',
  p_success: true
});
```

---

## 📊 Role-Based Feature Flags

Query available features per user:

```javascript
const { data: features } = await supabase
  .rpc('get_user_features', { p_user_id: userId });

console.log(features);
// Sales: { chat: true, tasks: true, crm: true, email: true, calendar: true }
// Developer: { chat: true, tasks: true, jira: true, github: true, code: true, architecture: true }
```

Use in your UI:

```javascript
// desktop2/renderer2/src/App.jsx

const [userFeatures, setUserFeatures] = useState({});

useEffect(() => {
  async function loadFeatures() {
    const features = await window.electronAPI.user.getFeatures();
    setUserFeatures(features);
  }
  loadFeatures();
}, [currentUser]);

// Conditional rendering
{userFeatures.jira && <Route path="/jira" element={<JiraView />} />}
{userFeatures.crm && <Route path="/crm" element={<CRMView />} />}
```

---

## 🧪 Testing Checklist

### After Migration

- [ ] All existing users have `user_role` assigned
- [ ] Tasks are visible based on role
- [ ] Slack integration still works
- [ ] Microsoft/Google OAuth flows work
- [ ] Task chats load correctly
- [ ] Integration status shows on Settings page
- [ ] RLS prevents cross-user data access
- [ ] Audit logs are being created

### Role Testing

- [ ] Create a sales user → sees sales tasks
- [ ] Create a developer user → sees developer tasks
- [ ] Calendar/email tasks appear in both views
- [ ] Tab bar shows correct tabs per role
- [ ] Features are properly gated

---

## 🚨 Rollback Plan

If something goes wrong:

```sql
-- 1. Restore from backup
-- (Use your backup.sql file)

-- 2. Or drop new tables only (keeps your data)
DROP TABLE IF EXISTS public.integration_connections CASCADE;
DROP TABLE IF EXISTS public.audit_logs CASCADE;

-- 3. Remove new columns (optional, they don't break anything)
ALTER TABLE public.users DROP COLUMN IF EXISTS user_role;
ALTER TABLE public.users DROP COLUMN IF EXISTS microsoft_user_id;
-- ... etc
```

---

## 📈 Next Steps

### Phase 1: Core Auth (Week 1)
1. ✅ Run migration
2. ✅ Update SupabaseAdapter for role-based tasks
3. ✅ Update AuthService to save user role
4. ✅ Test with existing users

### Phase 2: Integration Management (Week 2)
1. Create IntegrationConnectionManager
2. Migrate integration tokens
3. Update Settings page
4. Implement token encryption

### Phase 3: Audit & Compliance (Week 3)
1. Add audit logging to all auth flows
2. Add audit logging to integration connections
3. Create admin dashboard for audit logs
4. Implement session management

### Phase 4: Onboarding (Week 4)
1. Build role selection UI
2. Build integration selection UI
3. Create onboarding flow
4. Add team invitation system

---

## 🆘 Troubleshooting

### Issue: Tasks not showing up

**Check:**
```sql
SELECT id, title, route_to, work_type, created_by, assigned_to 
FROM tasks 
WHERE assigned_to = 'YOUR_USER_ID';
```

**Fix:** Ensure `route_to` matches user role

### Issue: Integration status not updating

**Check:**
```sql
SELECT * FROM integration_connections WHERE user_id = 'YOUR_USER_ID';
```

**Fix:** Ensure tokens are being saved to `integration_connections` table

### Issue: RLS blocking legitimate queries

**Check:**
```sql
SELECT * FROM pg_policies WHERE tablename = 'tasks';
```

**Fix:** Add service role bypass or adjust policies

---

## 💡 Pro Tips

1. **Use service role key in backend**: Your Electron app should use the service role key to bypass RLS when needed.

2. **Cache user role**: Store `user_role` in local state to avoid repeated DB queries.

3. **Encrypt at rest**: Use Supabase's built-in encryption + your app-layer encryption for tokens.

4. **Monitor audit logs**: Set up alerts for suspicious activities.

5. **Gradual rollout**: Migrate users in batches, starting with internal team.

---

## 📚 Additional Resources

- [Supabase Row Level Security](https://supabase.com/docs/guides/auth/row-level-security)
- [Supabase OAuth Providers](https://supabase.com/docs/guides/auth/social-login)
- [PostgreSQL RLS Performance](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)

---

**Ready to go production? Let's do this! 🚀**

