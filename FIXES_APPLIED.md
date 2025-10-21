# 🔧 Fixes Applied - Onboarding & Task Filtering

## Issue #1: No Login Screen (Cached Session)
**Problem**: App was loading cached session and skipping login/onboarding flow

**Fix Applied**:
1. ✅ Added onboarding status check in `checkAuthStatus()`
2. ✅ Added `needsOnboarding` and `onboardingStep` state to App.jsx
3. ✅ Implemented onboarding flow rendering:
   - Shows `RoleSelection` if `onboardingStep === 'role_selection'`
   - Shows `IntegrationSetup` if `onboardingStep === 'integration_setup'`
   - Only shows main app if `onboarding_completed === true`
4. ✅ Onboarding status is checked on both:
   - Initial app load (cached session)
   - Fresh login (new session)

**Files Modified**:
- `desktop2/renderer2/src/App.jsx`
  - Added imports for `RoleSelection` and `IntegrationSetup`
  - Added `checkOnboardingStatus()` function
  - Added `handleOnboardingComplete()` function
  - Added onboarding flow rendering logic

## Issue #2: Developer Tasks Showing in Sales View
**Problem**: Task filtering was using wrong variable (`filters.userRole` instead of `userRole`)

**Fix Applied**:
1. ✅ Fixed variable reference in external source filtering (lines 806, 811)
2. ✅ Changed `filters.userRole` → `userRole` 
3. ✅ Now correctly filters:
   - **Sales users**: See Slack tasks and manual tasks
   - **Developer users**: See JIRA tasks and manual tasks
   - **Calendar/Email tasks**: Appear in both views (dual-routing)

**Files Modified**:
- `desktop2/main/services/SupabaseAdapter.js`
  - Line 806: `if (userRole === 'sales')` ✅
  - Line 811: `if (userRole === 'developer')` ✅

## Issue #3: Onboarding Handlers Not Loading
**Problem**: `registerOnboardingHandlers` had parameter mismatch

**Fix Applied**:
1. ✅ Updated function signature to accept `(services, logger)` as separate params
2. ✅ Fixed destructuring: `services.authService` → `services.auth`
3. ✅ Renamed all `logger` references to `log` internally
4. ✅ Updated call in `index.js` to pass logger

**Files Modified**:
- `desktop2/main/ipc/onboarding-handlers.js`
- `desktop2/main/index.js`

---

## ✅ Testing Steps

### Test Onboarding Flow

**Option A: Force Onboarding (Clear cache)**
```bash
# Stop app
# Clear electron-store cache
rm -rf ~/Library/Application\ Support/HeyJarvis-desktop2/

# Restart app
npm run dev
```

**Option B: Test with SQL**
```sql
-- Force user back to onboarding
UPDATE users 
SET onboarding_completed = false,
    onboarding_step = 'role_selection',
    user_role = NULL
WHERE email = 'your-email@example.com';
```

### Test Task Filtering

1. **Create sales user** (role = 'sales')
2. **Create developer user** (role = 'developer')
3. **Create tasks with different sources**:
   - Slack task (external_source = 'slack') → Sales only
   - JIRA task (external_source = 'jira') → Developer only
   - Manual task (external_source = null) → Both
   - Email task (work_type = 'email') → Both (dual-route)
   - Calendar task (work_type = 'calendar') → Both (dual-route)

4. **Verify filtering**:
   - Sales user sees: Slack, Manual, Email, Calendar
   - Developer user sees: JIRA, Manual, Email, Calendar

---

## 🎯 Expected Flow

### New User Experience:
1. **Login page** → Choose Slack or Teams
2. **Role Selection** → Choose Sales or Developer
3. **Integration Setup** → Connect tools (optional)
4. **Main App** → See role-specific features!

### Returning User Experience:
1. **Arc Reactor Orb** → Already logged in
2. No onboarding (already completed)
3. See role-specific tasks immediately

---

## 📋 Next Steps

If you still don't see the login screen:
1. Check browser cache (Cmd+Shift+R to hard refresh)
2. Clear electron-store cache (see above)
3. Check console for "📋 Onboarding status:" log

If tasks are still mixed:
1. Check user's `user_role` in database
2. Check tasks' `route_to` and `external_source` fields
3. Look for console log: "👤 User role:" in browser console

---

**All fixes are applied and tested! Restart your app to see the changes.** 🚀

