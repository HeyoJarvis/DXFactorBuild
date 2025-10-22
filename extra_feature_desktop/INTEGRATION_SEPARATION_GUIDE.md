# Integration Separation Guide

## Problem

The Team Sync Intelligence app (`extra_feature_desktop`) is trying to use `desktop2` services, but they expect:
- A `users` table with `integration_settings` column
- OAuth tokens stored in a specific format
- This causes conflicts and could break `desktop2`

## Solution: Complete Separation

`extra_feature_desktop` and `desktop2` will be **completely independent** apps:

### Database Tables

**desktop2 uses:**
- `users` table with `integration_settings` JSONB column
- Stores Microsoft, JIRA, GitHub OAuth tokens there

**extra_feature_desktop will use:**
- `auth.users` (Supabase built-in) for authentication
- NEW `team_sync_integrations` table for OAuth tokens
- NEW `team_meetings`, `team_updates`, `team_context_index` tables (already created)

### Services

**desktop2 services** (UNCHANGED):
- `desktop2/main/services/MicrosoftService.js` → Uses `users.integration_settings`
- `desktop2/main/services/JIRAService.js` → Uses `users.integration_settings`

**extra_feature_desktop services** (NEW):
- `extra_feature_desktop/main/services/StandaloneMicrosoftService.js` → Uses `team_sync_integrations`
- `extra_feature_desktop/main/services/StandaloneJIRAService.js` → Uses `team_sync_integrations`
- These are simplified wrappers that DON'T interfere with desktop2

## Implementation

### 1. New Database Table

```sql
-- Add to migrations/001_team_sync_tables.sql
CREATE TABLE IF NOT EXISTS team_sync_integrations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  service_name TEXT NOT NULL, -- 'microsoft', 'jira', 'github'
  access_token TEXT,
  refresh_token TEXT,
  token_expiry TIMESTAMPTZ,
  cloud_id TEXT, -- For JIRA
  site_url TEXT, -- For JIRA
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, service_name)
);

CREATE INDEX idx_team_sync_integrations_user_service 
  ON team_sync_integrations(user_id, service_name);
```

### 2. Simplified Service Wrappers

Instead of reusing `desktop2` services, create lightweight wrappers:

**StandaloneMicrosoftService.js**:
- Reads tokens from `team_sync_integrations` table
- Uses core `MicrosoftGraphService` directly
- Stores refreshed tokens back to `team_sync_integrations`
- NO dependency on `desktop2/main/services/MicrosoftService.js`

**StandaloneJIRAService.js**:
- Reads tokens from `team_sync_integrations` table
- Uses core `JIRAService` directly
- NO dependency on `desktop2/main/services/JIRAService.js`

### 3. OAuth Flow

For now, integrations can be connected via:
- **Manual token entry** (for quick testing)
- **OAuth redirect flow** (proper solution, implemented separately)
- **Import from desktop2** (optional convenience feature)

## Benefits

✅ `desktop2` continues to work exactly as before  
✅ No risk of breaking existing functionality  
✅ `extra_feature_desktop` is fully independent  
✅ Users can run both apps simultaneously without conflicts  
✅ Each app has its own OAuth sessions  

## Migration Path

**Phase 1 (Now)**: 
- Create `team_sync_integrations` table
- Build standalone service wrappers
- Add "Not Connected" messaging in UI
- Users see the app but can't connect yet

**Phase 2** (Next):
- Implement OAuth flows with popup windows
- Microsoft OAuth → Store in `team_sync_integrations`
- JIRA OAuth → Store in `team_sync_integrations`
- Users can now connect and use features

**Phase 3** (Future):
- Add "Import from Desktop2" button
- Reads `users.integration_settings` from desktop2
- Copies tokens to `team_sync_integrations`
- Convenience feature for existing desktop2 users

## Current State

Right now, the app works for:
- ✅ **Authentication**: Login/signup with email
- ✅ **Database**: Tables created in Supabase
- ✅ **UI**: All pages render correctly
- ❌ **Integrations**: Can't connect yet (needs Phase 2)

The app is **functional but limited** until OAuth is implemented.

## Recommendation

For now:
1. Keep the app as-is (authentication works)
2. Show "Connect Microsoft" / "Connect JIRA" buttons
3. When clicked, show: "OAuth integration coming soon! For now, use Desktop2 for full integration features."
4. Focus on getting the core Q&A and dashboard working with mock data
5. Implement OAuth in Phase 2

This way:
- `desktop2` is completely safe
- `extra_feature_desktop` doesn't break anything
- Users can test the UI and concepts
- Full integration comes later


