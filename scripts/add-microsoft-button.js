#!/usr/bin/env node

/**
 * Script to add Microsoft 365 button to HeyJarvis interface
 */

const fs = require('fs');
const path = require('path');

const PRELOAD_FILE = path.join(__dirname, '../desktop/bridge/copilot-preload.js');
const HTML_FILE = path.join(__dirname, '../desktop/renderer/unified.html');

console.log('🚀 Adding Microsoft 365 button to HeyJarvis...\n');

// 1. Update preload script
console.log('📝 Step 1: Updating preload script...');
let preloadContent = fs.readFileSync(PRELOAD_FILE, 'utf8');

const microsoftAPI = `
  // Microsoft 365 API
  microsoft: {
    authenticate: () => ipcRenderer.invoke('microsoft:authenticate'),
    createEvent: (eventData) => ipcRenderer.invoke('microsoft:createEvent', eventData),
    sendEmail: (emailData) => ipcRenderer.invoke('microsoft:sendEmail', emailData),
    executeWorkflowActions: (workflow, userEmails) => ipcRenderer.invoke('microsoft:executeWorkflowActions', workflow, userEmails),
    findMeetingTimes: (attendees, durationMinutes, options) => ipcRenderer.invoke('microsoft:findMeetingTimes', attendees, durationMinutes, options),
    getUserProfile: () => ipcRenderer.invoke('microsoft:getUserProfile')
  },
`;

if (!preloadContent.includes('microsoft:')) {
  // Add after tasks API
  preloadContent = preloadContent.replace(
    /  \/\/ Copilot API\n  copilot: \{/,
    `${microsoftAPI}\n  // Copilot API\n  copilot: {`
  );
  fs.writeFileSync(PRELOAD_FILE, preloadContent);
  console.log('✅ Preload script updated');
} else {
  console.log('⏭️  Microsoft API already exists in preload script');
}

// 2. Update HTML file
console.log('\n📝 Step 2: Updating HTML file...');
let htmlContent = fs.readFileSync(HTML_FILE, 'utf8');

// Add CSS
const cssStyles = `
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
      animation: msPulse 2s ease-in-out infinite;
    }

    @keyframes msPulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.6; }
    }

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

    @keyframes msSpinAnimation {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
`;

if (!htmlContent.includes('.ms-auth-btn')) {
  htmlContent = htmlContent.replace(
    /    \.notification-badge \{[\s\S]*?\n    \}/,
    (match) => match + '\n' + cssStyles
  );
  console.log('✅ CSS styles added');
} else {
  console.log('⏭️  Microsoft CSS already exists');
}

// Add button HTML
const buttonHTML = `      <button class="ms-auth-btn" id="msAuthBtn" onclick="toggleMicrosoftAuth()" title="Microsoft 365">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M11.4 24H0V12.6h11.4V24zM24 24H12.6V12.6H24V24zM11.4 11.4H0V0h11.4v11.4zm12.6 0H12.6V0H24v11.4z"/>
        </svg>
        <span class="ms-status-dot"></span>
      </button>
`;

if (!htmlContent.includes('msAuthBtn')) {
  htmlContent = htmlContent.replace(
    /(<button class="header-action-btn" onclick="startFactCheck\(\)" title="Fact Check">[\s\S]*?<\/button>)/,
    (match) => match + '\n' + buttonHTML
  );
  console.log('✅ Button HTML added');
} else {
  console.log('⏭️  Microsoft button already exists');
}

// Add modal HTML
const modalHTML = `
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
`;

if (!htmlContent.includes('msAuthModal')) {
  htmlContent = htmlContent.replace(
    /<\/body>/,
    modalHTML + '\n</body>'
  );
  console.log('✅ Modal HTML added');
} else {
  console.log('⏭️  Microsoft modal already exists');
}

// Add JavaScript
const jsCode = `
    // ===== MICROSOFT 365 AUTHENTICATION =====
    let microsoftConnected = false;
    let microsoftUser = null;

    async function toggleMicrosoftAuth() {
      if (microsoftConnected) {
        const confirmed = confirm(\`Disconnect from Microsoft 365 (\${microsoftUser})?\`);
        if (confirmed) {
          microsoftConnected = false;
          microsoftUser = null;
          updateMicrosoftButton();
        }
      } else {
        document.getElementById('msAuthModal').classList.add('show');
      }
    }

    function closeMicrosoftModal() {
      document.getElementById('msAuthModal').classList.remove('show');
    }

    async function authenticateMicrosoft() {
      try {
        console.log('🔐 Starting Microsoft authentication...');
        const modal = document.getElementById('msAuthModal');
        const content = modal.querySelector('.ms-auth-content');
        content.innerHTML = \`
          <h3>Authenticating...</h3>
          <p style="text-align: center;">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="animation: msSpinAnimation 1s linear infinite;">
              <circle cx="12" cy="12" r="10"></circle>
              <path d="M12 6v6l4 2"></path>
            </svg>
          </p>
          <p>Opening your browser for authentication...</p>
        \`;
        
        const result = await window.electronAPI.microsoft.authenticate();
        
        if (result.success) {
          console.log('✅ Microsoft authenticated:', result.account);
          microsoftConnected = true;
          microsoftUser = result.account.username;
          updateMicrosoftButton();
          
          content.innerHTML = \`
            <h3>✅ Connected!</h3>
            <p>Successfully connected to Microsoft 365 as <strong>\${result.account.username}</strong></p>
            <div class="ms-auth-actions">
              <button class="ms-auth-primary" onclick="closeMicrosoftModal()" style="width: 100%;">Done</button>
            </div>
          \`;
          
          setTimeout(() => closeMicrosoftModal(), 2000);
        } else {
          throw new Error(result.error || 'Authentication failed');
        }
      } catch (error) {
        console.error('❌ Microsoft authentication failed:', error);
        const content = document.querySelector('.ms-auth-content');
        content.innerHTML = \`
          <h3>❌ Authentication Failed</h3>
          <p style="color: #ef4444;">\${error.message}</p>
          <div class="ms-auth-actions">
            <button class="ms-auth-secondary" onclick="closeMicrosoftModal()">Close</button>
            <button class="ms-auth-primary" onclick="authenticateMicrosoft()">Try Again</button>
          </div>
        \`;
      }
    }

    function updateMicrosoftButton() {
      const btn = document.getElementById('msAuthBtn');
      if (microsoftConnected) {
        btn.classList.add('connected');
        btn.title = \`Microsoft 365 Connected (\${microsoftUser}) - Click to disconnect\`;
      } else {
        btn.classList.remove('connected');
        btn.title = 'Connect Microsoft 365';
      }
    }

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
        console.log('ℹ️ Microsoft 365 not connected');
      }
    }

    setTimeout(checkMicrosoftConnection, 1000);
`;

if (!htmlContent.includes('toggleMicrosoftAuth')) {
  htmlContent = htmlContent.replace(
    /    }\);[\s\S]*?<\/script>/,
    (match) => match.replace('</script>', jsCode + '\n  </script>')
  );
  console.log('✅ JavaScript code added');
} else {
  console.log('⏭️  Microsoft JavaScript already exists');
}

// Write updated HTML
fs.writeFileSync(HTML_FILE, htmlContent);

console.log('\n✅ Microsoft 365 button successfully added!');
console.log('\n📝 Next steps:');
console.log('   1. Restart HeyJarvis: npm run dev:desktop');
console.log('   2. Look for the Microsoft button next to the Fact Check button');
console.log('   3. Click it to authenticate!\n');
