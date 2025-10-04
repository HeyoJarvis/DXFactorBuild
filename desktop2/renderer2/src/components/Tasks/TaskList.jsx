import TaskItem from './TaskItem';
import './TaskList.css';

export default function TaskList({ tasks, onToggle, onDelete, onUpdate, onChat }) {
  if (tasks.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-icon">📋</div>
        <div>No tasks yet. Add one above to get started!</div>
      </div>
    );
  }

  return (
    <div className="task-list">
      {tasks.map(task => (
        <TaskItem
          key={task.id}
          task={task}
          onToggle={onToggle}
          onDelete={onDelete}
          onUpdate={onUpdate}
          onChat={onChat}
        />
      ))}
    </div>
  );
}

