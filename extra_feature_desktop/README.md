# Team Sync Intelligence

An AI-powered system that helps teams stay connected and up-to-date through intelligent meeting summaries, task aggregation, and conversational Q&A.

![Team Sync Intelligence](./assets/icon.png)

## 🎯 Features

### 📅 Smart Meeting Intelligence
- **Automatic Importance Detection**: AI analyzes meeting titles, descriptions, and attendees to suggest which meetings matter most
- **Meeting Summaries**: Upload notes or use Microsoft Copilot to generate AI-powered summaries with key decisions and action items
- **Calendar Integration**: Connects directly to Microsoft Outlook to fetch your upcoming meetings

### 🎯 Task & Code Aggregation
- **JIRA Integration**: Automatically fetches and displays your assigned tasks with status updates
- **GitHub Activity**: Tracks recent pull requests and commits from your repositories
- **Smart Linking**: Automatically links GitHub commits to JIRA tickets by detecting ticket keys

### 💬 Intelligent Q&A Chat
- **Contextual Answers**: Ask questions about recent meetings, tasks, and code changes
- **Source Citations**: Every answer includes references to the specific meetings, JIRA tickets, or GitHub activity
- **Team Intelligence**: Enables async teams to catch up on what they missed

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ and npm 8+
- Supabase account (for database)
- Microsoft 365 account (for Outlook integration)
- JIRA account (optional)
- GitHub account (optional)
- Anthropic API key (for AI features)

### Installation

1. **Clone the repository** (if you haven't already):
   ```bash
   cd /home/sdalal/test/BeachBaby/extra_feature_desktop
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Set up environment variables**:
   
   The app uses the shared `.env` file in the project root. Ensure these variables are set:
   ```env
   # Microsoft Integration
   MICROSOFT_CLIENT_ID=your_client_id
   MICROSOFT_CLIENT_SECRET=your_client_secret
   MICROSOFT_REDIRECT_URI=http://localhost:8889/auth/microsoft/callback

   # JIRA Integration (optional)
   JIRA_CLIENT_ID=your_client_id
   JIRA_CLIENT_SECRET=your_client_secret
   JIRA_REDIRECT_URI=http://localhost:8890/auth/jira/callback

   # GitHub Integration (optional)
   GITHUB_APP_ID=your_app_id
   GITHUB_APP_INSTALLATION_ID=your_installation_id
   GITHUB_APP_PRIVATE_KEY_PATH=/path/to/private-key.pem

   # AI Integration
   ANTHROPIC_API_KEY=your_anthropic_api_key

   # Supabase Database
   SUPABASE_URL=your_supabase_url
   SUPABASE_ANON_KEY=your_anon_key
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
   ```

4. **Set up Supabase database**:
   
   - Go to your Supabase project dashboard
   - Navigate to SQL Editor
   - Copy and run the migration from `migrations/001_team_sync_tables.sql`
   - Verify tables are created: `team_meetings`, `team_updates`, `team_context_index`

5. **Run the application**:
   ```bash
   npm run dev
   ```

   This will start:
   - Vite dev server on `http://localhost:5174`
   - Electron app with hot reload

## 📖 Usage Guide

### 1. Dashboard

The dashboard provides an overview of all recent activity:
- **Stats Cards**: Quick metrics on meetings, JIRA updates, and GitHub activity
- **Recent Meetings**: Shows important meetings with AI summaries
- **Recent Updates**: Timeline of JIRA and GitHub changes

**Actions**:
- Click "Sync Now" to fetch latest data from all integrations

### 2. Meetings

Manage your meetings and generate summaries:

**Upcoming Meetings Tab**:
- View all meetings from your Outlook calendar
- AI importance score (0-100) shown for each meeting
- Mark meetings as "Important" to track them
- Add notes manually (paste meeting transcripts or type notes)
- AI automatically generates summaries from your notes

**Summaries Tab**:
- View all meetings with generated summaries
- See key decisions, action items, and topics discussed
- Click any meeting to view full summary details

**Meeting Summary View**:
- Full meeting details with attendees
- AI-generated summary
- Key decisions list
- Action items (checkboxes for tracking)
- Topics discussed (tags)
- Full meeting notes

### 3. Team Chat

Ask questions about your team's work:

**Suggested Questions**:
- "What did we decide in the last sprint planning?"
- "What's the latest on the design system?"
- "Show me recent JIRA updates"
- "What PRs were merged this week?"
- "Summarize recent team meetings"

**Features**:
- Conversational interface
- AI searches through meetings, JIRA, and GitHub
- Answers include source citations
- Context indicators show which data sources were used
- Chat history is preserved

### 4. Settings

Configure your integrations and preferences:

**Integrations**:
- Connect/disconnect Microsoft Outlook, JIRA, and GitHub
- Visual status indicators for each integration

**Meeting Detection**:
- Enable/disable smart detection
- Set minimum importance score threshold

**Sync Settings**:
- Enable auto-sync (every 30 minutes)
- Configure sync history depth (7-60 days)

## 🏗️ Architecture

### Backend (Main Process)

**Services**:
- `MeetingIntelligenceService`: Manages calendar events and meeting summaries
- `TaskCodeIntelligenceService`: Aggregates JIRA and GitHub updates
- `TeamContextEngine`: Powers the AI Q&A chat
- `TeamSyncSupabaseAdapter`: Handles all database operations

**IPC Handlers**:
- `meeting-handlers.js`: Meeting operations
- `intelligence-handlers.js`: Q&A chat
- `sync-handlers.js`: Data synchronization

**Smart Meeting Detection Algorithm**:
```javascript
Base Score: 50
+ High-priority keywords (standup, sprint, planning, etc.): +30
- Low-priority keywords (1:1, social, etc.): -20
+ 5+ attendees: +20
+ 10+ attendees: +10
+ Recurring meetings: +10
+ Online meeting link: +5
= Final Score (0-100)
```

### Frontend (Renderer Process)

**Pages**:
- `Dashboard.jsx`: Overview with stats and recent activity
- `Meetings.jsx`: Meeting management and summaries
- `TeamChat.jsx`: AI-powered Q&A interface
- `Settings.jsx`: Integration and preference management

**Components**:
- `UpdatesFeed`: Displays JIRA and GitHub updates
- `MeetingSelector`: Smart meeting picker
- `MeetingSummary`: Full meeting summary view
- `ChatInterface`: Message input for Q&A

### Database Schema

**`team_meetings`**:
- Stores meeting data with AI summaries
- Fields: title, start_time, attendees, is_important, ai_summary, key_decisions, action_items

**`team_updates`**:
- Aggregates JIRA issues and GitHub PRs/commits
- Fields: update_type, external_id, title, author, status, linked_jira_key

**`team_context_index`**:
- Search index for AI Q&A (future semantic search with pgvector)

## 🔒 Security

- **OAuth 2.0**: All integrations use secure OAuth flows
- **Supabase RLS**: Row-level security ensures users only access their data
- **Service Role**: Desktop app uses service role for privileged operations
- **IPC Security**: Context isolation and preload scripts prevent code injection

## 🛠️ Development

### Project Structure

```
extra_feature_desktop/
├── main/                    # Electron main process
│   ├── index.js            # Entry point
│   ├── services/           # Backend services
│   └── ipc/                # IPC handlers
├── renderer/               # React frontend
│   ├── src/
│   │   ├── pages/         # Main pages
│   │   ├── components/    # Reusable components
│   │   └── styles/        # CSS files
│   └── index.html
├── bridge/                 # Electron IPC bridge
│   └── preload.js
├── migrations/             # Database migrations
└── package.json
```

### Scripts

```bash
npm run dev              # Start dev environment
npm run dev:renderer     # Start Vite only
npm run dev:electron     # Start Electron only
npm run build            # Build for production
npm run build:renderer   # Build React app
npm run build:electron   # Build Electron app
```

### Adding New Features

1. **Backend Service**: Create in `main/services/`
2. **IPC Handler**: Add handlers in `main/ipc/`
3. **Preload API**: Expose in `bridge/preload.js`
4. **Frontend Component**: Create in `renderer/src/components/` or `pages/`
5. **Styling**: Add CSS file alongside component

## 🧪 Testing

### Manual Testing Checklist

- [ ] Microsoft Outlook connection
- [ ] Fetch upcoming meetings
- [ ] Mark meeting as important
- [ ] Upload manual notes
- [ ] Generate AI summary
- [ ] View meeting summary details
- [ ] JIRA integration (fetch issues)
- [ ] GitHub integration (fetch PRs and commits)
- [ ] Sync all updates
- [ ] Ask questions in chat
- [ ] View source citations
- [ ] Clear chat history
- [ ] Settings page integrations
- [ ] Dashboard stats update

### Known Limitations

1. **Microsoft Copilot**: API integration not yet implemented (requires Copilot license)
2. **Semantic Search**: Using keyword search; pgvector integration planned for future
3. **Auth Flow**: Currently using mock user; full auth system to be added
4. **Real-time Updates**: Manual sync required; auto-sync planned

## 🚀 Future Enhancements

### Phase 2 Features
- [ ] Slack/Teams integration for notifications
- [ ] Weekly email digest
- [ ] Automatic action item tracking
- [ ] Voice-to-text for note upload
- [ ] Meeting recording integration (Teams/Zoom)

### Phase 3 Features
- [ ] Mobile companion app
- [ ] Advanced semantic search with pgvector
- [ ] Cross-team collaboration analytics
- [ ] Custom AI prompts and templates
- [ ] Export reports (PDF/Markdown)

## 📄 License

This project is part of the HeyJarvis platform.

## 🤝 Contributing

This is an internal project. For questions or issues, contact the development team.

## 📞 Support

For help or feature requests:
1. Check this README and migration docs
2. Review the plan document: `team-sync-intelligence.plan.md`
3. Contact the development team

---

**Built with:** Electron, React, Vite, Claude AI, Supabase, Microsoft Graph API, JIRA API, GitHub API


