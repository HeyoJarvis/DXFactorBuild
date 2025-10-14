# Sales Tasks - Action Items Design

## 🎨 Design Overview

The new Sales Tasks page features a modern, elegant design inspired by Apple's design language, with a focus on action items that provide clear visual progress indicators.

## ✨ Key Features

### 1. **Action Items View**
- **Progress Bars**: Beautiful gradient progress bars (red → orange → yellow → green → blue)
- **App Icons**: Color-coded icons based on task source (Slack, Teams, Email, JIRA, etc.)
- **Priority Badges**: Clean, color-coded priority indicators
- **Notification Badges**: Shows related item counts (+2, etc.)
- **Completion Checkboxes**: Smooth animations with checkmark icons

### 2. **Modern UI Elements**

#### Progress Indicators
```
🟥🟧🟨🟩 83%
```
- Animated gradient fills from left to right
- Percentage display in tabular nums
- Shimmer effect animation for visual polish

#### Source Icons with Gradients
- 💬 **Slack**: Purple/pink gradient
- 🎯 **Teams**: Indigo gradient  
- 📧 **Email**: Blue gradient
- 📋 **JIRA**: Blue/cyan gradient
- ✏️ **Manual**: Purple gradient
- 💼 **CRM**: Orange gradient

#### Priority Badges
- 🔴 **Urgent**: Red with border
- 🟠 **High**: Orange with border
- 🔵 **Medium**: Blue with border
- ⚪ **Low**: White/gray with border

### 3. **View Modes**

The page supports two view modes:

1. **Action Items View** (Default)
   - Large cards with progress bars
   - Prominent source icons
   - Visual progress tracking
   - Perfect for sales workflows

2. **List View**
   - Compact task list
   - Traditional task management
   - Quick scanning

Toggle between views using the buttons in the header.

### 4. **Advanced Task Creation**

Click the ⚙️ button to reveal advanced options:

- **Progress Slider**: Set initial progress (0-100%)
- **Source Selection**: Choose task origin
  - Manual
  - Slack
  - Teams
  - Email
  - JIRA
  - CRM

### 5. **Responsive Design**

- Desktop: Full-width cards with all features
- Tablet: Adjusted spacing and layout
- Mobile: Stacked elements, full-width buttons

## 🎯 Design Principles

### Apple-Inspired Aesthetics
- **Glassmorphism**: Frosted glass effects with backdrop blur
- **Smooth Animations**: Cubic-bezier easing for natural motion
- **Subtle Shadows**: Layered depth without heaviness
- **System Fonts**: SF Pro Display for crisp typography
- **Rounded Corners**: 12px radius for modern feel

### Color System
- **Primary**: Blue (#0A84FF)
- **Success**: Green (#34C759)
- **Warning**: Orange (#FF9500)
- **Error**: Red (#FF3B30)
- **Surface**: White with 5-8% opacity
- **Border**: White with 10-15% opacity

### Typography
- **Headers**: 28px, weight 700, -2% letter-spacing
- **Task Titles**: 16px, weight 600, -1% letter-spacing
- **Badges**: 13px, weight 600, uppercase
- **Meta**: 12-14px, weight 500-600

### Spacing
- **Cards**: 20px padding, 16px gap
- **Icons**: 48px square with 12px radius
- **Progress**: 8px height with 10px radius
- **Badges**: 8px padding, 8px radius

## 📁 File Structure

```
desktop2/renderer2/src/
├── pages/
│   ├── Tasks.jsx              # Main page with view toggle
│   └── Tasks.css              # Page-level styles
└── components/Tasks/
    ├── ActionItem.jsx         # Individual action card
    ├── ActionItem.css         # Card styling
    ├── ActionList.jsx         # Action items container
    ├── ActionList.css         # Container styling
    ├── TaskList.jsx           # Original list view
    ├── TaskItem.jsx           # Original task item
    ├── TaskInput.jsx          # Enhanced input with advanced options
    └── TaskInput.css          # Input styling
```

## 🚀 Usage

### Creating Tasks

1. **Basic Task**:
   - Type task title
   - Select priority (Low/Medium/High/Urgent)
   - Press Enter or click "Add Task"

2. **Advanced Task**:
   - Click ⚙️ to show advanced options
   - Set progress percentage with slider
   - Choose source (for demo/testing)
   - Add task

### Managing Tasks

- **Toggle Status**: Click checkbox (○ → ⟳ → ✓)
- **Edit Title**: Double-click task title
- **Delete**: Hover and click 🗑️ button
- **AI Chat**: Hover and click 💬 button

### Viewing Tasks

- Switch views with 📊 **Action Items** / 📋 **List View** buttons
- Action Items view shows progress and source
- List view provides compact overview

## 🎨 Customization

### Adjusting Progress Colors

Edit `ActionItem.css` line 63-68:

```css
.action-progress-fill {
  background: linear-gradient(90deg, 
    #FF6B6B 0%,    /* Red */
    #FF8E53 25%,   /* Orange */
    #FFD93D 50%,   /* Yellow */
    #6BCB77 75%,   /* Green */
    #4D96FF 100%   /* Blue */
  );
}
```

### Adding New Sources

Edit `ActionItem.jsx`:

1. Add icon to `getAppIcon()`:
```javascript
'newsource': '🎪',
```

2. Add gradient to `getIconBackground()`:
```javascript
'newsource': 'linear-gradient(135deg, rgba(R, G, B, 0.5), rgba(R, G, B, 0.5))',
```

3. Add to `TaskInput.jsx` source select:
```javascript
<option value="newsource">🎪 New Source</option>
```

## 🎯 Sales-Focused Features

### Progress Tracking
- Visual representation of deal progress
- Color-coded for quick scanning
- Percentage display for precision

### Source Attribution
- Know where each task originated
- Filter by source (future feature)
- Track multi-channel workflows

### Priority Management
- Urgent tasks stand out with red borders
- High-priority items are easy to spot
- Balance workload across priorities

### Team Collaboration
- Assignor/assignee tracking (existing)
- Notification counts for related items
- AI chat for task assistance

## 🌟 Future Enhancements

- [ ] Drag-and-drop reordering
- [ ] Bulk actions (complete multiple, change priority)
- [ ] Filter by source/priority/status
- [ ] Custom progress colors per task
- [ ] Time tracking integration
- [ ] Due date indicators
- [ ] Task dependencies
- [ ] Kanban board view
- [ ] Calendar integration
- [ ] Export to CSV/Excel

## 📝 Notes

- Progress is calculated automatically for todo/in_progress/completed
- Manual progress setting available via advanced options
- Source icons have unique gradients for visual distinction
- All animations use GPU-accelerated properties (transform, opacity)
- Design scales from mobile to desktop seamlessly
- Dark mode optimized with appropriate contrast ratios

---

**Design System**: Apple-inspired modern UI  
**Framework**: React + CSS3  
**Animations**: Cubic-bezier easing + CSS animations  
**Typography**: SF Pro Display system font  
**Color Mode**: Dark theme optimized  

