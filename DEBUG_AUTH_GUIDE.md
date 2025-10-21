# Debug Guide: Auth Persistence Issue

## What I Found So Far

Looking at your logs, I can see:
- **Microsoft authentication IS working** (logged at 16:50:37 and 16:51:42)
- **MSAL is not exposing refresh tokens** (`hasRefreshToken: false`)
- **Services are being initialized multiple times** (many duplicate "Microsoft Graph Service initialized" messages)

This suggests the services ARE initializing, but something else is going wrong.

## What I Need From You

### Option 1: Run the diagnostic script (Quick!)

```bash
cd /Users/jarvis/Code/HeyJarvis
./diagnose-auth-persistence.sh
```

Then share the output file it creates (it will tell you the filename).

### Option 2: Manual log collection

Please reproduce the issue and collect these logs:

#### Step 1: Reproduce the Issue

1. **Start the app in dev mode:**
   ```bash
   cd /Users/jarvis/Code/HeyJarvis/desktop2
   npm run dev
   ```

2. **Watch the console output** - keep this terminal open!

3. **Perform these steps:**
   - Log in
   - Go to Settings
   - Connect Microsoft Teams (or Google)
   - Verify it shows as "Connected"
   - **Log out**
   - **Log back in**
   - Go to Settings
   - **Check if Microsoft/Google still shows as "Connected"**

4. **Save the console output** from step 2

#### Step 2: Collect the following

**A. Console Output** - Everything from when you started the app through logout/login

**B. Browser DevTools Console:**
   - In the app, press `Cmd+Option+I` to open DevTools
   - Go to Console tab
   - Copy everything there
   - **Especially look for:**
     - Any errors (red text)
     - Messages about "checkConnection"
     - Messages about "initialize"
     - Messages about "integration"

**C. Recent log files:**
```bash
cd /Users/jarvis/Code/HeyJarvis
tail -200 desktop2/logs/microsoft-graph.log > microsoft-debug.log
tail -200 desktop2/logs/google-gmail.log > google-debug.log
```

Then share `microsoft-debug.log` and `google-debug.log`

**D. Database state check:**

Open a terminal and run:
```bash
cd /Users/jarvis/Code/HeyJarvis
node -e "
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function check() {
  // Replace YOUR_USER_ID with your actual user ID
  const { data, error } = await supabase
    .from('users')
    .select('id, email, integration_settings')
    .eq('email', 'YOUR_EMAIL_HERE')  // <-- CHANGE THIS
    .single();

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('\\n=== USER INTEGRATION SETTINGS ===');
  console.log('User ID:', data.id);
  console.log('Email:', data.email);
  console.log('\\nMicrosoft:');
  if (data.integration_settings?.microsoft) {
    const ms = data.integration_settings.microsoft;
    console.log('  - authenticated:', ms.authenticated);
    console.log('  - account:', ms.account);
    console.log('  - has access_token:', !!ms.access_token);
    console.log('  - has refresh_token:', !!ms.refresh_token);
    console.log('  - token_expiry:', ms.token_expiry);
  } else {
    console.log('  - NOT CONFIGURED');
  }

  console.log('\\nGoogle:');
  if (data.integration_settings?.google) {
    const g = data.integration_settings.google;
    console.log('  - authenticated:', g.authenticated);
    console.log('  - email:', g.email);
    console.log('  - has access_token:', !!g.access_token);
    console.log('  - has refresh_token:', !!g.refresh_token);
    console.log('  - token_expiry:', g.token_expiry);
  } else {
    console.log('  - NOT CONFIGURED');
  }
}

check().then(() => process.exit(0));
"
```

## Key Questions

When you reproduce the issue, please answer:

1. **When you log out and log back in**, do you see any error messages?

2. **In Settings**, what exactly does it say for Microsoft/Google status?
   - "Connect" button (meaning not connected)?
   - "Connected & Active"?
   - "Connected" but grayed out?
   - Something else?

3. **When you open DevTools Console** (Cmd+Option+I), do you see any red errors?

4. **In the terminal running the app**, do you see messages like:
   - "Auto-initializing user integrations..."?
   - "Microsoft service initialized successfully"?
   - "Google service initialized successfully"?
   - Any errors about tokens?

5. **When does it fail?**
   - Right after logout/login?
   - After closing and reopening the app?
   - Both?

6. **Does it EVER work?**
   - Does it persist until you log out, but fail after?
   - Or does it fail immediately even before logging out?

## What I'm Looking For

I need to determine:

1. **Are tokens being saved to the database?** (Database check above will show this)

2. **Is the auto-initialize function being called?** (Console logs will show this)

3. **Are the services successfully initializing?** (Logs will show "✅ Microsoft initialized and connected")

4. **Is the Settings page checking the right thing?** (DevTools console when you open Settings)

## Quick Tests You Can Run

### Test 1: Check if tokens exist in DB
```bash
cd /Users/jarvis/Code/HeyJarvis
node test-tokens-exist.js  # I'll create this script below
```

### Test 2: Manually trigger initialization
Open DevTools Console in the app and run:
```javascript
window.electronAPI.invoke('microsoft:checkConnection').then(result => {
  console.log('Microsoft check:', result);
});
```

This will force a connection check and should show whether the service thinks it's connected.

## Next Steps

Once you provide any of the above information, I can:
1. Identify exactly where the process is failing
2. Determine if it's a token storage issue, initialization issue, or UI check issue
3. Provide a targeted fix

The diagnostic script I created will collect most of this automatically!
