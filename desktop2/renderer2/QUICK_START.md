# Sales Tasks - Quick Start Guide

## 🚀 Getting Started

### 1. Start the Application
```bash
cd desktop2/renderer2
npm install  # if not already done
npm run dev
```

### 2. Navigate to Tasks
Open the app and click on the **Tasks** tab in the navigation.

## 🎨 Using Action Items View

### View the Design
The default view shows "Action Items" with:
- 🎯 App icons on the left
- Task titles
- 🌈 Gradient progress bars
- 📊 Percentage indicators
- 🏷️ Priority badges
- ✅ Checkboxes on the right

### Create a Task (Simple)
1. Type your task in the input field
2. Select priority: Low / Medium / High / Urgent
3. Press **Enter** or click **+ Add Task**

### Create a Task (Advanced)
1. Click the **⚙️** button to show advanced options
2. Drag the **Progress** slider to set percentage (e.g., 83%)
3. Choose **Source** from dropdown:
   - 💬 Slack
   - 🎯 Teams
   - 📧 Email
   - 📋 JIRA
   - 💼 CRM
   - ✏️ Manual
4. Type your task and press **Enter**

### Example: Recreate the Design
To create tasks that match the design image:

**Task 1:**
```
Title: Reach out to 12,000 people via Email
Priority: High
Progress: 83%
Source: Slack
```

**Task 2:**
```
Title: Schedule follow up
Priority: High
Progress: 83%
Source: Teams
```

**Task 3:**
```
Title: Communicate progress on XYZ Features to Client
Priority: High
Progress: 83%
Source: Teams
```

## 🎯 Task Management

### Toggle Task Status
Click the checkbox to cycle through:
- ○ Todo
- ⟳ In Progress (with spinning animation)
- ✓ Completed (green checkmark)

### Edit Task Title
Double-click on any task title to edit inline.

### Delete Task
1. Hover over a task card
2. Click the **🗑️** button that appears

### AI Chat
1. Hover over a task card
2. Click the **💬** button for AI assistance

## 🔄 Switch Views

Use the toggle buttons in the header:
- **📊 Action Items** - Modern card view with progress bars
- **📋 List View** - Compact traditional list

## 🎨 Understanding Visual Elements

### App Icons
Each icon represents where the task came from:
- 💬 = Slack message
- 🎯 = Teams chat
- 📧 = Email
- 📋 = JIRA issue
- ✏️ = Manually created
- 💼 = CRM system

The icon background gradient matches the source's brand colors.

### Progress Bar Colors
The gradient represents progress from start to finish:
- 🟥 Red (0-25%) - Just starting
- 🟧 Orange (25-50%) - Making progress
- 🟨 Yellow (50-75%) - More than halfway
- 🟩 Green (75-90%) - Almost done
- 🟦 Blue (90-100%) - Nearly complete

### Priority Badges
- **Urgent** 🔴 - Red border, needs immediate attention
- **High** 🟠 - Orange border, important
- **Medium** 🔵 - Blue border, normal priority
- **Low** ⚪ - Gray border, can wait

## 💡 Pro Tips

### Keyboard Shortcuts
- **Enter** - Add task from input field
- **Escape** - Cancel inline editing
- **Enter** (while editing) - Save changes

### Visual Cues
- **Shimmer effect** - Progress bars have a moving shine
- **Hover glow** - Cards lift and glow on hover
- **Smooth animations** - All interactions are animated

### Quick Actions
- **Hover reveal** - Action buttons appear on hover to keep UI clean
- **Double-click edit** - Fast way to modify task titles
- **One-click toggle** - Quick status updates

## 🎯 Sales Workflow Example

### Morning Routine
1. Review **Urgent** and **High** priority tasks
2. Check progress bars to see what's close to completion
3. Toggle completed items ✓

### During Calls
1. Quick-add tasks from customer conversations
2. Update progress in real-time
3. Set priorities based on urgency

### End of Day
1. Review all tasks in Action Items view
2. Update progress percentages
3. Plan tomorrow's priorities

## 🎨 Customization

### Change Default View
In `Tasks.jsx`, line 21:
```javascript
const [viewMode, setViewMode] = useState('action'); // or 'list'
```

### Adjust Progress Colors
In `ActionItem.css`, modify the gradient:
```css
background: linear-gradient(90deg, 
  #FF6B6B 0%,    /* Red */
  #FF8E53 25%,   /* Orange */
  #FFD93D 50%,   /* Yellow */
  #6BCB77 75%,   /* Green */
  #4D96FF 100%   /* Blue */
);
```

### Add Custom Sources
1. Edit `ActionItem.jsx` - add icon to `getAppIcon()`
2. Add gradient to `getIconBackground()`
3. Edit `TaskInput.jsx` - add option to source select

## 📱 Mobile Responsive

The design adapts to screen size:
- **Desktop** - Full-width cards with all details
- **Tablet** - Adjusted spacing
- **Mobile** - Stacked elements, full-width buttons

## ❓ Troubleshooting

### Tasks not showing?
- Check if you're logged in
- Verify database connection
- Check console for errors

### Progress bar not visible?
- Ensure task has `progress` property
- Check if status is `in_progress`
- Verify CSS is loading

### Icons not appearing?
- Check task has `source` field
- Verify emoji support in browser/system
- Check console for errors

## 🌟 What's Next?

Try these features:
1. Create tasks from Slack messages (auto-detection)
2. Sync JIRA issues as tasks
3. Use AI chat to break down large tasks
4. Track progress across multiple channels

## 📚 More Information

- **Full Documentation**: See `SALES_TASKS_DESIGN.md`
- **Implementation Details**: See `IMPLEMENTATION_SUMMARY.md`
- **Component Structure**: Check the files in `src/components/Tasks/`

---

**Enjoy your new Action Items view!** 🎉

