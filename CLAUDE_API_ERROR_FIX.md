# Claude API "Not Found" Error Fix 🔧

## Error

```
TaskChat.jsx:593 Chat error: Error: Claude API error: Not Found
```

## Root Cause

The Claude API is returning a **404 Not Found** error, which typically means:

1. ❌ **Invalid or expired API key**
2. ❌ **API key doesn't have access to the model**
3. ❌ **Wrong API endpoint or model name**

## Current Configuration

**File**: `.env`
```bash
ANTHROPIC_API_KEY=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
```

**API Call**: `desktop2/main/services/AIService.js`
```javascript
const response = await fetch('https://api.anthropic.com/v1/messages', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': this.apiKey,
    'anthropic-version': '2023-06-01'
  },
  body: JSON.stringify({
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 4096,
    system: systemPrompt,
    messages: this.conversationHistory.slice(-10)
  })
});
```

## Fix Applied

### Enhanced Error Logging

**File**: `desktop2/main/services/AIService.js`

**Changed error handling to provide more details:**

```javascript
if (!response.ok) {
  const errorData = await response.json().catch(() => ({}));
  const errorMessage = errorData.error?.message || response.statusText;
  const errorType = errorData.error?.type || 'unknown';
  
  this.logger.error('Claude API error', {
    status: response.status,
    statusText: response.statusText,
    errorType,
    errorMessage,
    hasApiKey: !!this.apiKey,
    apiKeyPrefix: this.apiKey ? this.apiKey.substring(0, 10) + '...' : 'none'
  });
  
  throw new Error(`Claude API error (${response.status}): ${errorMessage}`);
}
```

**Benefits**:
- ✅ Shows the actual HTTP status code (404, 401, 403, etc.)
- ✅ Displays Anthropic's error message
- ✅ Logs error type for debugging
- ✅ Confirms API key is loaded (without exposing full key)

## How to Diagnose

### Step 1: Restart Server with New Error Logging

```bash
# Stop current server (Ctrl+C)
node server.js
```

### Step 2: Try Sending a Message in TaskChat

Open the desktop app and try chatting with a task. Check the server logs for:

```bash
# Look for this error output:
Claude API error {
  status: 404,  # or 401, 403, etc.
  statusText: 'Not Found',
  errorType: 'invalid_request_error',  # or 'authentication_error'
  errorMessage: 'model: claude-3-5-sonnet-20241022 not found',
  hasApiKey: true,
  apiKeyPrefix: 'sk-ant-api...'
}
```

## Common Issues & Solutions

### Issue 1: Invalid API Key (401 Unauthorized)

**Error**:
```
status: 401
errorType: 'authentication_error'
errorMessage: 'invalid x-api-key'
```

**Solution**: Get a new API key from https://console.anthropic.com/settings/keys

```bash
# Update .env
ANTHROPIC_API_KEY=sk-ant-api03-YOUR_NEW_KEY_HERE
```

---

### Issue 2: Model Not Found (404)

**Error**:
```
status: 404
errorMessage: 'model: claude-3-5-sonnet-20241022 not found'
```

**Solution**: The model name might be wrong or your account doesn't have access.

Try changing to a different model in `AIService.js`:

```javascript
// Option 1: Use older Sonnet version
model: 'claude-3-5-sonnet-20240620',

// Option 2: Use Claude 3 Opus
model: 'claude-3-opus-20240229',

// Option 3: Use Claude 3 Sonnet
model: 'claude-3-sonnet-20240229',

// Option 4: Use Claude 3 Haiku (cheapest)
model: 'claude-3-haiku-20240307',
```

---

### Issue 3: Rate Limit (429)

**Error**:
```
status: 429
errorType: 'rate_limit_error'
errorMessage: 'Rate limit exceeded'
```

**Solution**: Wait a moment and try again, or upgrade your Anthropic plan.

---

### Issue 4: API Key Not Loaded

**Error**:
```
hasApiKey: false
apiKeyPrefix: 'none'
```

**Solution**: The environment variable isn't being loaded.

**Check**:
1. Is `.env` file in the correct location? (project root)
2. Is the server reading the `.env` file?
3. Try logging the API key on startup:

```javascript
// In desktop2/main/services/AIService.js constructor
console.log('🔑 Anthropic API Key loaded:', !!apiKey);
console.log('🔑 Key prefix:', apiKey ? apiKey.substring(0, 15) + '...' : 'MISSING');
```

---

## Testing the API Key

### Quick Test Script

Create a test file to verify your API key works:

```javascript
// test-claude-api.js
const fetch = require('node-fetch');
require('dotenv').config();

async function testClaudeAPI() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  
  console.log('🔑 API Key:', apiKey ? apiKey.substring(0, 15) + '...' : 'MISSING');
  
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 100,
        messages: [{
          role: 'user',
          content: 'Say hello!'
        }]
      })
    });
    
    const data = await response.json();
    
    if (response.ok) {
      console.log('✅ API Key works!');
      console.log('Response:', data.content[0].text);
    } else {
      console.log('❌ API Error:', response.status, response.statusText);
      console.log('Error details:', data);
    }
  } catch (error) {
    console.log('❌ Request failed:', error.message);
  }
}

testClaudeAPI();
```

**Run it**:
```bash
node test-claude-api.js
```

---

## Valid Anthropic API Key Format

Anthropic API keys should look like:
```
sk-ant-api03-XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
```

**Parts**:
- `sk-ant-` - Prefix (secret key, Anthropic)
- `api03-` - API version
- Long alphanumeric string (base64-like)
- Ends with `AA` typically

**Your key** (from .env):
```
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
```

This looks valid! But it might be:
- ❌ Expired
- ❌ Revoked
- ❌ From a different project
- ❌ Doesn't have access to the model

---

## Next Steps

1. **Restart the server** to load the improved error logging
2. **Try sending a message** in TaskChat
3. **Check the server logs** for the detailed error
4. **Based on the error**:
   - If 401: Get a new API key
   - If 404: Try a different model name
   - If 429: Wait or upgrade plan
   - If key not loaded: Check .env file location

---

## Alternative: Use OpenAI Instead

If Anthropic API continues to have issues, you can switch to OpenAI's GPT-4:

**File**: `desktop2/main/services/AIService.js`

```javascript
// Change the fetch call to:
const response = await fetch('https://api.openai.com/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
  },
  body: JSON.stringify({
    model: 'gpt-4-turbo-preview',
    max_tokens: 4096,
    messages: [
      { role: 'system', content: systemPrompt },
      ...this.conversationHistory.slice(-10)
    ]
  })
});

const data = await response.json();
let assistantMessage = data.choices[0].message.content;
```

**Add to .env**:
```bash
OPENAI_API_KEY=sk-your-openai-key-here
```

---

**Status**: 🔧 Enhanced error logging added. Restart server and check logs for detailed error information.

