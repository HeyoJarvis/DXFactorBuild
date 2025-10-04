import { useState } from 'react';
import './TaskItem.css';

export default function TaskItem({ task, onToggle, onDelete, onUpdate, onChat }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(task.title);

  const handleSave = () => {
    if (editText.trim() && editText !== task.title) {
      onUpdate(task.id, { title: editText.trim() });
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      setEditText(task.title);
      setIsEditing(false);
    }
  };

  const getPriorityClass = () => {
    return `priority-${task.priority || 'medium'}`;
  };

  const getStatusIcon = () => {
    switch (task.status) {
      case 'completed':
        return '✓';
      case 'in_progress':
        return '⟳';
      default:
        return '○';
    }
  };

  return (
    <div className={`task-item ${task.status} ${getPriorityClass()}`}>
      <button 
        className="task-checkbox"
        onClick={() => onToggle(task.id, task.status)}
      >
        {getStatusIcon()}
      </button>

      {isEditing ? (
        <input
          className="task-edit-input"
          value={editText}
          onChange={(e) => setEditText(e.target.value)}
          onBlur={handleSave}
          onKeyDown={handleKeyDown}
          autoFocus
        />
      ) : (
        <div 
          className="task-content"
          onDoubleClick={() => setIsEditing(true)}
        >
          <div className="task-title">{task.title}</div>
          {task.priority && task.priority !== 'medium' && (
            <div className="task-priority-badge">{task.priority}</div>
          )}
        </div>
      )}

      <div className="task-actions">
        <button
          className="task-action-btn chat-btn"
          onClick={() => onChat && onChat(task)}
          title="AI Chat"
        >
          💬
        </button>
        <button
          className="task-action-btn delete-btn"
          onClick={() => onDelete(task.id)}
          title="Delete task"
        >
          🗑️
        </button>
      </div>
    </div>
  );
}

