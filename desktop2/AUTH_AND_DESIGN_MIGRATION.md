# 🔐 Authentication & Design Migration Plan

## Current State - Desktop2

### ❌ Missing Features:
1. **No Login Screen** - App starts directly showing tasks
2. **No Auth Service** - No Slack/Teams OAuth integration
3. **No User State** - Can't track who's logged in
4. **Dark Theme** - Tasks page uses dark colors
5. **No Task Syncing** - Tasks don't come from Slack/Teams

### ✅ What Exists:
- Supabase adapter with task methods
- Task IPC handlers
- Basic task UI components
- Separate windows architecture

## Required Migration

### 1. Authentication System

#### Files to Copy:
```bash
FROM: /desktop/services/auth-service.js
TO: /desktop2/main/services/AuthService.js

FROM: /desktop/renderer/login.html  
TO: /desktop2/renderer2/src/pages/Login.jsx (convert to React)
```

#### Key Features:
- Slack OAuth with PKCE flow
- Supabase session management
- Token refresh
- Local session storage
- Microsoft Teams OAuth support

### 2. Login Flow

**Desktop Implementation:**
```
App Start
  ↓
Check for existing session (electron-store)
  ↓
If NO session → Show login.html
  ↓
User clicks "Sign in with Slack"
  ↓
OAuth flow via Supabase Auth
  ↓
Redirect to callback
  ↓
Save session & user data
  ↓
Redirect to main app
```

**Desktop2 Needs:**
```jsx
// In App.jsx
const [isAuthenticated, setIsAuthenticated] = useState(false);
const [currentUser, setCurrentUser] = useState(null);
const [loading, setLoading] = useState(true);

useEffect(() => {
  checkAuthStatus();
}, []);

if (loading) return <LoadingScreen />;
if (!isAuthenticated) return <Login onSuccess={handleLoginSuccess} />;
return <MainApp user={currentUser} />;
```

### 3. Task Syncing from Slack/Teams

**Desktop has:**
- Real-time Slack message monitoring
- AI task detection from messages
- Automatic task creation
- Task-to-message linking

**Migration Steps:**
1. Copy Slack Service integration
2. Copy task detection logic
3. Wire up to Supabase task creation
4. Add real-time updates

### 4. Light/Vibey Design

#### Color Palette:
```css
/* Desktop (Light) */
--bg-primary: #ffffff;
--bg-secondary: #f8f9fa;
--text-primary: #171717;
--accent: linear-gradient(135deg, #667eea 0%, #764ba2 100%);

/* Desktop2 (Dark) - NEEDS UPDATE */
--color-bg: rgba(28, 28, 30, 0.95);
--color-surface: rgba(44, 44, 46, 0.95);
--color-text-primary: #ffffff;
```

#### Components to Update:

**Tasks.jsx + Tasks.css:**
```css
/* Current (Dark) */
.tasks-page {
  background: var(--color-bg); /* Dark */
}

/* Target (Light) */
.tasks-page {
  background: #ffffff; /* White */
}

.tasks-header {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.task-card {
  background: white;
  border: 1px solid #e5e7eb;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}
```

**Copilot.jsx + Copilot.css:**
```css
/* White background, light gray chat area */
.copilot-page {
  background: #ffffff;
}

.messages-area {
  background: #f8f9fa;
}

.message-user {
  background: #007AFF;
  color: white;
}

.message-assistant {
  background: white;
  border: 1px solid #e5e7eb;
}
```

## Implementation Order

### Phase 1: Authentication (Priority 1)
1. ✅ Copy AuthService.js
2. ✅ Create Login.jsx component
3. ✅ Add auth state to App.jsx
4. ✅ Wire up OAuth flow
5. ✅ Test Slack login

### Phase 2: Light Theme (Priority 2)
1. ✅ Update global.css with light colors
2. ✅ Update Tasks.css to light theme
3. ✅ Update Copilot.css to light theme
4. ✅ Update Navigation.css gradient
5. ✅ Test all components

### Phase 3: Task Syncing (Priority 3)
1. ✅ Copy Slack monitoring
2. ✅ Copy task detection AI
3. ✅ Wire up to task creation
4. ✅ Add real-time updates
5. ✅ Test end-to-end

## Quick Start Commands

### 1. Copy Auth Service
```bash
cp /Users/jarvis/Code/HeyJarvis/desktop/services/auth-service.js \
   /Users/jarvis/Code/HeyJarvis/desktop2/main/services/AuthService.js
```

### 2. Extract Login HTML to React
```bash
# Convert login.html → Login.jsx
# Extract styles to Login.css
# Add to routes
```

### 3. Update Main Index
```javascript
// desktop2/main/index.js
const AuthService = require('./services/AuthService');

async function initializeServices() {
  appState.services.auth = new AuthService({ logger });
  // ... existing services
}
```

### 4. Update App.jsx
```jsx
import Login from './pages/Login';

function App() {
  const [auth, setAuth] = useState(null);
  
  useEffect(() => {
    async function checkAuth() {
      const session = await window.electronAPI.auth.getSession();
      setAuth(session);
    }
    checkAuth();
  }, []);
  
  if (!auth) return <Login />;
  return <MainApp user={auth.user} />;
}
```

## Environment Variables

```env
# Already exist in .env
SUPABASE_URL=...
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...

# May need to add:
ENCRYPTION_KEY=...  # For electron-store
```

## Testing Checklist

### Auth Flow:
- [ ] App opens to login screen
- [ ] Click "Sign in with Slack" opens OAuth
- [ ] Redirect works after approval
- [ ] Session saved to electron-store
- [ ] User data synced to Supabase
- [ ] Main app loads after login

### Design:
- [ ] Tasks page has white background
- [ ] Gradient header on tasks
- [ ] Task cards are white with shadows
- [ ] Copilot has light theme
- [ ] Message bubbles styled correctly

### Task Syncing:
- [ ] Slack messages monitored
- [ ] AI detects tasks from messages
- [ ] Tasks auto-created in Supabase
- [ ] Tasks show up in UI
- [ ] Real-time updates work

## Notes

### Slack OAuth Setup:
Desktop uses Supabase Auth's Slack OIDC provider:
```javascript
const authUrl = `${supabaseUrl}/auth/v1/authorize?provider=slack_oidc&redirect_to=${redirectUrl}`;
```

This requires:
1. Supabase project configured with Slack OAuth
2. Slack app credentials in Supabase dashboard
3. Redirect URL whitelist updated

### Session Persistence:
Uses `electron-store` for local session cache:
```javascript
this.store = new Store({
  name: 'heyjarvis-auth',
  encryptionKey: process.env.ENCRYPTION_KEY
});
```

---

**Next Steps:**
1. Start with Auth (get login working)
2. Then update design (make it light/vibey)
3. Finally add task syncing (Slack→Tasks)


