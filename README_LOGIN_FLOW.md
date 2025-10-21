# HeyJarvis Enterprise Login Flow

> **Premium, fast, enterprise-ready onboarding workflow with liquid glass UI**

This document describes the multi-step login and onboarding flow architecture, design system, and implementation details.

---

## 📋 Table of Contents

- [Overview](#overview)
- [Flow Architecture](#flow-architecture)
- [State Machine](#state-machine)
- [Visual Design System](#visual-design-system)
- [Implementation](#implementation)
- [Deep Link Authentication](#deep-link-authentication)
- [Electron Configuration](#electron-configuration)
- [Accessibility](#accessibility)
- [Testing Checklist](#testing-checklist)

---

## Overview

### North Star

- **Time to Value (TTV):** 3 minutes from landing to fully configured
- **Design Language:** Light mode, single accent color (#2563EB), liquid glass translucency
- **Enterprise-First:** SSO selection, multi-workspace support, granular permissions
- **Electron-Native:** macOS vibrancy, Windows 11 acrylic, secure keychain storage

### Key Features

✅ Multi-step guided onboarding
✅ Slack & Microsoft OAuth authentication
✅ Workspace detection and selection
✅ Granular permission management
✅ Native OS translucency (liquid glass effect)
✅ Deep link OAuth callback handling
✅ Secure token storage in OS keychain
✅ Full keyboard navigation & screen reader support

---

## Flow Architecture

### Flow Map

```
Welcome
  ↓
ProviderSelect (integrated in Welcome)
  ↓
AuthRedirect (OAuth popup/browser)
  ↓
WorkspaceDetection
  ├─ Found → WorkspacePicker
  └─ None  → WorkspaceCreate
  ↓
PermissionsReview
  ↓
Success (with next actions)
```

### Error Branches

At any step, errors route to inline error display with recovery options:

- **Auth Failed:** Retry / Switch provider / Open in browser
- **Permission Denied:** Request admin approval / Try another workspace
- **Network Error:** Retry / Check network settings
- **Rate Limited:** Wait and retry / Switch provider

---

## State Machine

### States

| State | Description | Progress |
|-------|-------------|----------|
| `welcome` | Initial landing, provider selection | 0% |
| `authenticating` | OAuth in progress | 20% |
| `detectingWorkspace` | Fetching user's workspaces | 40% |
| `selectingWorkspace` | Choose from multiple workspaces | 50% |
| `creatingWorkspace` | No workspaces found, create new | 50% |
| `reviewingPermissions` | Grant app permissions | 75% |
| `success` | Onboarding complete | 100% |
| `error` | Error state with recovery | (maintains previous %) |

### State Transitions

```javascript
const FLOW_STATES = {
  WELCOME: 'welcome',
  AUTHENTICATING: 'authenticating',
  DETECTING_WORKSPACE: 'detectingWorkspace',
  SELECTING_WORKSPACE: 'selectingWorkspace',
  CREATING_WORKSPACE: 'creatingWorkspace',
  REVIEWING_PERMISSIONS: 'reviewingPermissions',
  SUCCESS: 'success',
  ERROR: 'error'
};
```

### Data Flow

```javascript
// State held in LoginFlow component
{
  flowState: FLOW_STATES.WELCOME,
  provider: 'slack' | 'microsoft' | null,
  workspaces: Array<Workspace>,
  selectedWorkspace: Workspace | null,
  newWorkspaceName: string,
  permissions: Record<string, boolean>,
  error: string | null,
  loadingSlack: boolean,
  loadingMicrosoft: boolean,
  authTimeout: boolean
}
```

---

## Visual Design System

### Design Tokens

```css
/* Colors */
--color-canvas: #F7F7F8
--color-glass-bg: rgba(255, 255, 255, 0.55)
--color-stroke: rgba(0, 0, 0, 0.06)
--color-shadow: rgba(16, 24, 40, 0.06)
--color-text-primary: #0B0C0E
--color-text-secondary: #5A5F6A
--color-text-tertiary: #8C919A
--color-accent: #2563EB
--color-accent-hover: #1D4ED8
--color-focus-ring: rgba(37, 99, 235, 0.12)

/* Spacing (8px grid) */
--space-xs: 8px
--space-sm: 16px
--space-md: 24px
--space-lg: 32px
--space-xl: 48px
--space-2xl: 64px

/* Radius */
--radius-card: 20px
--radius-button: 14px
--radius-input: 12px

/* Typography */
Title: 36/44, semibold, #0B0C0E
Subtitle: 16/26, regular, #5A5F6A
Body: 15/22, regular, #5A5F6A
Caption: 13/20, regular, #8C919A
```

### Liquid Glass Effect

The signature visual style combines:

1. **Transparent background** with translucent white overlay
2. **Native OS blur** (macOS vibrancy / Windows acrylic)
3. **CSS backdrop-filter** as fallback
4. **Soft shadows** for depth

```css
.login-flow-container {
  background: rgba(255, 255, 255, 0.55);
  backdrop-filter: blur(22px) saturate(160%);
  border: 1px solid rgba(0, 0, 0, 0.06);
  border-radius: 20px;
  box-shadow: 0 16px 48px rgba(16, 24, 40, 0.06);
}
```

### Micro-animations

- **Card mount:** `fade + translateY(8px)` @ 140ms
- **Button hover:** Border color shift, subtle lift
- **Button active:** Scale down to 0.99
- **Progress bar:** Smooth width transition @ 200-260ms
- **Skeleton shimmer:** Infinite gradient sweep

---

## Implementation

### File Structure

```
desktop2/renderer2/src/
├── pages/
│   ├── LoginFlow.jsx          # Main orchestrator component
│   ├── LoginFlow.css          # Shared design system tokens
│   └── Login.jsx              # Legacy (can be removed)
└── App.jsx                    # Routes to LoginFlow when !authenticated

desktop2/main/
├── index.js                   # Deep link handler setup
└── windows/
    └── SecondaryWindowManager.js  # Window config with translucency
```

### Components

#### LoginFlow.jsx

Main state machine orchestrator. Handles:

- Flow state transitions
- Auth provider selection (Slack/Microsoft)
- Workspace detection and selection
- Permission management
- Success actions

**Props:**

```javascript
<LoginFlow
  onLoginSuccess={(result) => {
    // result: { workspace, provider, permissions }
  }}
/>
```

**Key Methods:**

- `handleSlackLogin()` - Initiate Slack OAuth
- `handleMicrosoftLogin()` - Initiate Microsoft OAuth
- `handleAuthSuccess(authResult)` - Process successful auth
- `handleAuthError(message)` - Handle auth failures
- `handleSelectWorkspace(workspace)` - User selects workspace
- `handleCreateWorkspace()` - User creates new workspace
- `handleApprovePermissions()` - Finalize permission grants

### Integration Points

#### Auth Service

```javascript
// Slack OAuth
const result = await window.electronAPI.auth.signInWithSlack();
// Returns: { success: boolean, user: object, session: object, error?: string }

// Microsoft OAuth
const result = await window.electronAPI.auth.signInWithMicrosoft();
// Returns: { success: boolean, user: object, session: object, error?: string }
```

#### Workspace API (TODO)

```javascript
// Fetch user's workspaces
const workspaces = await fetchUserWorkspaces(userId, provider);
// Returns: Array<{ id, name, role, lastActive, canInstall }>

// Create workspace
const workspace = await createWorkspace(userId, name);
// Returns: { id, name, slug, role }
```

#### Permissions API (TODO)

```javascript
// Save permission grants
await savePermissions(workspaceId, permissions);
// permissions: { import_channels: true, sync_calendar: false, ... }
```

---

## Deep Link Authentication

### Protocol Registration

The app registers the `heyjarvis://` URL scheme for OAuth callbacks.

**Electron Setup** (`main/index.js`):

```javascript
app.setAsDefaultProtocolClient('heyjarvis');

app.on('open-url', (event, url) => {
  event.preventDefault();
  handleDeepLink(url); // Parse and process callback
});
```

### Callback Flow

1. User clicks "Sign in with Slack" → Opens OAuth URL
2. User authorizes in browser → Provider redirects to `heyjarvis://auth/callback?code=xxx&state=xxx`
3. OS opens HeyJarvis → Deep link handler fires
4. Main process sends event to renderer: `'auth:callback'`
5. LoginFlow receives callback, exchanges code for token

**Deep Link Format:**

```
heyjarvis://auth/callback?code=AUTH_CODE&state=STATE_TOKEN
heyjarvis://auth/callback?error=access_denied&error_description=...
```

### Renderer Listener (TODO)

```javascript
// In LoginFlow.jsx or auth service
window.electronAPI.on('auth:callback', ({ code, state, error }) => {
  if (error) {
    handleAuthError(error);
  } else {
    // Exchange code for access token
    exchangeCodeForToken(code, state);
  }
});
```

---

## Electron Configuration

### Window Configuration

**Secondary Window** (login/onboarding):

```javascript
{
  width: 1120,
  height: 760,
  transparent: true,
  backgroundColor: '#00FFFFFF',
  frame: false,

  // macOS
  vibrancy: 'sidebar',
  visualEffectState: 'active',
  titleBarStyle: 'hiddenInset',
  trafficLightPosition: { x: 14, y: 14 },

  // Windows 11
  backgroundMaterial: 'acrylic'
}
```

### Secure Token Storage

**Never use localStorage for tokens.** Use Electron's safeStorage (OS keychain):

```javascript
const { safeStorage } = require('electron');

// Store token
const encrypted = safeStorage.encryptString(token);
store.set('auth.token', encrypted.toString('base64'));

// Retrieve token
const encryptedBuffer = Buffer.from(store.get('auth.token'), 'base64');
const token = safeStorage.decryptString(encryptedBuffer);
```

---

## Accessibility

### Keyboard Navigation

- **Tab order:** Follows visual flow (top to bottom, left to right)
- **Enter:** Triggers primary action
- **Escape:** Dismisses modals (future)
- **Arrow keys:** Navigate workspace list (future enhancement)

### Focus Management

All interactive elements have visible focus rings:

```css
*:focus-visible {
  box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.12);
}
```

### ARIA Labels

```javascript
<button
  aria-label="Continue with Slack"
  disabled={loading}
>
  Continue with Slack
</button>

<div
  className="progress-bar"
  role="progressbar"
  aria-valuenow={progress}
  aria-valuemin="0"
  aria-valuemax="100"
/>

<div
  className="login-flow-workspace-item"
  role="radio"
  aria-checked={selected}
  tabIndex={0}
/>
```

### Screen Reader Announcements

```javascript
<div className="login-flow-error" role="alert">
  {error}
</div>
```

### Reduced Motion

```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

### Reduced Transparency

```css
@media (prefers-reduced-transparency) {
  .login-flow-container {
    background: #FFFFFF;
    backdrop-filter: none;
  }
}
```

### Minimum Touch Targets

All interactive elements meet WCAG 2.5.5 (44×44px minimum):

```css
button, a {
  min-height: 44px;
  min-width: 44px;
}
```

---

## Testing Checklist

### Functional Tests

- [ ] Slack OAuth completes successfully
- [ ] Microsoft OAuth completes successfully
- [ ] Auth error shows inline message with retry
- [ ] Auth timeout (15s) triggers "Open in browser" option
- [ ] Workspace detection fetches and displays workspaces
- [ ] Workspace selection enables "Continue" button
- [ ] Workspace creation validates name and generates slug
- [ ] Permission toggles work correctly
- [ ] Required permissions cannot be disabled
- [ ] Success screen shows contextual next actions
- [ ] "Open Mission Control" navigates to app

### Error Handling

- [ ] Network offline → Shows offline error with retry
- [ ] Invalid credentials → Shows auth error with retry
- [ ] Expired token → Prompts re-authentication
- [ ] Rate limited → Shows delay message with countdown
- [ ] Permission denied → Shows approval request flow

### Visual & Interaction

- [ ] Liquid glass effect renders on macOS (vibrancy)
- [ ] Liquid glass effect renders on Windows 11 (acrylic)
- [ ] CSS backdrop-filter fallback works on older systems
- [ ] Progress bar animates smoothly between steps
- [ ] Buttons show hover, focus, and active states
- [ ] Skeleton loaders animate during async operations
- [ ] Card mount animation plays on step transition
- [ ] All text is legible (contrast ≥ 4.5:1)

### Accessibility

- [ ] Tab key navigates in correct order
- [ ] Enter key triggers primary action
- [ ] Focus rings are visible and clear
- [ ] Screen reader announces state changes
- [ ] Screen reader reads error messages (role="alert")
- [ ] Progress bar announces percentage to screen readers
- [ ] All images have alt text (if applicable)
- [ ] Reduced motion preference is respected
- [ ] Reduced transparency preference is respected
- [ ] Minimum 44×44px touch targets

### Electron-Specific

- [ ] Deep link `heyjarvis://` registers correctly
- [ ] Deep link callback fires on OAuth return
- [ ] Window transparency works on macOS
- [ ] Window transparency works on Windows 11
- [ ] Tokens stored in OS keychain, not localStorage
- [ ] Window can be dragged (frameless)
- [ ] Traffic lights positioned correctly (macOS)

### Cross-Platform

- [ ] macOS: Vibrancy effect visible
- [ ] macOS: Traffic lights positioned correctly
- [ ] Windows 11: Acrylic effect visible
- [ ] Windows 10: Fallback to solid + blur
- [ ] Linux: Fallback to solid + blur
- [ ] Retina displays: No pixelation or blur

### Performance

- [ ] Initial render < 500ms
- [ ] State transitions < 100ms
- [ ] OAuth redirect < 3s (network dependent)
- [ ] Workspace fetch < 2s (network dependent)
- [ ] No jank during animations (60fps)
- [ ] Memory usage stable (no leaks)

---

## API Contracts

### Auth Response

```typescript
interface AuthResult {
  success: boolean;
  user?: {
    id: string;
    email: string;
    name: string;
    avatar?: string;
    user_role?: 'developer' | 'sales' | 'admin';
  };
  session?: {
    access_token: string;
    refresh_token: string;
    expires_at: number;
  };
  error?: string;
}
```

### Workspace

```typescript
interface Workspace {
  id: string;
  name: string;
  slug: string;
  role: 'Owner' | 'Admin' | 'Member';
  lastActive: string; // Human-readable, e.g., "2 days ago"
  canInstall: boolean; // Permission to install HeyJarvis
}
```

### Permissions

```typescript
interface Permissions {
  // Required (always true)
  read_messages: boolean;
  user_profile: boolean;

  // Optional
  import_channels?: boolean;
  sync_calendar?: boolean;
  webhook_access?: boolean;
}
```

---

## Future Enhancements

- [ ] Email/password authentication (progressive disclosure)
- [ ] Passkey support
- [ ] SSO provider auto-detection (MDM-friendly)
- [ ] Multi-factor authentication
- [ ] Team invitation during onboarding
- [ ] Workspace transfer flow
- [ ] Advanced permission tooltips with scope details
- [ ] Animated progress illustrations
- [ ] Dark mode support

---

## Support

For questions or issues:

- **GitHub Issues:** [anthropics/heyjarvis](https://github.com/anthropics/heyjarvis/issues)
- **Documentation:** [docs.heyjarvis.ai](https://docs.heyjarvis.ai)
- **Slack:** #heyjarvis-support

---

**Last Updated:** 2025-01-17
**Version:** 2.0.0
**Maintained by:** HeyJarvis Team
