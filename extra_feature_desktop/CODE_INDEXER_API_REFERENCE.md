# Code Indexer API Reference

Quick reference for using the Code Indexer in your React components.

## Available APIs

All APIs are available via `window.electronAPI.codeIndexer.*`

---

## 1. Check Availability

Check if the Code Indexer is configured and ready to use.

```javascript
const result = await window.electronAPI.codeIndexer.checkAvailability();
```

**Returns:**
```javascript
{
  success: true,
  available: true,
  configured: {
    github: true,
    openai: true,
    anthropic: true,
    supabase: true
  },
  message: "Code Indexer is ready"
}
```

---

## 2. List Repositories

Get all GitHub repositories accessible via your GitHub App.

```javascript
const result = await window.electronAPI.codeIndexer.listRepositories();
```

**Returns:**
```javascript
{
  success: true,
  repositories: [
    {
      id: 12345,
      name: "my-repo",
      full_name: "my-org/my-repo",
      owner: "my-org",
      description: "Repository description",
      private: true,
      default_branch: "main",
      language: "JavaScript",
      updated_at: "2025-10-20T10:30:00Z"
    }
  ],
  count: 1
}
```

---

## 3. Index Repository

Index a GitHub repository for semantic search.

```javascript
const result = await window.electronAPI.codeIndexer.indexRepository({
  owner: 'my-org',
  repo: 'my-repo',
  branch: 'main'  // optional, defaults to 'main'
});
```

**Parameters:**
- `owner` (string, required) - Repository owner/organization
- `repo` (string, required) - Repository name
- `branch` (string, optional) - Branch to index (default: 'main')

**Returns:**
```javascript
{
  success: true,
  result: {
    owner: "my-org",
    repo: "my-repo",
    branch: "main",
    files: 150,
    chunks: 423,
    processingTime: 45230,  // milliseconds
    startedAt: "2025-10-21T11:00:00Z",
    completedAt: "2025-10-21T11:00:45Z"
  }
}
```

**Notes:**
- Indexing time depends on repository size
- Small repos: 1-2 minutes
- Medium repos: 5-10 minutes
- Large repos: 15-30+ minutes

---

## 4. Query Code

Ask natural language questions about indexed code.

```javascript
const result = await window.electronAPI.codeIndexer.query({
  query: 'How does user authentication work?',
  owner: 'my-org',
  repo: 'my-repo'
});
```

**Parameters:**
- `query` (string, required) - Natural language question
- `owner` (string, required) - Repository owner
- `repo` (string, required) - Repository name

**Returns:**
```javascript
{
  success: true,
  data: {
    answer: "User authentication is implemented using JWT tokens...",
    references: [
      {
        file_path: "src/auth/AuthService.js",
        chunk_type: "class",
        chunk_name: "AuthService",
        file_language: "javascript",
        start_line: 15,
        similarity: 0.87
      }
    ],
    confidence: 0.85,
    processingTime: 2340
  }
}
```

**Example Questions:**
- "How does user authentication work?"
- "What APIs does this service expose?"
- "Where is payment processing implemented?"
- "How do we handle errors?"
- "What's the database schema?"
- "Can we integrate with Stripe?"

---

## 5. Get Indexing Status

Check the indexing status of a repository.

```javascript
const result = await window.electronAPI.codeIndexer.getStatus({
  owner: 'my-org',
  repo: 'my-repo',
  branch: 'main'
});
```

**Returns:**
```javascript
{
  success: true,
  status: {
    repository_owner: "my-org",
    repository_name: "my-repo",
    repository_branch: "main",
    status: "completed",  // 'pending' | 'in_progress' | 'completed' | 'failed'
    total_files: 150,
    indexed_files: 150,
    total_chunks: 423,
    indexed_chunks: 423,
    progress_percentage: 100,
    started_at: "2025-10-21T11:00:00Z",
    completed_at: "2025-10-21T11:00:45Z",
    duration_ms: 45230
  }
}
```

---

## 6. Get Job Status

Track real-time progress of an indexing job.

```javascript
const result = await window.electronAPI.codeIndexer.getJobStatus({
  owner: 'my-org',
  repo: 'my-repo'
});
```

**Returns:**
```javascript
{
  success: true,
  job: {
    id: "my-org/my-repo",
    status: "in_progress",
    phase: "embedding",  // 'initializing' | 'fetching' | 'chunking' | 'embedding' | 'storing'
    progress: 50,  // 0-100
    startedAt: "2025-10-21T11:00:00Z",
    stats: {
      files: 150,
      chunks: 423,
      embeddings: 210
    }
  }
}
```

---

## React Component Example

```jsx
import React, { useState, useEffect } from 'react';

function CodeQueryComponent() {
  const [repositories, setRepositories] = useState([]);
  const [selectedRepo, setSelectedRepo] = useState(null);
  const [query, setQuery] = useState('');
  const [answer, setAnswer] = useState(null);
  const [loading, setLoading] = useState(false);

  // Load repositories on mount
  useEffect(() => {
    async function loadRepos() {
      const result = await window.electronAPI.codeIndexer.listRepositories();
      if (result.success) {
        setRepositories(result.repositories);
      }
    }
    loadRepos();
  }, []);

  // Handle query submission
  const handleQuery = async () => {
    if (!selectedRepo || !query) return;
    
    setLoading(true);
    try {
      const result = await window.electronAPI.codeIndexer.query({
        query,
        owner: selectedRepo.owner,
        repo: selectedRepo.name
      });
      
      if (result.success) {
        setAnswer(result.data);
      } else {
        console.error('Query failed:', result.error);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2>Ask About Your Code</h2>
      
      {/* Repository Selection */}
      <select 
        onChange={(e) => setSelectedRepo(repositories[e.target.value])}
      >
        <option>Select a repository...</option>
        {repositories.map((repo, i) => (
          <option key={repo.id} value={i}>
            {repo.full_name}
          </option>
        ))}
      </select>

      {/* Query Input */}
      <input
        type="text"
        placeholder="Ask a question about the code..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      
      <button onClick={handleQuery} disabled={loading}>
        {loading ? 'Thinking...' : 'Ask'}
      </button>

      {/* Answer Display */}
      {answer && (
        <div>
          <h3>Answer:</h3>
          <p>{answer.answer}</p>
          
          <h4>References:</h4>
          <ul>
            {answer.references.map((ref, i) => (
              <li key={i}>
                {ref.file_path} (Line {ref.start_line})
                <br />
                Similarity: {(ref.similarity * 100).toFixed(1)}%
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default CodeQueryComponent;
```

---

## Error Handling

All APIs return a consistent error format:

```javascript
{
  success: false,
  error: "Error message here"
}
```

**Always check `success` before accessing data:**

```javascript
const result = await window.electronAPI.codeIndexer.query({ ... });

if (result.success) {
  console.log('Answer:', result.data.answer);
} else {
  console.error('Error:', result.error);
}
```

---

## Common Errors

### "Code Indexer not available"
- Environment variables are missing
- Check CODE_INDEXER_SETUP.md

### "Repository not indexed"
- Call `indexRepository()` first before querying
- Check indexing status with `getStatus()`

### "Failed to fetch repository"
- Repository not accessible via GitHub App
- Check GitHub App installation permissions

### "Search failed"
- Database migration not run
- Check Supabase connection

---

## Performance Tips

1. **Index once, query many times** - Indexing is slow, querying is fast
2. **Cache repository lists** - Don't fetch repos on every render
3. **Show progress** - Use `getJobStatus()` for indexing progress
4. **Debounce queries** - Don't query on every keystroke
5. **Limit question length** - Keep queries under 500 characters

---

## Costs (Approximate)

- **Indexing**: ~$0.01 per 1000 code chunks (OpenAI)
- **Querying**: ~$0.015 per query (Anthropic Claude)

Example:
- Small repo (100 files, 300 chunks): ~$0.003 to index
- 100 queries: ~$1.50

---

## Questions?

See `CODE_INDEXER_SETUP.md` for detailed setup instructions and troubleshooting.

