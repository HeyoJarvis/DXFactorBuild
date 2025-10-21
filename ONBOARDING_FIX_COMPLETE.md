# 🔧 Onboarding Flow Fixes - Complete

## Issues Fixed

### 1. **Role Selection Being Skipped** ❌ → ✅
**Problem**: New users were automatically assigned a role based on their email, so the role selection page was being skipped.

**Root Cause**: 
- Line 1132 in `AuthService.js` called `this.determineUserRole(userData.email)` which auto-assigned either 'sales' or 'developer' based on email keywords
- Users with a `user_role` would skip directly to integration setup

**Fix**:
```javascript
// BEFORE
newUser.user_role = this.determineUserRole(userData.email);

// AFTER
newUser.user_role = null, // Don't auto-assign role - let user choose
```

Now new users start with `user_role: null` and must explicitly choose their role.

---

### 2. **Missing Onboarding Fields for Existing Users** ❌ → ✅
**Problem**: Existing users (legacy) didn't have `onboarding_completed` or `onboarding_step` fields, causing database errors.

**Root Cause**: 
- The `handleDirectAuth` method only set these fields for new users
- Existing users were updated but these fields were ignored

**Fix**:
```javascript
// Ensure onboarding fields exist (for legacy users)
if (user.onboarding_completed === null || user.onboarding_completed === undefined) {
  updateData.onboarding_completed = false;
}
if (!user.onboarding_step) {
  updateData.onboarding_step = user.user_role ? 'integration_setup' : 'role_selection';
}
```

Now existing users get proper onboarding fields when they log in:
- If they have a role → skip to integration setup
- If they don't have a role → start at role selection

---

## How Onboarding Works Now

### New User Flow:
```
1. Login (Slack/Microsoft/Google)
   ↓
2. User created with:
   - onboarding_completed: false
   - onboarding_step: 'role_selection'
   - user_role: null
   ↓
3. RoleSelection page shown
   ↓
4. User selects role (sales/developer)
   ↓
5. onboarding_step: 'integration_setup'
   ↓
6. IntegrationSetup page shown
   ↓
7. User selects tools (no connection yet)
   ↓
8. onboarding_completed: true
   ↓
9. Mission Control
```

### Existing User Flow (with role):
```
1. Login
   ↓
2. Already has user_role
   ↓
3. onboarding_step: 'integration_setup' (if not completed)
   ↓
4. IntegrationSetup page OR skip to Mission Control
```

### Existing User Flow (without role):
```
1. Login
   ↓
2. No user_role
   ↓
3. onboarding_step: 'role_selection'
   ↓
4. Must choose role → Integration setup → Mission Control
```

---

## Database Schema Requirements

Ensure your `users` table has these columns:
```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarding_step TEXT DEFAULT 'role_selection';
ALTER TABLE users ADD COLUMN IF NOT EXISTS user_role TEXT; -- 'sales' or 'developer'
ALTER TABLE users ADD COLUMN IF NOT EXISTS integration_settings JSONB DEFAULT '{}'::jsonb;
```

---

## Testing Checklist

### Test New User:
- [ ] Log in with a new account (Slack/Microsoft/Google)
- [ ] Verify RoleSelection page appears
- [ ] Select a role (Sales or Developer)
- [ ] Verify IntegrationSetup page appears
- [ ] Select some tools
- [ ] Click "Continue with X tools"
- [ ] Verify Mission Control loads

### Test Existing User (with role):
- [ ] Log in with existing account that has a role
- [ ] Verify onboarding is skipped OR goes to integration setup only
- [ ] Complete onboarding
- [ ] Verify Mission Control loads

### Test Existing User (without role):
- [ ] Log in with existing account that has NO role
- [ ] Verify RoleSelection page appears
- [ ] Complete onboarding flow
- [ ] Verify Mission Control loads

---

## Files Changed

### Modified:
- `desktop2/main/services/AuthService.js`
  - Line 1056-1062: Added onboarding field initialization for existing users
  - Line 1111: Removed auto role assignment, set to `null` instead

---

**Status**: ✅ Complete and ready for testing
**Next Step**: Restart Electron app and test with a fresh login

