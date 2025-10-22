# Fix: Code Indexer Integration with Teams

## Issue

When asking questions to a team with assigned repositories, the AI was not able to access the indexed codebase data. Error:

```
"error":"this.codeIndexer.vectorStore.search is not a function"
```

The response showed: `📊 Used 1 meetings,1 JIRA,0 GitHub` - no code context.

## Root Cause

`TeamContextEngine._fetchTeamCodeContext()` was using the **wrong API**:

```javascript
❌ this.codeIndexer.vectorStore.search(query, {...})
```

The correct API is:

```javascript
✅ this.codeIndexer.queryEngine.query(query, {...})
```

## Fix Applied

### File: `main/services/TeamContextEngine.js`

**Changed Line 398:**
```javascript
if (!this.codeIndexer || !this.codeIndexer.queryEngine) {  // ✅ Check queryEngine
```

**Changed Line 413-420:**
```javascript
// Use the correct API: queryEngine.query()
const result = await this.codeIndexer.queryEngine.query(query, {
  repositoryOwner: repo.repository_owner,
  repositoryName: repo.repository_name,
  limit: 5
});

// Extract chunks from result
if (result && result.chunks && result.chunks.length > 0) {
  allChunks.push(...result.chunks);
}
```

**Changed Line 350-360:** Now always attempts to fetch code context when repositories are assigned (not dependent on `includeCode` option).

## What This Fixes

After restarting the app, team questions will now:

1. ✅ **Search the indexed codebase** when repositories are assigned to the team
2. ✅ **Include code snippets** in the AI's context
3. ✅ **Answer questions about code** implementation details
4. ✅ **Connect meetings/JIRA with actual code** changes

## How It Works Now

When you ask a team question like:
> "How do meeting notes work with the repository data?"

The AI will:
1. ✅ Fetch team's meetings
2. ✅ Fetch team's JIRA issues  
3. ✅ **Query the team's assigned repositories** for relevant code
4. ✅ Combine all three contexts to answer

## Testing

1. **Make sure the repository is indexed:**
   - Go to Code Indexer page
   - Index the team's repository (e.g., HeyoJarvis/BeachBaby)
   - Wait for indexing to complete

2. **Assign repository to team:**
   - Already done (you assigned BeachBaby repo)

3. **Restart the app:**
   ```bash
   pkill -f "electron"
   cd /home/sdalal/test/BeachBaby/extra_feature_desktop
   npm start
   ```

4. **Ask a question about code:**
   - Go to Teams page
   - Select your team
   - Ask: "What features are implemented in the codebase?"
   - Should now see code context being used! 📊 Used X meetings, X JIRA, X GitHub

## Result

The AI will now properly combine:
- 📅 **Meeting summaries** (discussions and decisions)
- 📋 **JIRA issues** (what needs to be built)
- 💻 **Actual code** (what's implemented)

To give comprehensive, code-aware answers! 🎉

