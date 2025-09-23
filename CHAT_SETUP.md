# HeyJarvis Chat System Setup Guide

This guide will help you set up the complete OAuth flow with state persistence and chat storage using Supabase.

## 🎯 Flow Overview

1. **User logs in via Slack** → OAuth authorization
2. **User hits allow** → Slack redirects to callback
3. **User is directed to chat interface** → Authenticated chat experience
4. **State persistence** → User sessions and chat history saved in Supabase

## 🚀 Quick Start

### 1. Environment Variables

Create a `.env` file in your project root with:

```bash
# Slack OAuth Configuration
SLACK_CLIENT_ID=your_slack_client_id
SLACK_CLIENT_SECRET=your_slack_client_secret
SLACK_REDIRECT_URI=https://your-domain.vercel.app/api/auth/slack/callback

# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_supabase_anon_key

# JWT Secret for session management
JWT_SECRET=your-super-secret-jwt-key-here
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Set Up Supabase Database

1. Go to your Supabase project dashboard
2. Navigate to SQL Editor
3. Run the complete schema from `data/storage/supabase-schema.sql`

This will create:
- User management tables
- Chat conversation and message tables
- Session management
- Row Level Security policies
- Real-time subscriptions

### 4. Deploy to Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod
```

## 📁 File Structure

```
/api/
  /auth/
    /slack/
      /callback/
        index.js          # OAuth callback handler
    /refresh/
      index.js            # Token refresh endpoint
    /logout/
      index.js            # Logout endpoint
  /middleware/
    auth.js               # Authentication middleware
  /chat/
    index.js              # Chat API endpoints

/data/
  /storage/
    supabase-client.js    # Supabase client with chat methods
    supabase-schema.sql   # Complete database schema
  /models/
    user.schema.js        # User data models

chat.html                 # Chat interface
```

## 🔐 Authentication Flow

### 1. Slack OAuth
- User clicks "Login with Slack"
- Redirected to Slack OAuth
- Slack redirects back to `/api/auth/slack/callback`
- User data stored in Supabase
- JWT session token generated
- User redirected to chat interface

### 2. Session Management
- JWT tokens stored in localStorage
- Session validation on each API call
- Automatic token refresh
- Session cleanup for expired tokens

### 3. Protected Routes
- All chat APIs require authentication
- User can only access their own data
- Rate limiting per user

## 💬 Chat Features

### Conversation Management
- Create new conversations
- List user conversations
- Archive conversations
- Auto-generate titles

### Message Storage
- Real-time message saving
- Message history persistence
- Support for different message types
- Token usage tracking

### Real-time Updates
- Supabase real-time subscriptions
- Live message updates
- Conversation list updates

## 🛠️ API Endpoints

### Authentication
- `GET /api/auth/slack` - Initiate Slack OAuth
- `GET /api/auth/slack/callback` - OAuth callback
- `POST /api/auth/refresh` - Refresh session token
- `POST /api/auth/logout` - Logout and invalidate session

### Chat
- `GET /api/chat?action=conversations` - Get user conversations
- `GET /api/chat?action=conversation&conversation_id=X` - Get conversation with messages
- `POST /api/chat` - Create conversation or send message
- `PUT /api/chat` - Update conversation (title, etc.)
- `DELETE /api/chat` - Archive conversation

## 🎨 Chat Interface

The chat interface (`chat.html`) includes:

- **Sidebar**: User profile, conversation list, new chat button
- **Main Chat**: Messages, input field, typing indicators
- **Real-time Updates**: Live message delivery
- **Mobile Responsive**: Works on all devices
- **Dark Theme**: Modern, professional design

## 🔧 Configuration Options

### User Context
Users can be configured with:
- Role (executive, product_manager, etc.)
- Department and seniority
- Notification preferences
- Work schedule
- Integration settings

### Chat Settings
- Message retention policies
- Model selection (Claude, GPT, etc.)
- Token usage limits
- Real-time subscriptions

## 🚦 Next Steps

1. **Set up environment variables**
2. **Run Supabase schema setup**
3. **Test OAuth flow**
4. **Deploy to Vercel**
5. **Configure Slack app with redirect URI**

## 🔍 Testing

### Local Development
```bash
# Start local development server
npm run dev

# Test OAuth flow
# Visit: http://localhost:3000
```

### Production Testing
1. Deploy to Vercel
2. Update Slack app redirect URI
3. Test complete flow:
   - Login with Slack
   - Create conversation
   - Send messages
   - Verify persistence

## 🛡️ Security Features

- Row Level Security (RLS) in Supabase
- JWT token validation
- Session expiration
- Rate limiting
- CORS protection
- Input validation

## 📊 Monitoring

- Winston logging throughout
- Session tracking
- Message analytics
- Error reporting
- Performance monitoring

## 🆘 Troubleshooting

### Common Issues

1. **OAuth fails**: Check Slack app configuration and redirect URI
2. **Database errors**: Verify Supabase credentials and schema
3. **Session issues**: Check JWT secret and token validation
4. **Chat not loading**: Verify authentication and API endpoints

### Debug Mode

Enable debug logging by setting:
```bash
LOG_LEVEL=debug
```

## 🎉 You're Ready!

Your HeyJarvis chat system is now set up with:
- ✅ Slack OAuth authentication
- ✅ Persistent user sessions
- ✅ Chat conversation storage
- ✅ Real-time messaging
- ✅ Mobile-responsive interface
- ✅ Enterprise-ready security

Start chatting and building amazing AI-powered conversations!
