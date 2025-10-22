# 🏗️ Power Automate Transcript System Architecture

## Complete Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                     MICROSOFT TEAMS MEETING                         │
│                                                                     │
│  👥 Meeting Participants                                           │
│  🎙️  Recording + Transcription Enabled                            │
│  📝 Meeting Content (Audio + Video)                                │
└─────────────────────┬───────────────────────────────────────────────┘
                      │
                      │ Meeting Ends
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────────┐
│              MICROSOFT TEAMS PROCESSING (15-30 min)                 │
│                                                                     │
│  🤖 AI Transcription Service                                       │
│     - Speech-to-Text conversion                                    │
│     - Speaker identification                                       │
│     - Timestamp generation                                         │
│     - VTT format creation                                          │
│                                                                     │
│  🧠 Copilot Processing (if Premium)                                │
│     - Meeting summary                                              │
│     - Action items extraction                                      │
│     - Key topics identification                                    │
└─────────────────────┬───────────────────────────────────────────────┘
                      │
                      │ Transcript Ready
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    MICROSOFT GRAPH API                              │
│                                                                     │
│  📊 Available Endpoints:                                           │
│                                                                     │
│  GET /me/onlineMeetings/{meetingId}/transcripts                    │
│  └─> Returns list of available transcripts                        │
│                                                                     │
│  GET /me/onlineMeetings/{meetingId}/transcripts/{transcriptId}     │
│  └─> Returns transcript metadata + Copilot insights               │
│                                                                     │
│  GET .../transcripts/{transcriptId}/content?$format=text/vtt       │
│  └─> Returns VTT transcript with timestamps & speakers            │
└─────────────────────┬───────────────────────────────────────────────┘
                      │
                      │ Power Automate Polls Every 30 Minutes
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     POWER AUTOMATE FLOW                             │
│                                                                     │
│  ⏰ Trigger: Recurrence (Every 30 minutes)                         │
│                                                                     │
│  Step 1: Get Recent Calendar Events                                │
│  └─> GET /me/calendar/calendarView                                │
│       Filter: Last 24 hours, Online meetings only                  │
│                                                                     │
│  Step 2: For Each Meeting                                          │
│  ├─> Extract online meeting ID from URL                           │
│  ├─> Check if already processed (avoid duplicates)                │
│  └─> If not processed:                                            │
│                                                                     │
│      Step 3: Get Available Transcripts                             │
│      └─> GET /onlineMeetings/{id}/transcripts                     │
│                                                                     │
│      Step 4: If Transcript Exists                                  │
│      ├─> Get transcript content (VTT format)                      │
│      ├─> Get Copilot notes (if available)                         │
│      └─> Create file in OneDrive                                  │
│                                                                     │
│  Step 5: Mark as Processed                                         │
│  └─> Add meeting ID to processed list                             │
└─────────────────────┬───────────────────────────────────────────────┘
                      │
                      │ Saves VTT File
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    ONEDRIVE FOR BUSINESS                            │
│                                                                     │
│  📁 /Recordings/                                                   │
│     ├─ Weekly Standup-Transcript-2025-10-22-1430.vtt              │
│     ├─ Client Review-Transcript-2025-10-22-1530.vtt               │
│     ├─ Team Planning-Transcript-2025-10-22-1630.vtt               │
│     └─ Project Sync-Transcript-2025-10-23-0900.vtt                │
│                                                                     │
│  📄 File Format: VTT (WebVTT)                                      │
│     WEBVTT                                                         │
│                                                                     │
│     00:00:01.000 --> 00:00:05.000                                  │
│     <v Speaker 1>Welcome everyone to today's meeting.</v>          │
│                                                                     │
│     00:00:05.500 --> 00:00:10.000                                  │
│     <v Speaker 2>Thanks for having me. Let's discuss...</v>        │
└─────────────────────┬───────────────────────────────────────────────┘
                      │
                      │ App Syncs Every 15 Minutes
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────────┐
│            TEAM SYNC INTELLIGENCE APP (Your App)                    │
│                                                                     │
│  🔄 Background Sync Service (Every 15 minutes)                     │
│                                                                     │
│  Step 1: Sync Meetings from Calendar                               │
│  └─> StandaloneMicrosoftService.syncMeetings()                    │
│       - Fetches calendar events                                    │
│       - Stores in team_meetings table                              │
│       - Extracts online meeting IDs                                │
│                                                                     │
│  Step 2: Try Graph API First                                       │
│  └─> AutomatedTranscriptService.fetchTranscriptForMeeting()       │
│       - Attempts direct Graph API call                             │
│       - Gets VTT + Copilot notes                                   │
│                                                                     │
│  Step 3: Fallback to OneDrive (If Graph API fails)                │
│  └─> AutomatedTranscriptService._fetchFromOneDrive()              │
│       - Searches /Recordings folder                                │
│       - Filters for .vtt, .txt, .docx, .srt files                 │
│       - Matches by meeting title                                   │
│       - Downloads file content                                     │
│                                                                     │
│  Step 4: Parse and Store                                           │
│  ├─> Parse VTT format                                             │
│  ├─> Extract speakers and timestamps                              │
│  ├─> Store in metadata.transcript                                 │
│  └─> Store Copilot notes in metadata.copilot_notes               │
└─────────────────────┬───────────────────────────────────────────────┘
                      │
                      │ Saves to Database
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    SUPABASE DATABASE                                │
│                                                                     │
│  📊 Table: team_meetings                                           │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │ meeting_id  | uuid (primary key)                           │  │
│  │ user_id     | uuid (foreign key)                           │  │
│  │ title       | "Weekly Standup"                             │  │
│  │ start_time  | 2025-10-22 14:30:00                          │  │
│  │ end_time    | 2025-10-22 15:00:00                          │  │
│  │ metadata    | jsonb {                                      │  │
│  │             |   online_meeting_id: "abc123...",            │  │
│  │             |   transcript: "WEBVTT\n\n00:00:01...",       │  │
│  │             |   transcript_id: "xyz789...",                │  │
│  │             |   transcript_fetched_at: "2025-10-22...",    │  │
│  │             |   copilot_notes: {                           │  │
│  │             |     summary: "Team discussed...",            │  │
│  │             |     action_items: [...],                     │  │
│  │             |     key_topics: [...]                        │  │
│  │             |   }                                          │  │
│  │             | }                                            │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  🔍 Indexed for Fast Searching:                                    │
│  - Full-text search on metadata.transcript                         │
│  - GIN index on metadata jsonb                                     │
│  - User-specific queries                                           │
└─────────────────────┬───────────────────────────────────────────────┘
                      │
                      │ Available for Queries
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────────┐
│                   TEAM CONTEXT ENGINE                               │
│                                                                     │
│  🧠 TeamContextEngine.buildContext()                               │
│                                                                     │
│  When User Asks: "What did we discuss in yesterday's standup?"     │
│                                                                     │
│  Step 1: Query Relevant Meetings                                   │
│  └─> Search team_meetings where:                                  │
│       - title contains "standup"                                   │
│       - start_time >= yesterday                                    │
│       - metadata.transcript IS NOT NULL                            │
│                                                                     │
│  Step 2: Extract Transcript Context                                │
│  └─> Parse VTT transcript                                         │
│       - Extract all dialogue                                       │
│       - Identify speakers                                          │
│       - Include timestamps                                         │
│       - Add Copilot summary if available                           │
│                                                                     │
│  Step 3: Return Rich Context                                       │
│  └─> {                                                            │
│       type: 'meeting_transcript',                                  │
│       meeting_title: 'Daily Standup',                              │
│       date: '2025-10-22',                                          │
│       duration: '30 minutes',                                      │
│       participants: ['Alice', 'Bob', 'Charlie'],                   │
│       full_transcript: "Speaker 1: We completed...",               │
│       summary: "Team discussed project status...",                 │
│       action_items: ['Deploy by Friday', 'Review PR']              │
│     }                                                              │
└─────────────────────┬───────────────────────────────────────────────┘
                      │
                      │ Provides Context to AI
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     AI CHAT INTERFACE                               │
│                                                                     │
│  💬 User Message:                                                  │
│     "What did we discuss in yesterday's standup?"                  │
│                                                                     │
│  🤖 AI Response (with transcript context):                         │
│     "Based on yesterday's standup transcript, the team discussed:  │
│                                                                     │
│     1. Project Status: Alice mentioned the API is 80% complete     │
│     2. Blockers: Bob is waiting for database migration approval    │
│     3. Next Steps: Charlie will review the pull requests today     │
│                                                                     │
│     Action items assigned:                                         │
│     - Deploy feature branch by Friday (Alice)                      │
│     - Schedule client demo for next week (Bob)                     │
│                                                                     │
│     The meeting was 28 minutes long and had 6 participants."       │
└─────────────────────────────────────────────────────────────────────┘
```

## Data Flow Summary

1. **Meeting Recording** → Teams processes audio/video
2. **Transcription** → AI generates VTT file (15-30 min)
3. **Graph API** → Transcript becomes available via API
4. **Power Automate** → Polls every 30 min, downloads to OneDrive
5. **Your App** → Syncs every 15 min, reads from OneDrive
6. **Database** → Stores transcript + metadata
7. **Team Chat** → AI uses transcripts as context
8. **User** → Gets accurate, detailed answers about meetings

## Timing Breakdown

```
Meeting Ends
    ↓
  0 min: Recording stops
    ↓
 +15 min: Transcription processing starts
    ↓
 +30 min: Transcript ready in Graph API
    ↓
 +45 min: Power Automate runs (next 30-min cycle)
    ↓
 +45 min: File saved to OneDrive
    ↓
 +60 min: Your app syncs (next 15-min cycle)
    ↓
 +60 min: Transcript available in database
    ↓
 +60 min: ✅ Ready in Team Chat!
```

**Total Time**: ~60 minutes from meeting end to availability in chat

## Optimization Opportunities

### Current Setup (60 minutes)
- Teams processing: 15-30 min (can't control)
- Power Automate: 30 min intervals (configurable)
- App sync: 15 min intervals (configurable)

### Optimized Setup (20 minutes)
- Teams processing: 15-30 min (can't control)
- Power Automate: **5 min intervals** (change recurrence)
- App sync: **5 min intervals** (change polling interval)

### Real-Time Setup (15 minutes)
- Teams processing: 15-30 min (can't control)
- **Use Webhooks** instead of polling:
  - Microsoft Graph Webhooks (immediate notification)
  - No polling needed
  - Transcript appears within seconds of being ready

## File Format Details

### VTT (WebVTT) Example:
```
WEBVTT

NOTE
This transcript was generated by Microsoft Teams

00:00:01.000 --> 00:00:05.000
<v John Smith>Good morning everyone, let's get started with today's standup.</v>

00:00:05.500 --> 00:00:10.000
<v Jane Doe>Thanks John. I completed the authentication module yesterday.</v>

00:00:10.500 --> 00:00:15.000
<v John Smith>Great work! Any blockers we should know about?</v>

00:00:15.500 --> 00:00:20.000
<v Jane Doe>Yes, I'm waiting on the database migration approval from DevOps.</v>
```

### Your App Parses This Into:
```javascript
{
  transcript: "WEBVTT\n\n00:00:01.000 --> 00:00:05.000\n<v John Smith>...",
  parsed: {
    speakers: ["John Smith", "Jane Doe"],
    duration: "15:23",
    statements: [
      {
        speaker: "John Smith",
        time: "00:00:01",
        text: "Good morning everyone..."
      },
      // ...
    ]
  }
}
```

## Security & Privacy

### Data Flow Security:
1. **Microsoft Graph**: OAuth 2.0 with PKCE
2. **Power Automate**: Managed identity / Service principal
3. **OneDrive**: User-scoped permissions
4. **Your App**: Supabase RLS + user-specific queries
5. **Database**: Encrypted at rest, user isolation

### Privacy Considerations:
- ✅ Transcripts stored per-user (no cross-user access)
- ✅ OneDrive files private to account
- ✅ Database queries user-scoped
- ✅ No transcript data leaves your organization
- ✅ Compliant with Teams data retention policies

## Troubleshooting Decision Tree

```
Transcript Not Available?
    │
    ├─> In Graph API?
    │   ├─ Yes → Check Power Automate run history
    │   │         └─ Error? → Check permissions
    │   └─ No  → Wait 30 min, check transcription was enabled
    │
    ├─> In OneDrive?
    │   ├─ Yes → Check app sync logs
    │   │         └─ Error? → Check OneDrive permissions
    │   └─ No  → Check Power Automate flow status
    │
    └─> In Database?
        ├─ Yes → ✅ Working! Available in chat
        └─ No  → Run: node force-sync-meetings.js
```

## Cost Analysis

### Microsoft 365 Costs:
- Teams transcription: Included in Premium
- OneDrive storage: ~$5/user/month (1TB)
- Graph API calls: Free (delegated permissions)

### Power Automate Costs:
- Basic flows: Included in M365 E3/E5
- HTTP Premium connector: $15/user/month
- **Recommended**: Start with included connectors

### Your App Costs:
- Compute: Minimal (background sync)
- Storage: ~10 KB per transcript
- 1000 meetings = ~10 MB storage

**Total Added Cost**: $0-15/month depending on Power Automate tier

---

**Questions?** See `SETUP_INSTRUCTIONS.md` or `POWER_AUTOMATE_TRANSCRIPT_FLOW.md`

