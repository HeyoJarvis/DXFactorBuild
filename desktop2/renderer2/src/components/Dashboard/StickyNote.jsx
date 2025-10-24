import { useState, useRef, useEffect } from 'react';
import './StickyNote.css';

/**
 * StickyNote - Draggable sticky note component for quick reminders
 * 
 * @param {Object} note - Note data with id, x, y, content, color
 * @param {Function} onUpdate - Callback when note is updated
 * @param {Function} onDelete - Callback when note is deleted
 */
export default function StickyNote({ note, onUpdate, onDelete }) {
  const [isDragging, setIsDragging] = useState(false);
  const [isEditing, setIsEditing] = useState(!note.content);
  const dragOffset = useRef({ x: 0, y: 0 });
  const noteRef = useRef(null);

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (isDragging) {
        const newX = e.clientX - dragOffset.current.x;
        const newY = e.clientY - dragOffset.current.y;
        
        onUpdate(note.id, { x: newX, y: newY });
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, note.id, onUpdate]);

  const handleMouseDown = (e) => {
    if (e.target.closest('.sticky-note-header')) {
      setIsDragging(true);
      dragOffset.current = {
        x: e.clientX - note.x,
        y: e.clientY - note.y
      };
    }
  };

  const handleContentChange = (e) => {
    onUpdate(note.id, { content: e.target.value });
  };

  const handleBlur = () => {
    setIsEditing(false);
  };

  const handleTextClick = () => {
    if (!isDragging) {
      setIsEditing(true);
    }
  };

  return (
    <div
      ref={noteRef}
      className={`sticky-note ${isDragging ? 'dragging' : ''}`}
      style={{
        left: `${note.x}px`,
        top: `${note.y}px`,
        backgroundColor: note.color
      }}
      onMouseDown={handleMouseDown}
    >
      <div className="sticky-note-header">
        <span className="sticky-note-icon">📌</span>
        <button 
          className="sticky-note-delete"
          onClick={() => onDelete(note.id)}
          title="Delete note"
        >
          ×
        </button>
      </div>
      
      <div className="sticky-note-content">
        {isEditing ? (
          <textarea
            value={note.content}
            onChange={handleContentChange}
            onBlur={handleBlur}
            placeholder="Type your note..."
            autoFocus
          />
        ) : (
          <div 
            className="sticky-note-text"
            onClick={handleTextClick}
          >
            {note.content || 'Click to edit...'}
          </div>
        )}
      </div>

      <div className="sticky-note-timestamp">
        {new Date(note.createdAt).toLocaleDateString()}
      </div>
    </div>
  );
}

