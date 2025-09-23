# Production OAuth System Setup Instructions

## 🚀 Quick Start Guide

### Step 1: Environment Configuration

1. **Copy environment template**:
   ```bash
   cp .env.oauth.example .env
   ```

2. **Get Slack App Credentials**:
   - Go to [api.slack.com/apps](https://api.slack.com/apps)
   - Select your HeyJarvis app
   - Get these values:
     - `SLACK_CLIENT_ID`: Basic Information → App Credentials → Client ID
     - `SLACK_CLIENT_SECRET`: Basic Information → App Credentials → Client Secret
     - `SLACK_BOT_TOKEN`: OAuth & Permissions → Bot User OAuth Token
     - `SLACK_SIGNING_SECRET`: Basic Information → App Credentials → Signing Secret

3. **Configure OAuth Scopes**:
   In your Slack App settings → OAuth & Permissions → User Token Scopes, add:
   ```
   channels:history    # Read public channel messages
   groups:history      # Read private channel messages  
   im:history          # Read DM messages
   mpim:history        # Read group DM messages
   users:read          # Read user information
   channels:read       # List channels
   groups:read         # List private channels
   im:read             # List DMs
   mpim:read           # List group DMs
   ```

4. **Set Redirect URI**:
   In Slack App settings → OAuth & Permissions → Redirect URLs, add:
   ```
   http://localhost:3001/auth/slack/callback
   ```

5. **Generate Encryption Key**:
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

### Step 2: Update .env File

```bash
# === REQUIRED CONFIGURATION ===
SLACK_CLIENT_ID=1234567890.1234567890
SLACK_CLIENT_SECRET=your_client_secret_here
SLACK_BOT_TOKEN=xoxb-your-bot-token-here
SLACK_SIGNING_SECRET=your_signing_secret_here

# === CEO CONFIGURATION ===
CEO_SLACK_USER_ID=U01EVR49DDX
ORGANIZATION_NAME=CIPIO

# === SECURITY ===
ENCRYPTION_KEY=your_generated_32_char_hex_key_here

# === SERVER ===
OAUTH_PORT=3001
SLACK_REDIRECT_URI=http://localhost:3001/auth/slack/callback
```

### Step 3: Install Dependencies

```bash
cd oauth
npm install @slack/web-api @slack/bolt express winston crypto
```

### Step 4: Start the System

```bash
node production-oauth-system.js
```

## 🧪 Testing Instructions

### Phase 1: System Startup
1. Run the production system
2. Verify all components start successfully
3. Check OAuth web interface at http://localhost:3001

### Phase 2: OAuth Authorization
1. **You**: Go to http://localhost:3001/auth/slack and authorize
2. **Sundeep**: Go to http://localhost:3001/auth/slack and authorize
3. Verify both users appear in authorized users list

### Phase 3: Message Collection
1. Send DMs between you and Sundeep
2. Post messages in shared channels
3. Wait for message collection to complete (~1-2 minutes)

### Phase 4: CEO Dashboard Testing
In Slack, Sundeep can use these commands:
```
/ceo-dashboard-enhanced          # Complete team overview
/team-conversations              # Communication analysis  
/task-tracking-enhanced          # Task mentions across all conversations
/user-interaction-analysis USER1_ID USER2_ID  # Analyze specific interactions
```

### Phase 5: API Testing
Test the REST API endpoints:
```bash
# System stats
curl http://localhost:3001/api/system/stats

# Authorized users
curl http://localhost:3001/api/users

# User messages
curl http://localhost:3001/api/users/YOUR_USER_ID/messages

# Conversation between users
curl http://localhost:3001/api/conversations/USER1_ID/USER2_ID
```

## 📊 Expected Results

### After Authorization
- Both users appear in OAuth dashboard
- Message collection starts automatically
- CEO gains access to enhanced commands

### After Message Collection
- DMs between you and Sundeep are captured
- Channel messages from both users are available
- Task mentions are detected across all conversation types
- CEO dashboard shows comprehensive analytics

### CEO Dashboard Features
- **Complete Visibility**: DMs, channels, groups, private conversations
- **Task Tracking**: Assignments and completions across all message types
- **User Interactions**: Detailed analysis of communication between team members
- **Team Analytics**: Communication patterns, message distribution, productivity insights

## 🔍 Verification Steps

1. **OAuth Success**: Both users show "authorized" status
2. **Message Collection**: API shows message counts > 0
3. **CEO Commands**: Enhanced commands return comprehensive data
4. **Cross-Conversation**: Task mentions detected in both DMs and channels
5. **User Interactions**: Analysis shows DMs and channel mentions between users

## 🚨 Troubleshooting

### OAuth Fails
- Check Slack app credentials in .env
- Verify redirect URI matches exactly
- Ensure user scopes are configured in Slack app

### No Messages Collected
- Verify OAuth tokens are valid
- Check user has message history to collect
- Ensure proper scopes granted during OAuth

### CEO Commands Not Working
- Verify CEO_SLACK_USER_ID matches Sundeep's actual ID
- Check bot token has necessary permissions
- Ensure CEO monitoring system started successfully

### API Returns Empty Data
- Wait for message collection to complete
- Check system logs for errors
- Verify users have authorized OAuth

## 🎯 Success Criteria

✅ **OAuth System**: Both users successfully authorized  
✅ **Message Collection**: DMs and channel messages captured  
✅ **CEO Dashboard**: Enhanced commands show comprehensive data  
✅ **Task Tracking**: Assignments detected across all conversation types  
✅ **User Analysis**: Interaction analysis between authorized users  
✅ **API Access**: REST endpoints return collected data  

## 🔐 Security Notes

- OAuth tokens are encrypted with AES-256
- Users explicitly consent to data access
- CEO access is role-based and logged
- All API access is audited
- Users can revoke access anytime via DELETE /api/users/:userId/access

## 🚀 Production Deployment

For production deployment:
1. Use HTTPS redirect URIs
2. Set strong encryption keys
3. Use production database
4. Configure proper logging
5. Set up monitoring and alerts
6. Implement rate limiting
7. Add authentication middleware

This system is now production-ready for immediate testing with real Slack OAuth delegation!
