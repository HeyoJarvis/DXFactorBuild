# Microsoft 365 Button Implementation

## Step 1: Add Microsoft API to Preload Script

**File**: `/Users/jarvis/Code/HeyJarvis/desktop/bridge/copilot-preload.js`

**Add this code after line 180** (after the `tasks` API block):

```javascript
  // Microsoft 365 API
  microsoft: {
    authenticate: () => ipcRenderer.invoke('microsoft:authenticate'),
    createEvent: (eventData) => ipcRenderer.invoke('microsoft:createEvent', eventData),
    sendEmail: (emailData) => ipcRenderer.invoke('microsoft:sendEmail', emailData),
    executeWorkflowActions: (workflow, userEmails) => ipcRenderer.invoke('microsoft:executeWorkflowActions', workflow, userEmails),
    findMeetingTimes: (attendees, durationMinutes, options) => ipcRenderer.invoke('microsoft:findMeetingTimes', attendees, durationMinutes, options),
    getUserProfile: () => ipcRenderer.invoke('microsoft:getUserProfile')
  },
```

## Step 2: Add CSS Styles to unified.html

**File**: `/Users/jarvis/Code/HeyJarvis/desktop/renderer/unified.html`

**Add this CSS after line 290** (after `.notification-badge`):

```css
    /* Microsoft 365 Button */
    .ms-auth-btn {
      width: 32px;
      height: 32px;
      border: none;
      border-radius: 8px;
      background: transparent;
      color: #737373;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
      position: relative;
    }

    .ms-auth-btn:hover {
      background: rgba(0, 0, 0, 0.05);
      color: #171717;
    }

    .ms-auth-btn.connected {
      color: #10b981;
    }

    .ms-auth-btn.connected:hover {
      background: rgba(16, 185, 129, 0.1);
    }

    .ms-status-dot {
      position: absolute;
      bottom: 2px;
      right: 2px;
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: #737373;
      transition: all 0.2s ease;
    }

    .ms-auth-btn.connected .ms-status-dot {
      background: #10b981;
      box-shadow: 0 0 6px rgba(16, 185, 129, 0.5);
      animation: pulse 2s ease-in-out infinite;
    }

    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.6; }
    }

    /* Microsoft Auth Modal */
    .ms-auth-modal {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      backdrop-filter: blur(8px);
      display: none;
      align-items: center;
      justify-content: center;
      z-index: 10000;
      animation: fadeIn 0.2s ease;
    }

    .ms-auth-modal.show {
      display: flex;
    }

    .ms-auth-content {
      background: white;
      border-radius: 16px;
      padding: 32px;
      max-width: 400px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      animation: slideUp 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }

    .ms-auth-content h3 {
      font-size: 20px;
      font-weight: 600;
      margin-bottom: 12px;
      color: #171717;
    }

    .ms-auth-content p {
      font-size: 14px;
      color: #737373;
      margin-bottom: 24px;
      line-height: 1.5;
    }

    .ms-auth-actions {
      display: flex;
      gap: 12px;
    }

    .ms-auth-actions button {
      flex: 1;
      height: 40px;
      border: none;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .ms-auth-primary {
      background: linear-gradient(135deg, #0078d4 0%, #5856d6 100%);
      color: white;
    }

    .ms-auth-primary:hover {
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(0, 120, 212, 0.3);
    }

    .ms-auth-secondary {
      background: rgba(0, 0, 0, 0.05);
      color: #171717;
    }

    .ms-auth-secondary:hover {
      background: rgba(0, 0, 0, 0.08);
    }

    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    @keyframes slideUp {
      from { 
        opacity: 0;
        transform: translateY(20px);
      }
      to { 
        opacity: 1;
        transform: translateY(0);
      }
    }

    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
```

## Step 3: Add Button HTML

**Add this button after line 1386** (after the Fact Check button):

```html
      <button class="ms-auth-btn" id="msAuthBtn" onclick="toggleMicrosoftAuth()" title="Microsoft 365">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M11.4 24H0V12.6h11.4V24zM24 24H12.6V12.6H24V24zM11.4 11.4H0V0h11.4v11.4zm12.6 0H12.6V0H24v11.4z"/>
        </svg>
        <span class="ms-status-dot"></span>
      </button>
```

## Step 4: Add Modal HTML

**Add this modal before the closing `</body>` tag** (around line 2346):

```html
  <!-- Microsoft 365 Auth Modal -->
  <div class="ms-auth-modal" id="msAuthModal">
    <div class="ms-auth-content">
      <h3>Connect Microsoft 365</h3>
      <p>Connect your Microsoft account to enable calendar automation, email notifications, and Teams integration.</p>
      <div class="ms-auth-actions">
        <button class="ms-auth-secondary" onclick="closeMicrosoftModal()">Cancel</button>
        <button class="ms-auth-primary" onclick="authenticateMicrosoft()">Connect</button>
      </div>
    </div>
  </div>
```

## Step 5: Add JavaScript Functions

**Add this JavaScript before the closing `</script>` tag** (around line 2345):

```javascript
    // ===== MICROSOFT 365 AUTHENTICATION =====
    let microsoftConnected = false;
    let microsoftUser = null;

    async function toggleMicrosoftAuth() {
      if (microsoftConnected) {
        // Show disconnect confirmation
        const confirmed = confirm(`Disconnect from Microsoft 365 (${microsoftUser})?`);
        if (confirmed) {
          microsoftConnected = false;
          microsoftUser = null;
          updateMicrosoftButton();
        }
      } else {
        // Show auth modal
        document.getElementById('msAuthModal').classList.add('show');
      }
    }

    function closeMicrosoftModal() {
      document.getElementById('msAuthModal').classList.remove('show');
    }

    async function authenticateMicrosoft() {
      try {
        console.log('🔐 Starting Microsoft authentication...');
        
        // Show loading state
        const modal = document.getElementById('msAuthModal');
        const content = modal.querySelector('.ms-auth-content');
        content.innerHTML = `
          <h3>Authenticating...</h3>
          <p style="text-align: center;">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="animation: spin 1s linear infinite;">
              <circle cx="12" cy="12" r="10"></circle>
              <path d="M12 6v6l4 2"></path>
            </svg>
          </p>
          <p>Opening your browser for authentication...</p>
        `;
        
        // Call Microsoft authentication
        const result = await window.electronAPI.microsoft.authenticate();
        
        if (result.success) {
          console.log('✅ Microsoft authenticated:', result.account);
          microsoftConnected = true;
          microsoftUser = result.account.username;
          updateMicrosoftButton();
          
          // Show success
          content.innerHTML = `
            <h3>✅ Connected!</h3>
            <p>Successfully connected to Microsoft 365 as <strong>${result.account.username}</strong></p>
            <div class="ms-auth-actions">
              <button class="ms-auth-primary" onclick="closeMicrosoftModal()" style="width: 100%;">Done</button>
            </div>
          `;
          
          setTimeout(() => {
            closeMicrosoftModal();
          }, 2000);
        } else {
          throw new Error(result.error || 'Authentication failed');
        }
      } catch (error) {
        console.error('❌ Microsoft authentication failed:', error);
        
        // Show error
        const content = document.querySelector('.ms-auth-content');
        content.innerHTML = `
          <h3>❌ Authentication Failed</h3>
          <p style="color: #ef4444;">${error.message}</p>
          <div class="ms-auth-actions">
            <button class="ms-auth-secondary" onclick="closeMicrosoftModal()">Close</button>
            <button class="ms-auth-primary" onclick="authenticateMicrosoft()">Try Again</button>
          </div>
        `;
      }
    }

    function updateMicrosoftButton() {
      const btn = document.getElementById('msAuthBtn');
      if (microsoftConnected) {
        btn.classList.add('connected');
        btn.title = `Microsoft 365 Connected (${microsoftUser}) - Click to disconnect`;
      } else {
        btn.classList.remove('connected');
        btn.title = 'Connect Microsoft 365';
      }
    }

    // Check Microsoft connection on load
    async function checkMicrosoftConnection() {
      try {
        if (window.electronAPI?.microsoft?.getUserProfile) {
          const result = await window.electronAPI.microsoft.getUserProfile();
          if (result.success) {
            microsoftConnected = true;
            microsoftUser = result.user.mail || result.user.userPrincipalName;
            updateMicrosoftButton();
            console.log('✅ Microsoft 365 already connected:', microsoftUser);
          }
        }
      } catch (error) {
        // Not connected, that's fine
        console.log('ℹ️ Microsoft 365 not connected');
      }
    }

    // Check connection when app loads
    setTimeout(checkMicrosoftConnection, 1000);
```

---

## Summary

This implementation adds:
1. ✅ Microsoft API exposure in preload script
2. ✅ Beautiful Microsoft 365 button with status indicator
3. ✅ Modal dialog for authentication
4. ✅ Auto-detection of existing connection
5. ✅ Visual feedback (green dot when connected)
6. ✅ Smooth animations and transitions

The button will appear next to the Fact Check button in the header bar!
