# Vercel Environment Variables Setup

To enable OAuth authentication on your deployed HeyJarvis platform, you need to configure these environment variables in your Vercel dashboard:

## 🔐 Required Environment Variables

Go to your Vercel project settings → Environment Variables and add:

### Slack OAuth Configuration
```
SLACK_CLIENT_ID=your_slack_client_id_here
SLACK_CLIENT_SECRET=your_slack_client_secret_here
SLACK_BOT_TOKEN=xoxb-your-bot-token-here
SLACK_SIGNING_SECRET=your_signing_secret_here
```

### OAuth Redirect Configuration
```
SLACK_REDIRECT_URI=https://beach-baby-vk73.vercel.app/api/auth/slack/callback
```

## 📝 How to Get Slack Credentials

1. **Go to Slack API**: Visit [api.slack.com/apps](https://api.slack.com/apps)
2. **Select/Create App**: Choose your HeyJarvis app or create a new one
3. **Get Credentials**:
   - **Client ID**: Basic Information → App Credentials → Client ID
   - **Client Secret**: Basic Information → App Credentials → Client Secret  
   - **Bot Token**: OAuth & Permissions → Bot User OAuth Token
   - **Signing Secret**: Basic Information → App Credentials → Signing Secret

## 🔧 Configure Slack App Settings

### OAuth & Permissions → Redirect URLs
Add this redirect URL to your Slack app:
```
https://beach-baby-vk73.vercel.app/api/auth/slack/callback
```

### OAuth & Permissions → User Token Scopes
Add these scopes for comprehensive access:
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

## 🚀 After Configuration

Once you've added the environment variables and redeployed:

1. **Visit**: [https://beach-baby-vk73.vercel.app/](https://beach-baby-vk73.vercel.app/)
2. **Click**: "🔐 Connect with Slack" button
3. **Authorize**: Grant permissions to HeyJarvis
4. **Success**: You'll see a confirmation page with your user details

## 🔍 Testing the OAuth Flow

1. **Initiate**: `/api/auth/slack` - Redirects to Slack OAuth
2. **Callback**: `/api/auth/slack/callback` - Handles OAuth response
3. **Success**: Beautiful success page with user information
4. **Error**: Helpful error page if something goes wrong

## 🛠️ Troubleshooting

### "OAuth not configured" error
- Verify environment variables are set in Vercel
- Check that variable names match exactly
- Redeploy after adding environment variables

### "OAuth exchange failed" error  
- Verify Client Secret is correct
- Check that redirect URI matches exactly in Slack app settings
- Ensure Slack app has proper scopes configured

### Redirect URI mismatch
- Make sure Slack app redirect URI is exactly:
  `https://beach-baby-vk73.vercel.app/api/auth/slack/callback`
- No trailing slashes or extra parameters

## 🎯 Next Steps

After successful OAuth setup:
- Users can authenticate with their Slack accounts
- HeyJarvis can access their message history (with permission)
- Enable competitive intelligence monitoring
- Deploy additional features like CEO dashboard commands

Your HeyJarvis platform will be fully functional for Slack-based competitive intelligence once these environment variables are configured! 🚀
