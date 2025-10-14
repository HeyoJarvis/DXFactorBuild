# Arc Reactor Menu - User Guide

## Quick Start

### Opening the Menu
**Click the Arc Reactor icon** in the center of the header bar.

### Menu Layout
```
            💬 Chat
             |
             |
🔔 Follow  [⚛️]  📋 Tasks
  Up!        |
             |
          ⚙️ Settings
```

## Menu Options

### 💬 Chat (Top)
- Opens the main AI chat interface
- Ask questions, get insights
- Access your conversation history

### 📋 Tasks (Right)
- View your task list
- See assignments and priorities
- Click tasks to open detailed chat
- **Window expands to 656x900** for better task management

### ⚙️ Settings (Bottom)
- Currently maps to Chat
- Future: Configuration options

### 🔔 Follow Up (Left)
- Currently maps to Tasks with notifications
- Future: Dedicated follow-up tracking

## Visual Feedback

### Arc Reactor States
1. **Default**: Blue glow, centered
2. **Hover**: Scales up, brighter glow
3. **Menu Open**: Rotates 90°, maximum glow

### Menu Animations
- Buttons slide out in circular pattern
- Spring-based animation (bouncy feel)
- Hover: Buttons scale up 15%
- Glass morphism effect (transparent + blur)

## Keyboard Tips
- **ESC**: Close menu (coming soon)
- **Click outside**: Close menu
- **Tab**: Navigate menu items (coming soon)

## Customization

### Using Your Own Arc Reactor Image
1. Create/find your Arc Reactor image
2. Save as `desktop/public/arcreactor.png` or `arcreactor.svg`
3. Restart the app
4. Your image will automatically load!

**Image Tips**:
- Recommended size: 256x256px or larger
- Transparent background works best
- PNG or SVG format
- Circular/square aspect ratio

### If No Custom Image
The app includes a beautiful default SVG:
- Blue gradient circles
- Pulsing glow effect
- Professionally designed
- Matches the Arc Reactor theme

## Technical Details

### Window Behavior
- **Collapsed**: 48px height, minimal header
- **Expanded (Tasks)**: 656x900px
- **Smooth transitions**: All animations use cubic-bezier easing
- **Responsive**: Adapts to different screen sizes

### Performance
- CSS animations (GPU accelerated)
- No layout thrashing
- Smooth 60fps animations
- Minimal JavaScript

## Troubleshooting

### Menu Won't Open
- Check console for errors
- Ensure JavaScript is enabled
- Try refreshing the app

### Custom Image Not Loading
- Check file path: `desktop/public/arcreactor.png`
- Verify file name (case-sensitive)
- Check image format (PNG/SVG only)
- Try with absolute path in src

### Menu Items Not Working
- Ensure you're on latest version
- Check that `switchTab` function exists
- Review console for errors

## Future Enhancements

Coming soon:
- Keyboard shortcuts (Cmd+1, Cmd+2, etc.)
- More menu items
- Customizable menu positions
- Theme options
- Sound effects
- Haptic feedback





