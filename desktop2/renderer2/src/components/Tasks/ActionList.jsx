import ActionItem from './ActionItem';
import './ActionList.css';

/**
 * ActionList Component
 * Displays action items in a clean, organized list
 */
export default function ActionList({ tasks, onToggle, onDelete, onUpdate, onChat, onMonitor, isTeamDevView }) {
  if (tasks.length === 0) {
    return (
      <div className="action-empty-state">
        <div className="empty-icon">✨</div>
        <div className="empty-title">No Action Items</div>
        <div className="empty-subtitle">
          {isTeamDevView ? 'No developer tasks found' : 'Add a new task to get started on your goals'}
        </div>
      </div>
    );
  }

  return (
    <div className="action-list-items">
      {tasks.map((task, index) => (
        <ActionItem
          key={task.id}
          task={task}
          index={index}
          onToggle={onToggle}
          onDelete={onDelete}
          onUpdate={onUpdate}
          onChat={onChat}
          onMonitor={onMonitor}
          isTeamDevView={isTeamDevView}
        />
      ))}
    </div>
  );
}

