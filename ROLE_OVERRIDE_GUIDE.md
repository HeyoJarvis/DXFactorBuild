# Role Override System - Testing Guide 🔧

## ✅ Implementation Complete!

You can now launch the HeyJarvis desktop app with **different roles** for testing, **without changing your Supabase database**!

---

## 🚀 Quick Start

### Launch with Different Roles

```bash
# Launch as Developer (JIRA, GitHub features)
npm run dev:desktop:developer

# Launch as Sales (Slack, CRM features)  
npm run dev:desktop:sales

# Launch as Admin (ALL features - both Developer + Sales)
npm run dev:desktop:admin

# Default (uses database role)
npm run dev:desktop
```

---

## 📋 What Each Role Gives You

### 🔧 Developer Role
- ✅ JIRA task synchronization
- ✅ GitHub integration button
- ✅ Code Indexer tab
- ✅ Engineering intelligence queries
- ❌ No manual task creation (tasks come from JIRA)

### 📊 Sales Role
- ✅ Slack task creation
- ✅ Manual task management
- ✅ CRM features
- ✅ Full task UI with chat
- ❌ No JIRA/GitHub features

### ⚡ Admin Role (Testing)
- ✅ **ALL Developer features**
- ✅ **ALL Sales features**
- ✅ JIRA + Slack tasks
- ✅ Complete feature set

---

## 🎯 How It Works

### The Magic

1. **Your Supabase role stays unchanged** (e.g., `'developer'`)
2. **Launch flag overrides at runtime** (e.g., `ROLE_OVERRIDE=sales`)
3. **App uses override instead of database**
4. **Close app = override disappears**

### Example Flow

```
Database:           user_role = 'developer'
Launch:             npm run dev:desktop:sales
Console Output:     🔧 DEVELOPMENT MODE: Role override active
                    👤 Launching as: sales
                    📌 Database role will NOT be modified
App Behavior:       Shows sales features (Slack tasks, etc.)
Close App:          Override gone, database unchanged
```

---

## 💻 Console Output

When override is active, you'll see:

```
🔧 DEVELOPMENT MODE: Role override active
👤 Launching as: sales
📌 Database role will NOT be modified
```

In the app's DevTools console:

```
🔧 DEVELOPMENT MODE: Role override active
👤 Database role: developer
🎭 Overridden to: sales
✅ Effective role: sales
```

---

## 🛠️ Alternative: Command Line Args

You can also use command line arguments:

```bash
# Windows (PowerShell)
$env:ROLE_OVERRIDE="developer"; npm run dev:desktop

# macOS/Linux
ROLE_OVERRIDE=developer npm run dev:desktop

# Or with electron directly
npm run dev:desktop -- --role=sales
```

---

## 🔒 Safety Features

✅ **Only works in development mode** (`NODE_ENV=development`)  
✅ **Clear console logs** when override is active  
✅ **Database never modified** - read-only override  
✅ **Production builds ignore** the flag completely  

---

## 📊 Setup Your Database (One-Time)

Set your base role in Supabase (recommended: `'developer'`):

```sql
-- Check current role
SELECT email, user_role FROM users WHERE email = 'your-email@example.com';

-- Set to developer (recommended for builders)
UPDATE users 
SET user_role = 'developer' 
WHERE email = 'your-email@example.com';
```

**That's it!** Leave it there, use launch flags to test other roles.

---

## 🧪 Testing Scenarios

### Test Developer Features
```bash
npm run dev:desktop:developer
```
- [ ] JIRA button visible
- [ ] JIRA tasks sync automatically
- [ ] GitHub button works
- [ ] Code Indexer tab appears
- [ ] No manual task creation

### Test Sales Features
```bash
npm run dev:desktop:sales
```
- [ ] Can create manual tasks
- [ ] Slack tasks appear
- [ ] Task chat works
- [ ] CRM features visible
- [ ] No JIRA/GitHub buttons

### Test Admin (Both)
```bash
npm run dev:desktop:admin
```
- [ ] JIRA tasks AND Slack tasks both visible
- [ ] All buttons available
- [ ] Can create manual tasks
- [ ] All features work together

---

## 🐛 Troubleshooting

**Q: Override not working?**
```bash
# Check if you're in development mode
echo $NODE_ENV

# Should be 'development'
# If not, add to your .env:
NODE_ENV=development
```

**Q: Still seeing wrong role?**
- Close the app completely
- Clear cache: `rm -rf desktop/node_modules/.cache`
- Relaunch with role flag

**Q: Want to see current effective role?**
```javascript
// In DevTools console:
window.electronAPI.auth.getUser().then(u => console.log('Role:', u.effectiveRole))
```

---

## 📝 Code Changes Made

### 1. `desktop/main.js`
- Added role override detection at top
- Created `getEffectiveRole(user)` helper function
- Updated JIRA sync checks to use effective role
- Updated `auth:get-user` IPC to pass role override

### 2. `desktop/renderer/unified.html`  
- Updated `initializeRoleBasedUI()` to use effective role
- Added console logs for override status
- Support for 'admin' role (shows both dev + sales features)

### 3. `package.json`
- Added `dev:desktop:developer` script
- Added `dev:desktop:sales` script
- Added `dev:desktop:admin` script

---

## 🎉 Benefits

✅ **Fast role switching** - No database edits needed  
✅ **Safe testing** - Can't accidentally mess up DB  
✅ **Clear visibility** - Console logs show what's happening  
✅ **Production safe** - Ignored in production builds  
✅ **Multiple instances** - Can run different roles in parallel  

---

## 🚀 Ready to Use!

Just run:
```bash
npm run dev:desktop:admin
```

And test ALL features at once! 🎊

