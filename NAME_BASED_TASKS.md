# 📝 Name-Based Task Assignment System

HeyJarvis now uses **name-based task filtering** instead of Slack user IDs. This makes task assignment natural and intuitive!

---

## 🎯 How It Works

### User Sign-In
When you sign in with Slack, we extract your **real name** (e.g., "Avi", "Shail", "Alice") from your Slack profile.

### Task Creation from Slack Messages
When someone sends a message like:
- `"Avi can you build the dashboard?"`
- `"Shail, could you review this code?"`
- `"Alice please send the report"`

The system creates a task with the **name in the title**.

### Task Filtering

#### "Assigned to Me" View
Shows tasks where:
- ✅ **Your name is in the title**: `"Avi can you..."` (if you're Avi)
- ✅ **No name in title**: General tasks you created for yourself
- ❌ **Someone else's name**: `"Shail can you..."` (if you're Avi)

#### "Assigned by Me" View
Shows tasks where:
- ✅ **Someone else's name is in the title**: `"Shail can you..."` (if you're Avi)
- ❌ **Your name in title**: `"Avi can you..."` (if you're Avi)
- ❌ **No name in title**: General self-tasks

---

## 📋 Examples

### Scenario 1: You are **Avi**

**Slack Messages:**
1. `"Avi can you build the new dashboard feature?"`
2. `"Shail can you review the PR?"`
3. `"Need to update the docs"` (no name)

**"Assigned to Me" shows:**
- ✅ Task 1: `"Avi can you build the new dashboard feature?"`
- ✅ Task 3: `"Need to update the docs"`

**"Assigned by Me" shows:**
- ✅ Task 2: `"Shail can you review the PR?"`

---

### Scenario 2: You are **Shail**

**Same Slack Messages:**
1. `"Avi can you build the new dashboard feature?"`
2. `"Shail can you review the PR?"`
3. `"Need to update the docs"`

**"Assigned to Me" shows:**
- ✅ Task 2: `"Shail can you review the PR?"`
- ✅ Task 3: `"Need to update the docs"`

**"Assigned by Me" shows:**
- ✅ Task 1: `"Avi can you build the new dashboard feature?"`

---

## 🔍 Name Extraction Logic

The system uses regex to detect names in task titles:

```javascript
// Pattern: "Name can/could/please/would you..."
/^([A-Z][a-z]+),?\s+(can|could|please|would you|will you)/i
```

**Matches:**
- ✅ `"Avi can you..."`
- ✅ `"Shail, could you..."`
- ✅ `"Alice please..."`
- ✅ `"John would you..."`

**Doesn't Match:**
- ❌ `"Need to build..."` (no name)
- ❌ `"The team should..."` (not a person's name)
- ❌ `"URGENT: Fix bug"` (no delegation pattern)

---

## 💡 Benefits

### 1. **Natural Language**
- No need to use `@mentions` or user IDs
- Just type naturally: `"Avi can you..."`

### 2. **Works for Everyone**
- Even if someone isn't in the system yet
- Tasks are tracked based on names, not database IDs

### 3. **Simple & Intuitive**
- "Assigned to Me" = tasks with MY name
- "Assigned by Me" = tasks with OTHER people's names

### 4. **No Configuration**
- Names are automatically extracted during sign-in
- No manual setup required

---

## 🛠️ Technical Implementation

### Database Schema
User names are stored in the `users` table:
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY,
  email TEXT,
  name TEXT,  -- ✨ Used for task filtering
  slack_user_id TEXT,
  ...
);
```

### Filtering Logic
Located in `desktop/main/supabase-adapter.js`:

```javascript
// Extract name from task title
const nameMatch = task.title.match(/^([A-Z][a-z]+),?\s+(can|could|please|would you|will you)/i);
const mentionedName = nameMatch ? nameMatch[1] : null;

// For "Assigned to Me"
const isAssignedToMe = mentionedName && 
  mentionedName.toLowerCase() === userName.toLowerCase();
const isGeneralTask = !mentionedName;

// For "Assigned by Me"
const isDelegation = mentionedName && 
  mentionedName.toLowerCase() !== userName.toLowerCase();
```

---

## 🚀 Usage

### View Your Tasks
1. Open HeyJarvis
2. Click **"Assigned to Me"** tab
   - See tasks with your name or general tasks
3. Click **"Assigned by Me"** tab
   - See tasks you delegated to others

### Create Tasks from Slack
Just send a message in Slack:
```
Avi can you collaborate on building the new user dashboard feature?
```

HeyJarvis will:
1. ✅ Detect it as a work request
2. ✅ Extract "Avi" as the assignee
3. ✅ Create a task
4. ✅ Show it in the right view for each user

---

## 🎉 Result

**Simple, natural, and works perfectly!**

No more confusion about Slack IDs, user IDs, or complex filtering logic. Just use names like you normally would! 🚀
