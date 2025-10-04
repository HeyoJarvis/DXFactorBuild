import { useState } from 'react';
import { useTasks } from '../hooks/useTasks';
import TaskInput from '../components/Tasks/TaskInput';
import TaskList from '../components/Tasks/TaskList';
import TaskChat from '../components/Tasks/TaskChat';
import './Tasks.css';

export default function Tasks() {
  const { 
    tasks, 
    loading, 
    addTask, 
    updateTask, 
    deleteTask, 
    toggleTask,
    stats 
  } = useTasks();
  
  const [chatTask, setChatTask] = useState(null);

  const handleAddTask = async (taskData) => {
    try {
      await addTask(taskData);
    } catch (error) {
      console.error('Failed to add task:', error);
    }
  };

  const handleUpdateTask = async (taskId, updates) => {
    try {
      await updateTask(taskId, updates);
    } catch (error) {
      console.error('Failed to update task:', error);
    }
  };

  const handleDeleteTask = async (taskId) => {
    try {
      await deleteTask(taskId);
    } catch (error) {
      console.error('Failed to delete task:', error);
    }
  };

  const handleToggleTask = async (taskId, currentStatus) => {
    try {
      await toggleTask(taskId, currentStatus);
    } catch (error) {
      console.error('Failed to toggle task:', error);
    }
  };

  if (loading) {
    return (
      <div className="tasks-page loading">
        <div className="loading-spinner">Loading tasks...</div>
      </div>
    );
  }

  return (
    <div className="tasks-page">
      <div className="tasks-header">
        <div className="tasks-title">
          <span className="tasks-icon">✓</span>
          <span>My Tasks</span>
        </div>
        
        <div className="task-stats">
          <div className="stat-item">
            <div className="stat-dot todo"></div>
            <span>{stats.todo} To Do</span>
          </div>
          <div className="stat-item">
            <div className="stat-dot in-progress"></div>
            <span>{stats.inProgress} In Progress</span>
          </div>
          <div className="stat-item">
            <div className="stat-dot completed"></div>
            <span>{stats.completed} Done</span>
          </div>
        </div>
      </div>

      <TaskInput onAdd={handleAddTask} />
      
      <TaskList
        tasks={tasks}
        onToggle={handleToggleTask}
        onDelete={handleDeleteTask}
        onUpdate={handleUpdateTask}
        onChat={setChatTask}
      />
      
      {/* Task Chat Modal */}
      {chatTask && (
        <TaskChat 
          task={chatTask} 
          onClose={() => setChatTask(null)} 
        />
      )}
    </div>
  );
}
