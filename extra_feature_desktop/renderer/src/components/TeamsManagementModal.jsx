import React, { useState, useEffect } from 'react';
import '../pages/Teams.css';

// Common timezones for selection
const TIMEZONES = [
  { label: 'Pacific Time (US)', value: 'America/Los_Angeles' },
  { label: 'Mountain Time (US)', value: 'America/Denver' },
  { label: 'Central Time (US)', value: 'America/Chicago' },
  { label: 'Eastern Time (US)', value: 'America/New_York' },
  { label: 'UK Time', value: 'Europe/London' },
  { label: 'Central European Time', value: 'Europe/Paris' },
  { label: 'Eastern European Time', value: 'Europe/Bucharest' },
  { label: 'India Standard Time', value: 'Asia/Kolkata' },
  { label: 'China Standard Time', value: 'Asia/Shanghai' },
  { label: 'Japan Standard Time', value: 'Asia/Tokyo' },
  { label: 'Australia Eastern Time', value: 'Australia/Sydney' },
  { label: 'New Zealand Time', value: 'Pacific/Auckland' },
  { label: 'UTC', value: 'UTC' }
];

const COLORS = [
  '#3B82F6', // blue
  '#10B981', // green
  '#F59E0B', // yellow
  '#EF4444', // red
  '#8B5CF6', // purple
  '#EC4899', // pink
  '#06B6D4', // cyan
  '#F97316', // orange
];

function TeamsManagementModal({ team, onClose, onSave }) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    timezone: 'America/New_York',
    color: '#3B82F6'
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (team) {
      setFormData({
        name: team.name || '',
        description: team.description || '',
        timezone: team.timezone || 'America/New_York',
        color: team.color || '#3B82F6'
      });
    }
  }, [team]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!formData.name.trim()) {
      setError('Team name is required');
      return;
    }

    if (!formData.timezone) {
      setError('Timezone is required');
      return;
    }

    setSaving(true);

    try {
      let result;
      
      if (team) {
        // Update existing team
        result = await window.electronAPI.teams.update(team.id, formData);
      } else {
        // Create new team
        result = await window.electronAPI.teams.create(formData);
      }

      if (result.success) {
        onSave();
      } else {
        setError(result.error || 'Failed to save team');
      }
    } catch (error) {
      setError(error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{team ? 'Edit Team' : 'Create New Team'}</h2>
          <button className="btn-close" onClick={onClose}>✕</button>
        </div>

        <form onSubmit={handleSubmit} className="modal-body">
          {error && (
            <div className="alert alert-error">
              {error}
            </div>
          )}

          <div className="form-group">
            <label htmlFor="name">Team Name *</label>
            <input
              type="text"
              id="name"
              className="form-control"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Frontend Team, Backend Team"
              required
              autoFocus
            />
          </div>

          <div className="form-group">
            <label htmlFor="description">Description</label>
            <textarea
              id="description"
              className="form-control"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Brief description of the team's focus"
              rows="3"
            />
          </div>

          <div className="form-group">
            <label htmlFor="timezone">Timezone *</label>
            <select
              id="timezone"
              className="form-control"
              value={formData.timezone}
              onChange={(e) => setFormData({ ...formData, timezone: e.target.value })}
              required
            >
              {TIMEZONES.map(tz => (
                <option key={tz.value} value={tz.value}>
                  {tz.label}
                </option>
              ))}
            </select>
            <small className="form-hint">
              Team's primary timezone for working hours calculation
            </small>
          </div>

          <div className="form-group">
            <label>Team Color</label>
            <div className="color-picker">
              {COLORS.map(color => (
                <button
                  key={color}
                  type="button"
                  className={`color-option ${formData.color === color ? 'selected' : ''}`}
                  style={{ backgroundColor: color }}
                  onClick={() => setFormData({ ...formData, color })}
                  title={color}
                />
              ))}
            </div>
            <small className="form-hint">
              Used for visual identification in the UI
            </small>
          </div>

          <div className="modal-footer">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={saving}
            >
              {saving ? 'Saving...' : (team ? 'Update Team' : 'Create Team')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default TeamsManagementModal;

