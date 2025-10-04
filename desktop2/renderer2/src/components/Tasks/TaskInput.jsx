import { useState } from 'react';
import './TaskInput.css';

export default function TaskInput({ onAdd }) {
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState('medium');

  const handleSubmit = () => {
    const trimmed = title.trim();
    if (!trimmed) return;

    onAdd({
      title: trimmed,
      priority,
      status: 'todo'
    });

    setTitle('');
    setPriority('medium');
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
    </div>
  );
}

