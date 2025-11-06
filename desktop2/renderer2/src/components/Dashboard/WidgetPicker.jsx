import { useEffect, useRef } from 'react';
import './WidgetPicker.css';

/**
 * WidgetPicker - Modal for selecting widget type
 * 
 * @param {Function} onSelect - Callback when widget type is selected
 * @param {Function} onClose - Callback when picker should close
 */
export default function WidgetPicker({ onSelect, onClose }) {
  const pickerRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target)) {
        onClose();
      }
    };

    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  const widgetTypes = [
    {
      type: 'jira-by-team',
      icon: '👥',
      label: 'JIRA by Team',
      description: 'Track team progress'
    },
    {
      type: 'jira-by-unit',
      icon: '🏢',
      label: 'JIRA by Unit',
      description: 'Track unit progress'
    },
    {
      type: 'jira-by-person',
      icon: '👤',
      label: 'JIRA by Person',
      description: 'Track individual progress'
    },
    {
      type: 'jira-by-feature',
      icon: '🎯',
      label: 'JIRA by Feature',
      description: 'Track feature progress'
    },
    {
      type: 'feature-progress',
      icon: '💻',
      label: 'Feature Progress',
      description: 'Track via codebase'
    },
    {
      type: 'slack-messages',
      icon: '💬',
      label: 'Slack Messages',
      description: 'Track Slack activity'
    },
    {
      type: 'teams-messages',
      icon: '📢',
      label: 'Teams Messages',
      description: 'Track Teams activity'
    },
    {
      type: 'email-tracker',
      icon: '📧',
      label: 'Email Tracker',
      description: 'Track emails from sender'
    }
  ];

  const handleSelect = (type) => {
    onSelect(type);
    onClose();
  };

  return (
    <div className="widget-picker-overlay" onClick={onClose}>
      <div
        ref={pickerRef}
        className="widget-picker"
        onClick={(e) => e.stopPropagation()}
      >
      <div className="widget-picker-header">
        <span>Choose Widget Type</span>
        <button className="widget-picker-close" onClick={onClose}>×</button>
      </div>
      <div className="widget-picker-options">
        {widgetTypes.map(widget => (
          <button
            key={widget.type}
            className="widget-picker-option"
            onClick={() => handleSelect(widget.type)}
          >
            <span className="widget-picker-icon">{widget.icon}</span>
            <div className="widget-picker-info">
              <span className="widget-picker-label">{widget.label}</span>
              <span className="widget-picker-description">{widget.description}</span>
            </div>
          </button>
        ))}
      </div>
      </div>
    </div>
  );
}

