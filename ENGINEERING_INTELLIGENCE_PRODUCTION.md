# Engineering Intelligence - Production Architecture

## Overview

This document describes the production-ready architecture for Engineering Intelligence in HeyJarvis. The system enables sales, marketing, and product executives to query codebase intelligence without requiring individual GitHub tokens or technical knowledge.

## Architecture

### Centralized Backend API

```
┌─────────────────┐
│  Desktop App    │
│  (Sales/Exec)   │
└────────┬────────┘
         │ Authenticated API Call
         │ (User's Session Token)
         ↓
┌─────────────────┐
│  Backend API    │
│  /api/engineering/query
│  - Auth Middleware
│  - Rate Limiting
│  - Audit Logging
└────────┬────────┘
         │ GitHub Token (Admin)
         │ (Stored in .env)
         ↓
┌─────────────────┐
│  GitHub API     │
│  - Copilot API  │
│  - Repository   │
│  - Issues/PRs   │
└─────────────────┘
```

### Key Benefits

1. **No User Token Management**: Users never see or manage GitHub tokens
2. **Centralized Security**: Single GitHub token managed by admin
3. **Rate Limit Protection**: API-level rate limiting prevents abuse
4. **Audit Trail**: All queries logged for compliance
5. **Business-Friendly Responses**: Technical details translated to executive language

## Components

### 1. Backend API (`/api/engineering/query.js`)

**Responsibilities:**
- Authenticate users via session tokens
- Rate limit queries (10 per 15 minutes per user)
- Call Engineering Intelligence Service
- Audit log all queries
- Return business-friendly responses

**Security Features:**
- JWT token validation
- User authentication required
- Rate limiting per user
- Audit logging for compliance
- Error handling without exposing internals

### 2. Engineering Intelligence Service (`/core/intelligence/engineering-intelligence-service.js`)

**Responsibilities:**
- Interface with GitHub API / Copilot
- Query codebase for insights
- Translate technical details to business language
- Provide feature status and completion estimates

**Current Implementation:**
- Mock responses for common queries (SSO, meeting scheduling)
- Ready for GitHub Copilot API integration
- Structured response format

### 3. Desktop App Integration (`/desktop/main.js`)

**Responsibilities:**
- Detect `[ENGINEERING_QUERY: ...]` markers in AI responses
- Call backend API with user's session token
- Display results in chat interface
- Handle errors gracefully

**User Experience:**
- Seamless integration with AI chat
- No technical knowledge required
- Clear, actionable insights
- Expandable technical details

## Setup Instructions

### 1. Configure GitHub Token (Admin Only)

Add to `.env`:
```bash
# GitHub Copilot / Engineering Intelligence
GITHUB_TOKEN=ghp_your_github_personal_access_token_here
GITHUB_REPO_OWNER=your_github_username_or_org
GITHUB_REPO_NAME=HeyJarvis

# API Base URL
API_BASE_URL=http://localhost:3000
```

**GitHub Token Permissions Required:**
- `repo` (full control of private repositories)
- `read:org` (read org and team membership)
- `read:user` (read user profile data)

**To Generate Token:**
1. Go to GitHub Settings → Developer settings → Personal access tokens
2. Click "Generate new token (classic)"
3. Select required scopes
4. Copy token and add to `.env`

### 2. Start Backend Server

```bash
npm start
```

The API will be available at `http://localhost:3000/api/engineering/query`

### 3. Start Desktop App

```bash
npm run dev:desktop
```

Users will automatically use the backend API for engineering queries.

## Usage

### For End Users (Sales/Marketing/Product)

Simply ask questions in the HeyJarvis chat:

**Examples:**
- "What's the status of our SSO integration?"
- "Is the meeting scheduling feature ready for demos?"
- "What engineering work is blocking the Q4 release?"
- "Can we demo the new dashboard to customers?"

The AI will automatically:
1. Detect engineering-related questions
2. Query the codebase via backend API
3. Return business-friendly insights
4. Provide actionable recommendations

### For Developers

The AI uses a special marker format to trigger engineering queries:

```
[ENGINEERING_QUERY: question=What's the status of SSO?, role=sales]
```

This marker is automatically detected and processed by the system.

## API Reference

### POST `/api/engineering/query`

**Authentication:** Required (Bearer token)

**Request Body:**
```json
{
  "query": "What's the status of our SSO integration?",
  "context": {
    "role": "sales"
  }
}
```

**Response:**
```json
{
  "success": true,
  "query": "What's the status of our SSO integration?",
  "result": {
    "summary": "The SSO Integration feature is production-ready...",
    "businessImpact": "Enables seamless integration for enterprise customers...",
    "actionItems": [
      "Update sales collateral with SSO capabilities",
      "Prepare a demo script for sales team"
    ],
    "technicalDetails": "Implemented using OAuth 2.0 and OpenID Connect...",
    "timestamp": "2025-10-07T19:30:00.000Z"
  }
}
```

**Error Responses:**

- `401 Unauthorized`: Missing or invalid authentication token
- `429 Too Many Requests`: Rate limit exceeded (10 queries per 15 minutes)
- `503 Service Unavailable`: GitHub token not configured
- `500 Internal Server Error`: Query processing failed

## Rate Limiting

**Per-User Limits:**
- 10 queries per 15 minutes
- Resets on a rolling window basis

**Why Rate Limiting:**
- Protects GitHub API quotas
- Prevents abuse
- Ensures fair access for all users

**When Rate Limited:**
Users will see a clear error message with reset time.

## Audit Logging

All engineering queries are logged for compliance:

**Logged Information:**
- User ID and email
- Query text (truncated to 200 chars)
- Success/failure status
- Error messages (if any)
- Timestamp

**Log Location:**
- Console: Real-time monitoring
- File: `logs/engineering-api.log` (5MB max, 5 file rotation)

**Future Enhancement:**
Store audit logs in Supabase for long-term compliance and analytics.

## Security Considerations

### 1. Token Management
- GitHub token stored in `.env` (server-side only)
- Never exposed to client applications
- Managed by system administrators only

### 2. User Authentication
- All API calls require valid session token
- Session tokens validated against Supabase
- Expired sessions automatically rejected

### 3. Rate Limiting
- Prevents API quota exhaustion
- Protects against abuse
- Per-user tracking

### 4. Audit Trail
- All queries logged with user context
- Compliance-ready logging
- Error tracking for debugging

### 5. Error Handling
- Generic error messages to users
- Detailed errors in server logs
- No internal details exposed

## Production Deployment

### Environment Variables

**Required:**
```bash
GITHUB_TOKEN=ghp_...
GITHUB_REPO_OWNER=your_org
GITHUB_REPO_NAME=HeyJarvis
API_BASE_URL=https://api.heyjarvis.com
```

**Optional:**
```bash
LOG_LEVEL=info
NODE_ENV=production
```

### Scaling Considerations

1. **GitHub API Rate Limits:**
   - 5,000 requests/hour for authenticated requests
   - Monitor usage in GitHub settings
   - Consider caching for common queries

2. **Backend Scaling:**
   - Stateless API design (scales horizontally)
   - Consider Redis for rate limiting in multi-instance setup
   - Load balancer for high availability

3. **Database:**
   - Audit logs should move to Supabase for persistence
   - Consider archiving old logs

## Monitoring

### Key Metrics to Track

1. **API Usage:**
   - Queries per user per day
   - Most common queries
   - Response times

2. **GitHub API:**
   - Rate limit consumption
   - API errors
   - Response times

3. **User Experience:**
   - Success rate
   - Error types
   - User feedback

### Logging

**Levels:**
- `info`: Normal operations, query execution
- `warn`: Rate limits, missing config
- `error`: API failures, authentication errors

**Log Files:**
- `logs/engineering-api.log`: API endpoint logs
- `logs/engineering-intelligence.log`: Service logs

## Future Enhancements

### Phase 1 (Current)
- ✅ Backend API with authentication
- ✅ Rate limiting
- ✅ Audit logging
- ✅ Desktop app integration
- ✅ Mock responses for common queries

### Phase 2 (Next)
- [ ] Real GitHub Copilot API integration
- [ ] Supabase audit log persistence
- [ ] Query result caching
- [ ] Admin dashboard for monitoring

### Phase 3 (Future)
- [ ] Advanced query capabilities (PR analysis, code search)
- [ ] Slack integration for engineering queries
- [ ] Custom query templates per role
- [ ] Analytics dashboard for usage insights

## Troubleshooting

### "Engineering Intelligence is not configured"

**Cause:** GitHub token not set in `.env`

**Solution:**
1. Add `GITHUB_TOKEN` to `.env`
2. Restart backend server
3. Verify token has correct permissions

### "No authentication token available"

**Cause:** User not logged in or session expired

**Solution:**
1. User should log in via Slack OAuth
2. Check session is valid in Supabase
3. Verify `authService` is initialized

### "Too many engineering queries"

**Cause:** Rate limit exceeded (10 per 15 minutes)

**Solution:**
1. Wait for rate limit window to reset
2. Consider increasing limit for power users
3. Cache common queries

### API Returns 503 Error

**Cause:** Backend server not running or GitHub token invalid

**Solution:**
1. Verify backend server is running: `npm start`
2. Check GitHub token is valid
3. Review `logs/engineering-api.log` for details

## Support

For issues or questions:
1. Check logs: `logs/engineering-api.log`
2. Verify configuration in `.env`
3. Test API directly: `curl -X POST http://localhost:3000/api/engineering/query -H "Authorization: Bearer YOUR_TOKEN" -H "Content-Type: application/json" -d '{"query":"test"}'`

## Conclusion

This production architecture ensures:
- ✅ **Zero user friction**: No GitHub tokens required
- ✅ **Secure**: Centralized token management
- ✅ **Scalable**: Rate limiting and caching ready
- ✅ **Compliant**: Full audit trail
- ✅ **User-friendly**: Business language, not technical jargon

Users can now query engineering intelligence as easily as asking a question in chat, while administrators maintain full control over security and access.
