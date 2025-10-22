# Database Migrations

## How to Run Migrations

1. **Access Supabase SQL Editor**
   - Go to your Supabase project dashboard
   - Navigate to the SQL Editor section
   - Create a new query

2. **Run Migration**
   - Copy the contents of `001_team_sync_tables.sql`
   - Paste into the SQL Editor
   - Click "Run" to execute

3. **Verify Tables**
   - Go to the Table Editor
   - You should see:
     - `team_meetings`
     - `team_updates`
     - `team_context_index`

## Tables Created

### team_meetings
Stores meeting information with AI summaries:
- Basic meeting info (title, time, attendees)
- Importance scoring
- Notes (Copilot or manual)
- AI-generated summaries
- Key decisions and action items

### team_updates
Aggregates JIRA and GitHub updates:
- JIRA issues (status changes, new tasks)
- GitHub PRs and commits
- Links to meetings and JIRA tickets
- Author and status tracking

### team_context_index
Search index for AI Q&A (future enhancement):
- Content snippets from meetings and updates
- Will support semantic search with pgvector
- Currently uses simple text indexing

## Row Level Security

All tables have RLS enabled:
- Users can only access their own data
- Service role (desktop app) has full access
- Secure by default

## Future Enhancements

To enable semantic search with pgvector:
1. Enable pgvector extension in Supabase
2. Uncomment the `embedding VECTOR(1536)` line
3. Implement embedding generation in `TeamContextEngine`


