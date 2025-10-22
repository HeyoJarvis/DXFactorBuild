import React, { useState, useEffect } from 'react';
import './CodeIndexer.css';

function CodeIndexer({ user }) {
  const [activeTab, setActiveTab] = useState('repositories');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState({ available: false, configured: {} });
  
  // Repositories state
  const [repositories, setRepositories] = useState([]);
  const [selectedRepo, setSelectedRepo] = useState(null);
  
  // Indexing state
  const [indexingRepo, setIndexingRepo] = useState(null);
  const [indexingStatus, setIndexingStatus] = useState(null);
  const [indexResult, setIndexResult] = useState(null);
  
  // Query state
  const [query, setQuery] = useState('');
  const [queryResult, setQueryResult] = useState(null);
  const [queryLoading, setQueryLoading] = useState(false);

  // Check availability on mount
  useEffect(() => {
    checkAvailability();
    loadRepositories();
  }, []);

  const checkAvailability = async () => {
    try {
      const result = await window.electronAPI.codeIndexer.checkAvailability();
      if (result.success) {
        setStatus(result);
      }
    } catch (error) {
      console.error('Failed to check availability:', error);
    }
  };

  const loadRepositories = async () => {
    setLoading(true);
    try {
      const result = await window.electronAPI.github.listRepositories();
      if (result.success) {
        setRepositories(result.repositories);
      } else {
        alert('Failed to load repositories: ' + result.error);
      }
    } catch (error) {
      console.error('Failed to load repositories:', error);
      alert('Error: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleIndexRepository = async (repo) => {
    if (!confirm(`Index repository ${repo.full_name}?\n\nThis may take several minutes depending on repository size.`)) {
      return;
    }

    setIndexingRepo(repo);
    setIndexResult(null);
    setLoading(true);

    try {
      const result = await window.electronAPI.codeIndexer.indexRepository({
        owner: repo.owner.login,  // Fix: Extract login string from owner object
        repo: repo.name,
        branch: repo.default_branch
      });

      if (result.success) {
        setIndexResult(result.result);
        alert(`✅ Repository indexed successfully!\n\nFiles: ${result.result.files}\nChunks: ${result.result.chunks}\nTime: ${(result.result.processingTime / 1000).toFixed(1)}s`);
      } else {
        alert('❌ Indexing failed: ' + result.error);
      }
    } catch (error) {
      console.error('Indexing error:', error);
      alert('Error: ' + error.message);
    } finally {
      setLoading(false);
      setIndexingRepo(null);
    }
  };

  const handleGetStatus = async (repo) => {
    try {
      const result = await window.electronAPI.codeIndexer.getStatus({
        owner: repo.owner.login,  // Fix: Extract login string from owner object
        repo: repo.name,
        branch: repo.default_branch
      });

      if (result.success && result.status) {
        const s = result.status;
        alert(`Status: ${s.status}\n\nFiles: ${s.indexed_files}/${s.total_files}\nChunks: ${s.indexed_chunks}/${s.total_chunks}\nProgress: ${s.progress_percentage}%\n\nStarted: ${s.started_at ? new Date(s.started_at).toLocaleString() : 'N/A'}\nCompleted: ${s.completed_at ? new Date(s.completed_at).toLocaleString() : 'N/A'}`);
      } else {
        alert('No indexing status found for this repository');
      }
    } catch (error) {
      console.error('Failed to get status:', error);
      alert('Error: ' + error.message);
    }
  };

  const handleQuery = async () => {
    if (!selectedRepo) {
      alert('Please select a repository first');
      return;
    }
    if (!query.trim()) {
      alert('Please enter a question');
      return;
    }

    setQueryLoading(true);
    setQueryResult(null);

    try {
      const result = await window.electronAPI.codeIndexer.query({
        query: query.trim(),
        owner: selectedRepo.owner.login,  // Fix: Extract login string from owner object
        repo: selectedRepo.name
      });

      if (result.success) {
        setQueryResult(result.data);
      } else {
        alert('❌ Query failed: ' + result.error);
      }
    } catch (error) {
      console.error('Query error:', error);
      alert('Error: ' + error.message);
    } finally {
      setQueryLoading(false);
    }
  };

  const renderStatusBadge = () => {
    if (!status.available) {
      return <span className="status-badge status-error">❌ Not Available</span>;
    }
    
    const allConfigured = Object.values(status.configured).every(v => v);
    if (allConfigured) {
      return <span className="status-badge status-success">✅ Ready</span>;
    }
    
    return <span className="status-badge status-warning">⚠️ Partially Configured</span>;
  };

  const renderConfigStatus = () => {
    if (!status.configured) return null;

    return (
      <div className="config-status">
        <div className="config-item">
          <span className={status.configured.github ? 'check-ok' : 'check-fail'}>
            {status.configured.github ? '✅' : '❌'}
          </span>
          <span>GitHub App</span>
        </div>
        <div className="config-item">
          <span className={status.configured.openai ? 'check-ok' : 'check-fail'}>
            {status.configured.openai ? '✅' : '❌'}
          </span>
          <span>OpenAI</span>
        </div>
        <div className="config-item">
          <span className={status.configured.anthropic ? 'check-ok' : 'check-fail'}>
            {status.configured.anthropic ? '✅' : '❌'}
          </span>
          <span>Anthropic</span>
        </div>
        <div className="config-item">
          <span className={status.configured.supabase ? 'check-ok' : 'check-fail'}>
            {status.configured.supabase ? '✅' : '❌'}
          </span>
          <span>Supabase</span>
        </div>
      </div>
    );
  };

  return (
    <div className="code-indexer-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">🔍 Code Indexer</h1>
          <p className="page-subtitle">Query your GitHub repositories with natural language</p>
        </div>
        {renderStatusBadge()}
      </div>

      {renderConfigStatus()}

      <div className="tabs">
        <button 
          className={`tab ${activeTab === 'repositories' ? 'active' : ''}`}
          onClick={() => setActiveTab('repositories')}
        >
          📚 Repositories
        </button>
        <button 
          className={`tab ${activeTab === 'query' ? 'active' : ''}`}
          onClick={() => setActiveTab('query')}
        >
          💬 Query Code
        </button>
        <button 
          className={`tab ${activeTab === 'help' ? 'active' : ''}`}
          onClick={() => setActiveTab('help')}
        >
          ❓ Help
        </button>
      </div>

      <div className="tab-content">
        {activeTab === 'repositories' && (
          <div className="repositories-tab">
            <div className="section-header">
              <h2>Available Repositories</h2>
              <button 
                className="btn btn-secondary btn-sm" 
                onClick={loadRepositories}
                disabled={loading}
              >
                🔄 Refresh
              </button>
            </div>

            {loading && !indexingRepo ? (
              <div className="loading-state">
                <div className="spinner"></div>
                <p>Loading repositories...</p>
              </div>
            ) : (
              <div className="repos-grid">
                {repositories.map(repo => (
                  <div key={repo.id} className="repo-card">
                    <div className="repo-header">
                      <h3 className="repo-name">{repo.full_name}</h3>
                      {repo.private && <span className="badge badge-private">🔒 Private</span>}
                    </div>
                    
                    {repo.description && (
                      <p className="repo-description">{repo.description}</p>
                    )}
                    
                    <div className="repo-meta">
                      <span className="meta-item">
                        <span className="language-dot" style={{ backgroundColor: getLanguageColor(repo.language) }}></span>
                        {repo.language || 'Unknown'}
                      </span>
                      <span className="meta-item">📌 {repo.default_branch}</span>
                    </div>

                    <div className="repo-actions">
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => handleIndexRepository(repo)}
                        disabled={loading || indexingRepo === repo}
                      >
                        {indexingRepo === repo ? '⏳ Indexing...' : '📥 Index'}
                      </button>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleGetStatus(repo)}
                      >
                        📊 Status
                      </button>
                    </div>

                    {indexingRepo === repo && (
                      <div className="indexing-progress">
                        <div className="progress-bar">
                          <div className="progress-fill" style={{ width: '100%' }}></div>
                        </div>
                        <p className="progress-text">Indexing in progress...</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {!loading && repositories.length === 0 && (
              <div className="empty-state">
                <p>No repositories found</p>
                <small>Make sure your GitHub App has access to repositories</small>
              </div>
            )}
          </div>
        )}

        {activeTab === 'query' && (
          <div className="query-tab">
            <div className="query-section">
              <h2>Ask About Your Code</h2>
              
              <div className="form-group">
                <label>Select Repository</label>
                <select 
                  className="form-control"
                  value={selectedRepo?.id || ''}
                  onChange={(e) => {
                    const repo = repositories.find(r => r.id === parseInt(e.target.value));
                    setSelectedRepo(repo);
                  }}
                >
                  <option value="">Choose a repository...</option>
                  {repositories.map(repo => (
                    <option key={repo.id} value={repo.id}>
                      {repo.full_name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Your Question</label>
                <textarea
                  className="form-control"
                  rows="4"
                  placeholder="e.g., How does user authentication work?"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && e.ctrlKey) {
                      handleQuery();
                    }
                  }}
                />
                <small className="form-hint">Press Ctrl+Enter to submit</small>
              </div>

              <button
                className="btn btn-primary"
                onClick={handleQuery}
                disabled={!selectedRepo || !query.trim() || queryLoading}
              >
                {queryLoading ? '🤔 Thinking...' : '🔍 Ask Question'}
              </button>
            </div>

            {queryResult && (
              <div className="query-result">
                <h3>Answer:</h3>
                <div className="answer-box">
                  <p className="answer-text">{queryResult.answer}</p>
                  
                  {queryResult.confidence && (
                    <div className="confidence-bar">
                      <label>Confidence: {(queryResult.confidence * 100).toFixed(0)}%</label>
                      <div className="progress-bar">
                        <div 
                          className="progress-fill confidence-fill" 
                          style={{ width: `${queryResult.confidence * 100}%` }}
                        ></div>
                      </div>
                    </div>
                  )}
                </div>

                {queryResult.references && queryResult.references.length > 0 && (
                  <div className="references">
                    <h4>📎 Code References:</h4>
                    {queryResult.references.map((ref, i) => (
                      <div key={i} className="reference-card">
                        <div className="reference-header">
                          <code className="file-path">{ref.file_path}</code>
                          <span className="similarity-badge">
                            {(ref.similarity * 100).toFixed(0)}% match
                          </span>
                        </div>
                        <div className="reference-meta">
                          <span className="meta-tag">{ref.chunk_type}</span>
                          {ref.chunk_name && <span className="meta-tag">{ref.chunk_name}</span>}
                          <span className="meta-tag">Line {ref.start_line}</span>
                          <span className="meta-tag">{ref.file_language}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {queryResult.processingTime && (
                  <p className="processing-time">
                    ⏱️ Processed in {(queryResult.processingTime / 1000).toFixed(2)}s
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'help' && (
          <div className="help-tab">
            <h2>How to Use</h2>
            
            <div className="help-section">
              <h3>1. Index a Repository</h3>
              <p>Go to the <strong>Repositories</strong> tab and click <strong>Index</strong> on any repository. This process:</p>
              <ul>
                <li>Fetches all code files from the repository</li>
                <li>Splits them into semantic chunks (functions, classes, etc.)</li>
                <li>Generates AI embeddings for each chunk</li>
                <li>Stores them in a vector database</li>
              </ul>
              <p className="note">⏱️ Indexing takes 1-30 minutes depending on repository size</p>
            </div>

            <div className="help-section">
              <h3>2. Ask Questions</h3>
              <p>After indexing, go to the <strong>Query Code</strong> tab and ask natural language questions:</p>
              <ul>
                <li>"How does user authentication work?"</li>
                <li>"What APIs does this service expose?"</li>
                <li>"Where is payment processing implemented?"</li>
                <li>"How do we handle errors?"</li>
                <li>"What's the database schema?"</li>
              </ul>
            </div>

            <div className="help-section">
              <h3>3. View Code References</h3>
              <p>Each answer includes:</p>
              <ul>
                <li>📝 Business-friendly explanation</li>
                <li>📎 Relevant code references with file paths</li>
                <li>📊 Confidence score</li>
                <li>🎯 Similarity matching for each reference</li>
              </ul>
            </div>

            <div className="help-section">
              <h3>Tips</h3>
              <ul>
                <li>✅ Index repositories once, query many times</li>
                <li>✅ Be specific in your questions</li>
                <li>✅ Check indexing status before querying</li>
                <li>⚠️ Re-index after major code changes</li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Helper function for language colors
function getLanguageColor(language) {
  const colors = {
    'JavaScript': '#f1e05a',
    'TypeScript': '#2b7489',
    'Python': '#3572A5',
    'Java': '#b07219',
    'Go': '#00ADD8',
    'Ruby': '#701516',
    'PHP': '#4F5D95',
    'C++': '#f34b7d',
    'C': '#555555',
    'Rust': '#dea584',
  };
  return colors[language] || '#cccccc';
}

export default CodeIndexer;

