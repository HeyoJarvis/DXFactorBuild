# Safe Merge to Main - Step-by-Step Guide

## 📋 Pre-Merge Checklist

### ✅ **1. Verify Current State**
```bash
# Ensure you're on Feature/GithubCopilot branch
git branch --show-current
# Should show: Feature/GithubCopilot

# Check working tree is clean (commit all changes first)
git status
```

### ✅ **2. Test All Functionality**

**For Developer User:**
- [ ] Start app: `npm run dev:desktop`
- [ ] JIRA auth works
- [ ] Tasks sync from JIRA (3 tasks visible)
- [ ] Chat buttons work (💬)
- [ ] JIRA links work
- [ ] Auto-sync works (wait 10 min or check logs)
- [ ] Manual sync button works

**For Sales User:**
- [ ] Change user role to 'sales' in database
- [ ] Restart app
- [ ] NO JIRA features visible
- [ ] Slack tasks still work
- [ ] Manual task creation works
- [ ] All filters work

### ✅ **3. Files to Commit**

**Core JIRA Integration:**
```bash
git add core/integrations/jira-service.js
git add core/integrations/jira-adapter.js
git add oauth/jira-oauth-handler.js
git add api/jira/sync.js
```

**Backend Changes:**
```bash
git add desktop/main.js
git add desktop/main/supabase-adapter.js
```

**Frontend Changes:**
```bash
git add desktop/renderer/unified.html
```

**Documentation:**
```bash
git add JIRA_TASK_SYNC_IMPLEMENTATION.md
git add JIRA_INTEGRATION_SUMMARY.md
git add JIRA_FIXES_SUMMARY.md
```

**DO NOT commit log files:**
```bash
# These should be in .gitignore
desktop/logs/*.log
logs/*.log
```

---

## 🔄 Merge Strategy

### **Option A: Direct Merge (Recommended if Feature/GithubCopilot is stable)**

```bash
# 1. Commit your JIRA changes
git add core/integrations/jira-service.js \
        desktop/main.js \
        desktop/main/supabase-adapter.js \
        desktop/renderer/unified.html \
        oauth/jira-oauth-handler.js \
        JIRA_TASK_SYNC_IMPLEMENTATION.md

git commit -m "feat: Add JIRA task synchronization for developers

- Implement JIRA OAuth 2.0 authentication
- Add auto-sync (10 min intervals) and manual sync
- Create task transformation layer (JIRA → internal schema)
- Add role-based UI (developer vs sales)
- Integrate JIRA tasks with chat feature
- Add comprehensive error handling and logging
- Maintain backward compatibility for sales users

Fixes: Data transformation order, user ID mismatch, missing DB columns
Closes: JIRA integration epic"

# 2. Push to Feature/GithubCopilot
git push origin Feature/GithubCopilot

# 3. Switch to main
git checkout main

# 4. Pull latest main
git pull origin main

# 5. Merge Feature/GithubCopilot into main
git merge Feature/GithubCopilot

# 6. Resolve any conflicts (if any)
# Check for conflicts in:
# - desktop/main.js (likely)
# - desktop/renderer/unified.html (likely)
# - package.json (possible)

# 7. Test thoroughly after merge
npm install  # In case package.json changed
npm run dev:desktop

# 8. Push to main
git push origin main
```

### **Option B: Pull Request (Recommended for team review)**

```bash
# 1. Commit your changes (same as Option A)
git add <files>
git commit -m "feat: Add JIRA task synchronization"

# 2. Push to Feature/GithubCopilot
git push origin Feature/GithubCopilot

# 3. Create Pull Request on GitHub
# - Go to repository on GitHub
# - Click "Pull Requests" → "New Pull Request"
# - Base: main
# - Compare: Feature/GithubCopilot
# - Add description from JIRA_TASK_SYNC_IMPLEMENTATION.md
# - Add reviewers
# - Request review

# 4. After approval, merge via GitHub UI
# - Use "Squash and merge" for clean history
# - Or "Create merge commit" to preserve all commits
```

---

## 🔍 Pre-Merge Conflict Resolution

### **Likely Conflicts:**

#### **1. desktop/main.js**
- **Conflict area**: IPC handlers section
- **Resolution**: Keep both sets of handlers (GitHub + JIRA)
- **Check**: Ensure no duplicate handler names

#### **2. desktop/renderer/unified.html**
- **Conflict area**: Task rendering section
- **Resolution**: Use the version with JIRA support
- **Check**: Ensure role-based UI code is present

#### **3. package.json**
- **Conflict area**: Dependencies
- **Resolution**: Merge dependencies, keep highest versions
- **Check**: Run `npm install` after merge

---

## ✅ Post-Merge Verification

### **1. Clean Install**
```bash
rm -rf node_modules package-lock.json
npm install
```

### **2. Start Application**
```bash
npm run dev:desktop
```

### **3. Test Matrix**

| Feature | Developer User | Sales User |
|---------|---------------|------------|
| JIRA Auth | ✅ Works | ❌ Not visible |
| JIRA Sync | ✅ Works | ❌ Not visible |
| JIRA Tasks Display | ✅ 3 tasks | ❌ No JIRA tasks |
| Chat Buttons | ✅ All tasks | ✅ Slack tasks only |
| Manual Task Creation | ❌ Disabled | ✅ Enabled |
| Slack Tasks | ✅ If any | ✅ Works |
| Task Filters | ✅ All work | ✅ All work |

### **4. Check Logs**
```bash
# No errors in console
# Check desktop/logs/jira-service.log
# Check desktop/logs/jira-oauth.log
```

### **5. Database Check**
```sql
-- Verify integration_settings column exists
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'users' 
AND column_name = 'integration_settings';

-- Check JIRA tokens are saved
SELECT id, name, user_role, 
       integration_settings->'jira' as jira_tokens
FROM users 
WHERE user_role = 'developer';

-- Check JIRA tasks exist
SELECT COUNT(*) as jira_task_count
FROM conversation_sessions
WHERE workflow_type = 'task'
AND workflow_metadata->>'externalSource' = 'jira';
```

---

## 🚨 Rollback Plan (If Something Breaks)

### **Option 1: Revert Merge**
```bash
# Find the merge commit
git log --oneline -10

# Revert the merge (replace SHA with actual commit)
git revert -m 1 <merge-commit-sha>

# Push revert
git push origin main
```

### **Option 2: Hard Reset (USE WITH CAUTION)**
```bash
# Reset main to commit before merge
git reset --hard HEAD~1

# Force push (only if no one else pulled)
git push --force origin main
```

### **Option 3: Create Hotfix Branch**
```bash
# Create branch from last good commit
git checkout -b hotfix/revert-jira main~1

# Push and deploy hotfix
git push origin hotfix/revert-jira
```

---

## 📝 Commit Message Template

```
feat: Add JIRA task synchronization for developers

## What Changed
- Implemented JIRA OAuth 2.0 authentication with token management
- Added automatic task synchronization (10-minute intervals)
- Created JIRA-to-internal task transformation layer
- Added role-based UI (developer features vs sales features)
- Integrated JIRA tasks with AI chat functionality
- Enhanced database schema with integration_settings column

## Why
- Developers need their JIRA issues visible in HeyJarvis
- Enables AI conversations about JIRA tasks
- Maintains single source of truth (JIRA for devs, Slack for sales)

## Impact
- ✅ Developers: See JIRA tasks with full chat integration
- ✅ Sales: No changes, Slack tasks work as before
- ✅ Backward compatible: No breaking changes

## Testing
- [x] JIRA OAuth flow
- [x] Task synchronization (manual + auto)
- [x] Task display with chat buttons
- [x] Role-based feature visibility
- [x] Backward compatibility for sales users

## Related Docs
- JIRA_TASK_SYNC_IMPLEMENTATION.md
- JIRA_INTEGRATION_SUMMARY.md
```

---

## 🎯 Success Criteria

- ✅ Merge completes without conflicts
- ✅ All tests pass
- ✅ No console errors
- ✅ Developer users see JIRA tasks
- ✅ Sales users see no changes
- ✅ Chat feature works for all tasks
- ✅ Auto-sync runs every 10 minutes
- ✅ No performance degradation

---

## 🆘 Need Help?

If merge conflicts occur:
1. Don't panic
2. Check conflict markers (`<<<<<<<`, `=======`, `>>>>>>>`)
3. Understand what each version does
4. Keep functionality from both branches
5. Test thoroughly after resolving
6. Ask for review if unsure

Good luck with the merge! 🚀

