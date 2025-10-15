# JIRA Card Redesign - Wireframe Implementation

## Overview
Completely redesigned the developer tasks cards to match the provided wireframe with JIRA logo, clean labels, and blue progress bar.

## Design Changes

### Before (Old Design)
- Slack icon
- Complex header with ID, priority, and edit button
- Title and description as separate elements
- GitHub info in separate section
- Multicolor gradient progress bar (red→orange→green)

### After (New Design - Matching Wireframe)
- **JIRA logo** (from `/JIRALOGO.png`)
- **Two label boxes** at top:
  - "SPRINT + TICKET #{id}" - white background with black border
  - Status (e.g., "Feature") - black background with white text
- **Large "Description" text** - 48px, prominent
- **Blue progress bar**:
  - Empty: white background with blue border
  - Fill: solid blue (#007aff)
  - Height: 24px (larger than before)
  - Percentage shown on right (20px, bold)

## Card Specifications

### Layout
```
┌─────────────────────────────────────────┐
│  [JIRA]  [SPRINT + TICKET #]  [Feature] │
│          ┌─────────────────────────────┐ │
│          │                             │ │
│          │      Description            │ │
│          │                             │ │
│          └─────────────────────────────┘ │
│          ▓▓▓▓▓▓▓▓░░░░░░░░░░░░░░  55%   │ │
└─────────────────────────────────────────┘
```

### Dimensions
- **Card Border**: 3px solid black
- **Border Radius**: 16px
- **Padding**: 32px
- **Min Height**: 280px
- **Gap between icon and content**: 24px

### JIRA Icon
- **Size**: 56×56px
- **Background**: White
- **Border Radius**: 8px
- **Padding**: 8px
- **Image**: `/JIRALOGO.png` (from HeyJarvis main folder)

### Label Boxes
- **Padding**: 8px 16px
- **Border**: 2px solid black
- **Border Radius**: 4px
- **Font**: 13px, font-weight 600, uppercase
- **First Label**: White background, black text
- **Second Label**: Black background, white text

### Description
- **Font Size**: 48px
- **Font Weight**: 400 (regular)
- **Color**: #1d1d1f (black)
- **Letter Spacing**: -0.02em
- **Line Height**: 1.2

### Progress Bar
- **Container**:
  - Height: 24px
  - Background: white
  - Border: 2px solid #007aff (blue)
  - Border Radius: 4px
- **Fill**:
  - Background: #007aff (solid blue)
  - Border Radius: 2px inner
  - Width: dynamic based on percentage
- **Percentage Text**:
  - Font Size: 20px
  - Font Weight: 700 (bold)
  - Color: #1d1d1f
  - Min Width: 60px
  - Text Align: right

## Removed Elements

### Eliminated from Previous Design
1. ❌ Slack icon
2. ❌ Priority badge (High/Medium/Low)
3. ❌ "Edit in JIRA" button
4. ❌ Detailed task title
5. ❌ Full task description paragraph
6. ❌ GitHub repository info inline
7. ❌ GitHub branch info inline
8. ❌ Multicolor gradient progress bar
9. ❌ Right sidebar with GitHub context

## CSS Key Changes

### Progress Bar
```css
/* Old - Gradient */
.progress-bar {
  height: 8px;
  background: #e5e5e5;
}
.progress-fill {
  background: linear-gradient(90deg, #FF3B30, #FF9F0A, #34C759);
}

/* New - Blue Border */
.progress-bar-empty {
  height: 24px;
  background: white;
  border: 2px solid #007aff;
}
.progress-fill-blue {
  background: #007aff;
}
```

### Card Enhancement
```css
.action-item-card {
  border: 3px solid #1d1d1f;  /* Thicker border */
  border-radius: 16px;         /* Larger radius */
  padding: 32px;               /* More padding */
  min-height: 280px;           /* Minimum height */
}
```

## Component Structure

### JSX
```jsx
<div className="action-item-card">
  {/* JIRA Icon */}
  <div className="item-icon">
    <img src="/JIRALOGO.png" alt="JIRA" />
  </div>

  <div className="item-content">
    {/* Top Labels */}
    <div className="item-labels">
      <div className="label-box">SPRINT + TICKET #{item.id}</div>
      <div className="label-box feature-label">{item.status}</div>
    </div>

    {/* Description */}
    <h3 className="item-description-text">Description</h3>

    {/* Progress Bar */}
    <div className="item-progress">
      <div className="progress-bar-empty">
        <div className="progress-fill-blue" style={{ width: `${item.progress}%` }} />
      </div>
      <span className="progress-text">{item.progress}%</span>
    </div>
  </div>
</div>
```

## Layout Changes

### Full Width Implementation
- **Old**: Two-column grid (action items | GitHub context)
- **New**: Single column, full width
- **Max Width**: 1400px
- **Centering**: `margin: 0 auto`

### Removed Right Sidebar
- Eliminated entire GitHub context column
- Removed repository cards
- Removed feature detail cards
- Removed empty state for selection

## Color Palette

### Primary Colors
- **Black**: #1d1d1f (borders, text, labels)
- **Blue**: #007aff (progress bar, accents)
- **White**: #ffffff (backgrounds, empty progress)

### Removed Colors
- ❌ Red (#FF3B30) - old progress gradient
- ❌ Orange (#FF9F0A) - old progress gradient  
- ❌ Green (#34C759) - old progress gradient
- ❌ Gray (#525252, #86868b) - various text

## Typography

### Font Hierarchy
1. **Description**: 48px, weight 400
2. **Progress %**: 20px, weight 700
3. **Labels**: 13px, weight 600, uppercase

### Removed Typography
- ❌ Title (20px)
- ❌ Description paragraph (14px)
- ❌ Item ID (13px)
- ❌ Priority (12px)
- ❌ GitHub info (12px)

## Interaction

### Simplified Behavior
- **Hover**: Card lifts 3px with shadow
- **Click**: Opens JIRA task (placeholder)
- **No Buttons**: Clean, minimal interaction surface

### Removed Interactions
- ❌ "Edit in JIRA" button
- ❌ Quick action buttons on hover
- ❌ GitHub context panel selection
- ❌ Repository/feature card clicks

## Files Modified

1. **TasksDeveloper.jsx**
   - Simplified card structure
   - Removed GitHub context column
   - Updated to use JIRA logo
   - Removed complex header elements

2. **TasksDeveloper.css**
   - New label box styles
   - Blue progress bar styling
   - Increased card prominence
   - Removed old styling rules

## Result

The cards now perfectly match the wireframe with:
- ✅ JIRA logo (not Slack)
- ✅ Clean label boxes at top
- ✅ Large "Description" text
- ✅ Blue bordered progress bar (empty but filled with blue)
- ✅ Prominent card design (3px border, 280px min height)
- ✅ Full-width layout (no sidebar)
- ✅ Simplified, focused presentation

The design is now **wireframe-accurate** and ready for JIRA integration! 🎯

