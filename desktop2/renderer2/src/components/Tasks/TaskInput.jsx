import { useState } from 'react';
import './TaskInput.css';

export default function TaskInput({ onAdd }) {
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState('medium');
  const [progress, setProgress] = useState(0);
  const [source, setSource] = useState('manual');
  const [showAdvanced, setShowAdvanced] = useState(false);

  const handleSubmit = () => {
    const trimmed = title.trim();
    if (!trimmed) return;

    onAdd({
      title: trimmed,
      priority,
      status: progress === 100 ? 'completed' : progress > 0 ? 'in_progress' : 'todo',
      progress: progress || undefined,
      source: source !== 'manual' ? source : undefined
    });

    setTitle('');
    setPriority('medium');
    setProgress(0);
    setSource('manual');
    setShowAdvanced(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="task-input-section">
      <div className="task-input-wrapper">
        <input
          type="text"
          className="task-input"
          placeholder="What needs to be done?"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <button 
          className="advanced-toggle-btn"
          onClick={() => setShowAdvanced(!showAdvanced)}
          title="Advanced options"
        >
          ⚙️
        </button>
        <button className="add-task-btn" onClick={handleSubmit}>
          + Add Task
        </button>
      </div>
      
      <div className="priority-selector">
        {['low', 'medium', 'high', 'urgent'].map((p) => (
          <button
            key={p}
            className={`priority-btn ${priority === p ? 'active' : ''}`}
            onClick={() => setPriority(p)}
          >
            {p}
          </button>
        ))}
      </div>

      {showAdvanced && (
        <div className="advanced-options">
          <div className="option-group">
            <label>Progress: {progress}%</label>
            <input
              type="range"
              min="0"
              max="100"
              step="5"
              value={progress}
              onChange={(e) => setProgress(parseInt(e.target.value))}
              className="progress-slider"
            />
          </div>
          
          <div className="option-group">
            <label>Source:</label>
            <select 
              value={source} 
              onChange={(e) => setSource(e.target.value)}
              className="source-select"
            >
              <option value="manual">✏️ Manual</option>
              <option value="slack">💬 Slack</option>
              <option value="teams">🎯 Teams</option>
              <option value="email">📧 Email</option>
              <option value="jira">📋 JIRA</option>
              <option value="crm">💼 CRM</option>
            </select>
          </div>
        </div>
      )}
    </div>
  );
}

