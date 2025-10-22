# Teams Feature - Quick Start Guide

## 🚀 Get Started in 5 Minutes

### Step 1: Run Database Migration (One-Time)

Open Supabase SQL Editor and run:

```sql
-- Copy and paste entire contents of:
-- /home/sdalal/test/BeachBaby/extra_feature_desktop/migrations/004_teams_feature.sql
```

Or navigate to your Supabase project → SQL Editor → New Query → Paste the migration file.

### Step 2: Restart the App

```bash
cd /home/sdalal/test/BeachBaby/extra_feature_desktop
npm run dev
```

### Step 3: Navigate to Teams

Click **👥 Teams** in the sidebar

### Step 4: Create Your First Team

1. Click **➕ Create Team**
2. Fill in:
   - **Name:** "Frontend Team"
   - **Description:** "Building user interfaces"
   - **Timezone:** Select your timezone
   - **Color:** Pick any color you like
3. Click **Create Team**

### Step 5: Assign Data

1. Click on your newly created team
2. Click **📎 Assign Data** button
3. In the modal:
   
   **Meetings Tab:**
   - ✅ Check the meetings this team attended
   - Click **Assign X to [Team Name]**
   
   **Tasks Tab:**
   - ✅ Check relevant JIRA issues or GitHub PRs
   - Click **Assign X to [Team Name]**
   
   **Repositories Tab:**
   - 📍 Click on a repository this team works on
   - Click **Assign to [Team Name]**

4. Close the modal

### Step 6: Ask Questions!

Type in the chat box:
- "What were the key decisions from recent meetings?"
- "What tasks are in progress?"
- "What features are being worked on?"

Press Enter and see the magic! ✨

## 📋 Example: Setting Up 3 Teams

### Team 1: Frontend Team
```
Name: Frontend Team
Description: React and UI development
Timezone: America/New_York (Eastern Time)
Color: Blue (#3B82F6)

Assign:
- Meetings with "UI" or "Frontend" in title
- JIRA tickets labeled "frontend"
- Repository: company/frontend-app
```

### Team 2: Backend Team
```
Name: Backend Team  
Description: API and database work
Timezone: Europe/London (UK Time)
Color: Green (#10B981)

Assign:
- Meetings with "API" or "Backend" in title
- JIRA tickets labeled "backend"
- Repository: company/api-server
```

### Team 3: Mobile Team
```
Name: Mobile Team
Description: iOS and Android apps
Timezone: Asia/Tokyo (Japan Time)
Color: Purple (#8B5CF6)

Assign:
- Meetings with "Mobile" or "App" in title
- JIRA tickets labeled "mobile"
- Repository: company/mobile-app
```

## 🎯 What You Get

### Team Cards Show:
- 🟢/🟡/⚪ Working hours status
- 🌍 Current time in their timezone
- 📊 Count of meetings, tasks, and repos

### Team Context Chat Shows:
- 📅 Meetings assigned to team
- 📋 Tasks (JIRA/GitHub) assigned to team
- 💻 Repositories assigned to team

### Questions Are Answered Using:
- ✅ Only that team's meetings
- ✅ Only that team's tasks
- ✅ Only code from that team's repositories
- ✅ No data leakage from other teams

## 💡 Tips

### Timezone Indicators

- **🟢 Green dot** = Team is working now (9am-5pm their time)
- **🟡 Yellow dot** = Extended hours (early morning/evening)
- **⚪ Gray dot** = Offline (night time)

### Best Practices

1. **Create teams by function**
   - Frontend, Backend, Mobile, DevOps, etc.

2. **Assign data carefully**
   - Only assign what's truly relevant
   - You can always reassign later

3. **Use descriptive names**
   - Good: "US East Coast Frontend Team"
   - Bad: "Team 1"

4. **Pick distinct colors**
   - Makes teams easy to identify at a glance

5. **Set correct timezones**
   - Working hours indicators depend on this
   - Choose the team's primary location

### Common Questions to Ask

**About Meetings:**
- "What decisions were made in recent meetings?"
- "What action items came out of meetings?"
- "Who attended the most meetings?"

**About Tasks:**
- "What tasks are currently in progress?"
- "What's blocking us right now?"
- "What was completed recently?"

**About Code:**
- "How does authentication work?"
- "Where is the payment processing code?"
- "What APIs are exposed?"

**Mixed Context:**
- "How does the implementation match what was discussed in meetings?"
- "Are the current tasks aligned with meeting decisions?"

## 🔧 Troubleshooting

### "No teams found"
→ You haven't created any teams yet. Click "➕ Create Team"

### "No unassigned meetings/tasks"
→ All data is already assigned. You can reassign by editing teams.

### "Questions returning no context"
→ Make sure you've assigned data to the team (meetings, tasks, or repos)

### "Working hours showing wrong status"
→ Verify the team's timezone is set correctly

### "Can't see Teams page"
→ Make sure you restarted the app after updating code

## 🎉 You're All Set!

You now have a fully functional Teams system with:
- ✅ Timezone-aware team management
- ✅ Context isolation for security
- ✅ Team-specific Q&A
- ✅ Beautiful, intuitive UI

Start creating teams and organizing your data! 🚀

---

**Need more help?** Check `TEAMS_FEATURE_COMPLETE.md` for full documentation.

