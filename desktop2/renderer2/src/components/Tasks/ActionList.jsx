import ActionItem from './ActionItem';
import './ActionList.css';

/**
 * ActionList Component
 * Displays action items in a clean, organized list
 */
export default function ActionList({ tasks, onToggle, onDelete, onUpdate, onChat }) {
  if (tasks.length === 0) {
    return (
      <div className="action-empty-state">
        <div className="empty-icon">✨</div>
        <div className="empty-title">No Action Items</div>
        <div className="empty-subtitle">Add a new task to get started on your goals</div>
      </div>
    );
  }

  return (
    <div className="action-list">
      <div className="action-list-header">
        <h2 className="action-list-title">Action Items:</h2>
        <div className="action-list-count">{tasks.length} items</div>
      </div>
      
      <div className="action-list-items">
        {tasks.map(task => (
          <ActionItem
            key={task.id}
            task={task}
            onToggle={onToggle}
            onDelete={onDelete}
            onUpdate={onUpdate}
            onChat={onChat}
          />
        ))}
      </div>
    </div>
  );
}

