# 🚀 HeyJarvis Desktop v2 - Setup Guide

## Quick Start (5 minutes)

### 1. Install Dependencies

```bash
cd /Users/jarvis/Code/HeyJarvis/desktop2
npm install
```

### 2. Start Development

```bash
npm run dev
```

This will:
- Start Vite dev server on `localhost:5173`
- Launch Electron with hot reload enabled
- Show the new React-based UI

### 3. What You'll See

1. **Loading Screen** - Animated with progress bar
2. **Main Window** - React app with routing
3. **Copilot Page** - Placeholder showing system status

## 🎯 Next Steps

### Phase 1: Complete Core Components (2-3 hours)

#### A. Create Chat Components

```bash
# Create the files:
renderer2/src/components/Chat/ChatContainer.jsx
renderer2/src/components/Chat/Message.jsx
renderer2/src/components/Chat/InputBox.jsx
renderer2/src/components/Chat/StatusBar.jsx
```

**Reference**: Copy logic from `desktop/renderer/unified.html` lines 1348-1415

#### B. Create Task Components

```bash
renderer2/src/components/Tasks/TaskList.jsx
renderer2/src/components/Tasks/TaskItem.jsx
renderer2/src/components/Tasks/TaskInput.jsx
```

**Reference**: Copy from `desktop/renderer/unified.html` lines 1419-1461

#### C. Add State Management

```bash
renderer2/src/store/chatStore.js
renderer2/src/store/taskStore.js
```

### Phase 2: Port Styling (1-2 hours)

Copy CSS from `desktop/renderer/unified.html` into component CSS modules:

```
unified.html lines 8-1280 → Component CSS files
```

### Phase 3: Test Everything (1 hour)

```bash
# Test IPC communication
# Test chat functionality
# Test task management
# Test window controls
```

## 📁 File Structure Reference

### Where Everything Is

```
desktop2/
├── main/
│   ├── index.js                    ← Main process entry
│   ├── windows/
│   │   ├── MainWindowManager.js    ← Creates main window
│   │   └── CopilotOverlayManager.js ← Creates overlay
│   ├── services/
│   │   ├── AIService.js            ← Claude integration
│   │   └── SlackService.js         ← Slack integration
│   └── ipc/
│       ├── chat-handlers.js        ← Chat IPC (invoke from renderer)
│       └── task-handlers.js        ← Task IPC
│
└── renderer2/
    ├── index.html                  ← Entry HTML
    ├── src/
    │   ├── main.jsx                ← React entry point
    │   ├── App.jsx                 ← Root component
    │   ├── pages/
    │   │   ├── Copilot.jsx         ← Main copilot UI
    │   │   └── Tasks.jsx           ← Task management UI
    │   ├── components/
    │   │   ├── LoadingScreen/      ← ✅ Done
    │   │   ├── Chat/               ← TODO
    │   │   └── Tasks/              ← TODO
    │   ├── store/                  ← TODO (state management)
    │   └── styles/
    │       └── global.css          ← ✅ Done (global styles)
```

## 🔌 IPC Communication

### From Renderer to Main

```javascript
// In React components:
const response = await window.electronAPI.chat.send('Hello!');
const tasks = await window.electronAPI.tasks.getAll();
```

### Available APIs

See `bridge/preload.js` for full API:

- `window.electronAPI.chat.*` - Chat operations
- `window.electronAPI.tasks.*` - Task operations
- `window.electronAPI.system.*` - System info
- `window.electronAPI.window.*` - Window controls

## 🎨 Styling Guide

### Use CSS Variables

```css
/* Already defined in global.css */
color: var(--color-primary);
padding: var(--spacing-md);
border-radius: var(--radius-lg);
transition: var(--transition-normal);
```

### Component Styling Pattern

```jsx
// ChatContainer.jsx
import './ChatContainer.css';

export default function ChatContainer() {
  return <div className="chat-container">...</div>;
}
```

```css
/* ChatContainer.css */
.chat-container {
  padding: var(--spacing-lg);
  background: var(--color-surface);
  border-radius: var(--radius-md);
}
```

## 🐛 Debugging

### Open DevTools

The app will automatically open DevTools in development mode.

### Check Logs

```bash
# Main process logs
~/Library/Application Support/HeyJarvis/logs/main.log

# Or view in console
```

### Common Issues

**Issue**: Vite dev server not starting
**Fix**: Make sure port 5173 is not in use

**Issue**: Electron shows blank screen
**Fix**: Check browser console for errors

**Issue**: IPC not working
**Fix**: Verify preload script is loaded (check console for "🔗 Preload script loaded")

## 📊 Progress Tracking

- [x] Project structure
- [x] Main process architecture
- [x] IPC handlers
- [x] Services layer
- [x] React setup
- [x] LoadingScreen component
- [ ] Chat components
- [ ] Task components
- [ ] State management
- [ ] Styling complete
- [ ] Testing
- [ ] Production build

## 🎓 Learning Resources

### React Patterns

- [React Docs](https://react.dev)
- [React Hooks](https://react.dev/reference/react)
- [Component Patterns](https://react.dev/learn/thinking-in-react)

### Electron + React

- [Electron Security](https://www.electronjs.org/docs/latest/tutorial/security)
- [IPC Communication](https://www.electronjs.org/docs/latest/tutorial/ipc)
- [Vite + Electron](https://www.electron.build/)

## 💡 Tips

1. **Use React DevTools**: Install the Chrome extension for debugging
2. **Hot Reload**: Most changes appear instantly without restart
3. **Console Logging**: Use both renderer and main process consoles
4. **Component Isolation**: Test components individually before integrating

## 🆘 Need Help?

1. Check `README.md` for architecture overview
2. Look at existing `LoadingScreen` component as example
3. Reference `desktop/renderer/unified.html` for logic to port
4. Main process logs show server-side errors
5. Browser console shows renderer errors

---

**You're all set!** Run `npm run dev` and start building! 🚀

