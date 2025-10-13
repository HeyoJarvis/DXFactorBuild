# 🔍 Code Indexer Testing Guide

Complete guide to test the Code Indexer functionality in HeyJarvis.

---

## 📋 Prerequisites

### 1. Environment Variables Required
Make sure these are set in your `.env`:

```bash
# GitHub App Authentication
GITHUB_APP_ID=your_app_id
GITHUB_APP_INSTALLATION_ID=your_installation_id
GITHUB_APP_PRIVATE_KEY_PATH=/path/to/private-key.pem

# OpenAI API (for embeddings)
OPENAI_API_KEY=your_openai_key

# Anthropic API (for AI responses)
ANTHROPIC_API_KEY=your_anthropic_key

# Supabase (for vector storage)
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_anon_key
```

### 2. Check Availability
First, verify the code indexer is properly configured:

```bash
node -e "
const CodeIndexer = require('./core/intelligence/code-indexer');
const indexer = new CodeIndexer();
indexer.checkAvailability().then(console.log);
"
```

Expected output:
```json
{
  "overall": true,
  "github": true,
  "openai": true,
  "anthropic": true,
  "supabase": true
}
```

---

## 🧪 Method 1: Command Line Testing

### A. Using the Test Script

Run the dedicated test script:

```bash
node test-code-indexer.js
```

This will:
1. ✅ Check availability of all services
2. ✅ List available repositories from GitHub
3. ✅ Index a test repository
4. ✅ Query the indexed code
5. ✅ Show statistics

### B. Manual Testing with Node

Create a test file `test-my-indexer.js`:

```javascript
const CodeIndexer = require('./core/intelligence/code-indexer');

async function test() {
  const indexer = new CodeIndexer({
    logLevel: 'debug'
  });

  // Step 1: Check availability
  console.log('🔍 Checking availability...');
  const availability = await indexer.checkAvailability();
  console.log('Availability:', availability);

  if (!availability.overall) {
    console.error('❌ Code Indexer not fully configured');
    return;
  }

  // Step 2: List available repositories
  console.log('\n📚 Listing repositories...');
  const repos = await indexer.listAvailableRepositories();
  console.log(`Found ${repos.length} repositories`);
  repos.slice(0, 5).forEach(repo => {
    console.log(`  - ${repo.full_name}`);
  });

  // Step 3: Index a repository (choose a small one for testing)
  const testRepo = repos[0]; // Use first repo
  if (testRepo) {
    console.log(`\n🚀 Indexing ${testRepo.full_name}...`);
    const result = await indexer.indexRepository(
      testRepo.owner.login,
      testRepo.name,
      testRepo.default_branch || 'main'
    );
    console.log('Indexing result:', result);
  }

  // Step 4: Query the indexed repository
  console.log('\n💬 Querying repository...');
  const queryResult = await indexer.query(
    'What does this repository do?',
    {
      owner: testRepo.owner.login,
      repo: testRepo.name,
      maxChunks: 5
    }
  );
  console.log('Query result:', queryResult);

  // Step 5: Get statistics
  console.log('\n📊 Statistics:');
  const stats = indexer.getStats();
  console.log(stats);
}

test().catch(console.error);
```

Run it:
```bash
node test-my-indexer.js
```

---

## 🖥️ Method 2: Testing from Desktop App

### A. Using Browser Console

1. **Start your desktop app:**
```bash
cd desktop
npm run dev:developer
```

2. **Open Developer Tools** (View → Toggle Developer Tools)

3. **Run these commands in the console:**

#### Check if Code Indexer is Available:
```javascript
await window.electronAPI.codeIndexer.checkAvailability()
```

Expected response:
```javascript
{
  success: true,
  available: true,
  checks: {
    overall: true,
    github: true,
    openai: true,
    anthropic: true,
    supabase: true
  }
}
```

#### List Available Repositories:
```javascript
const repos = await window.electronAPI.codeIndexer.listRepositories()
console.log(repos)
```

#### Index a Repository:
```javascript
const result = await window.electronAPI.codeIndexer.indexRepository({
  owner: 'your-username',
  repo: 'your-repo-name',
  branch: 'main'
})
console.log(result)
```

#### Query a Repository:
```javascript
const answer = await window.electronAPI.codeIndexer.query({
  owner: 'your-username',
  repo: 'your-repo-name',
  question: 'What does the main function do?',
  options: { maxChunks: 5 }
})
console.log(answer)
```

#### Check Indexing Status:
```javascript
const status = await window.electronAPI.codeIndexer.getStatus({
  owner: 'your-username',
  repo: 'your-repo-name',
  branch: 'main'
})
console.log(status)
```

#### Get Statistics:
```javascript
const stats = await window.electronAPI.codeIndexer.getStats()
console.log(stats)
```

### B. Using the UI (If Available)

The app has a code indexer section in `unified.html`:

1. Navigate to **Engineering Intelligence** tab
2. Look for **Code Indexer** section
3. Click **List Repositories** to see available repos
4. Select a repository
5. Click **Index Repository** to start indexing
6. Use the query box to ask questions about the code

---

## 📝 Test Scenarios

### Scenario 1: First-Time Index
Test indexing a new repository for the first time.

```javascript
// In browser console or Node script
const result = await indexer.indexRepository('owner', 'repo', 'main');

// Expected:
// - Files fetched from GitHub
// - Code chunked into manageable pieces
// - Embeddings generated via OpenAI
// - Chunks stored in Supabase vector database
// - Result contains: { chunks, files, duration, status }
```

### Scenario 2: Re-Index (Update)
Test updating an already-indexed repository.

```javascript
// Index again - should be faster if cached
const result = await indexer.indexRepository('owner', 'repo', 'main');

// Expected:
// - Should detect existing index
// - Only update changed files
// - Faster than first index
```

### Scenario 3: Natural Language Query
Test querying the indexed code.

```javascript
const queries = [
  'What authentication methods are implemented?',
  'How does the API handle errors?',
  'Where is the database connection configured?',
  'What testing frameworks are used?',
  'Explain the user registration flow'
];

for (const question of queries) {
  const answer = await indexer.query(question, {
    owner: 'owner',
    repo: 'repo'
  });
  console.log(`Q: ${question}`);
  console.log(`A: ${answer.answer}\n`);
}
```

### Scenario 4: Batch Indexing
Test indexing multiple repositories at once.

```javascript
const repositories = [
  { owner: 'user1', repo: 'repo1', branch: 'main' },
  { owner: 'user2', repo: 'repo2', branch: 'main' },
  { owner: 'user3', repo: 'repo3', branch: 'main' }
];

const results = await indexer.indexRepositories(repositories);
console.log(results);
```

---

## 🐛 Troubleshooting

### Issue: "Code Indexer not configured"
**Cause:** Missing environment variables or dependencies  
**Solution:**
```bash
# Check which services are missing
node -e "
const CodeIndexer = require('./core/intelligence/code-indexer');
const indexer = new CodeIndexer();
indexer.checkAvailability().then(checks => {
  console.log('GitHub:', checks.github);
  console.log('OpenAI:', checks.openai);
  console.log('Anthropic:', checks.anthropic);
  console.log('Supabase:', checks.supabase);
});
"
```

### Issue: "No repositories found"
**Cause:** GitHub App not installed or not authenticated  
**Solution:**
1. Check `GITHUB_APP_INSTALLATION_ID` in `.env`
2. Verify GitHub App is installed on your account/org
3. Test GitHub connection:
```bash
node -e "
const { App } = require('@octokit/app');
const app = new App({
  appId: process.env.GITHUB_APP_ID,
  privateKey: require('fs').readFileSync(process.env.GITHUB_APP_PRIVATE_KEY_PATH, 'utf8')
});
app.octokit.rest.apps.listReposAccessibleToInstallation({
  installation_id: process.env.GITHUB_APP_INSTALLATION_ID
}).then(r => console.log('Repos:', r.data.repositories.length));
"
```

### Issue: "Embedding generation failed"
**Cause:** OpenAI API key invalid or quota exceeded  
**Solution:**
1. Verify OpenAI API key:
```bash
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer $OPENAI_API_KEY"
```
2. Check usage at: https://platform.openai.com/usage

### Issue: "Vector storage failed"
**Cause:** Supabase connection or pgvector extension issue  
**Solution:**
1. Test Supabase connection:
```bash
node -e "
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);
supabase.from('code_chunks').select('count').then(console.log);
"
```
2. Ensure `pgvector` extension is enabled in Supabase

### Issue: "Query returns no results"
**Cause:** Repository not indexed or query too specific  
**Solution:**
1. Check indexing status first:
```javascript
const status = await indexer.getIndexingStatus('owner', 'repo', 'main');
console.log('Indexed:', status.indexed);
console.log('Chunks:', status.chunksCount);
```
2. Try broader queries:
   - Instead of: "What does function X do in file Y?"
   - Try: "What functions handle authentication?"

---

## 📊 Monitoring & Logs

### Check Logs
```bash
# Real-time logs
tail -f desktop/logs/code-indexer.log

# View specific events
grep "Indexing started" desktop/logs/code-indexer.log
grep "Indexing completed" desktop/logs/code-indexer.log
grep "ERROR" desktop/logs/code-indexer.log
```

### Monitor Progress
The indexer emits events you can listen to:

```javascript
const indexer = new CodeIndexer();

indexer.on('indexing:started', (job) => {
  console.log(`🚀 Started: ${job.owner}/${job.repo}`);
});

indexer.on('indexing:progress', (job) => {
  console.log(`⏳ Progress: ${job.progress}% - ${job.phase}`);
});

indexer.on('indexing:completed', (job) => {
  console.log(`✅ Done: ${job.result.chunks} chunks in ${job.duration}ms`);
});

indexer.on('indexing:failed', (job) => {
  console.error(`❌ Failed: ${job.error}`);
});
```

---

## ✅ Verification Checklist

After testing, verify:

- [ ] All services show as available (`checkAvailability`)
- [ ] Can list repositories from GitHub
- [ ] Successfully indexed at least one repository
- [ ] Received chunks and embeddings in response
- [ ] Can query the indexed code
- [ ] AI returns relevant answers to queries
- [ ] Stats show indexed repositories and chunks
- [ ] Logs show successful operations
- [ ] No errors in console or log files

---

## 🎯 Quick Test Command

Run everything in one go:

```bash
# Quick test (lists repos only)
node -e "require('./core/intelligence/code-indexer').prototype.listAvailableRepositories().then(r => console.log(r.length + ' repos'))"

# Full test with indexing
node test-code-indexer.js

# Check stats after indexing
node -e "new (require('./core/intelligence/code-indexer'))().getStats().then(console.log)"
```

---

Need help debugging a specific issue? Let me know!

