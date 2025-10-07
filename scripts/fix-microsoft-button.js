#!/usr/bin/env node

/**
 * Fix Microsoft 365 button by adding the missing JavaScript
 */

const fs = require('fs');
const path = require('path');

const HTML_FILE = path.join(__dirname, '../desktop/renderer/unified.html');

console.log('🔧 Fixing Microsoft 365 button JavaScript...\n');

let htmlContent = fs.readFileSync(HTML_FILE, 'utf8');

// Check if functions already exist
if (htmlContent.includes('function toggleMicrosoftAuth')) {
  console.log('✅ Microsoft JavaScript already exists!');
  process.exit(0);
}

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

// Add the JavaScript before the closing </script> tag
htmlContent = htmlContent.replace(
  /    \}\);[\s\S]*?  <\/script>/,
  (match) => {
    // Find the last }); before </script>
    const lastBrace = match.lastIndexOf('});');
    return match.substring(0, lastBrace + 4) + '\n' + jsCode + '\n  </script>';
  }
);

fs.writeFileSync(HTML_FILE, htmlContent);

console.log('✅ Microsoft JavaScript added successfully!');
console.log('\n📝 Next steps:');
console.log('   1. Restart HeyJarvis');
console.log('   2. Click the Microsoft button');
console.log('   3. Authenticate!\n');
