import { NavLink } from 'react-router-dom';
import './Navigation.css';

export default function Navigation({ onMinimize }) {
  const handleMinimize = () => {
    if (onMinimize) {
      onMinimize();
    }
  };

  return (
    <nav className="navigation">
      <div className="nav-brand">
        <span className="nav-logo">🤖</span>
        <span className="nav-title">HeyJarvis</span>
      </div>
      
      <div className="nav-center">
        <div className="nav-links">
          <NavLink 
            to="/copilot" 
            className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}
          >
            <span className="nav-icon">💬</span>
            <span className="nav-label">Copilot</span>
          </NavLink>
          
          <NavLink 
            to="/tasks" 
            className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}
          >
            <span className="nav-icon">✓</span>
            <span className="nav-label">Tasks</span>
          </NavLink>
        </div>
      </div>

      <div className="nav-controls">
        <button 
          className="nav-control-btn minimize-btn" 
          onClick={handleMinimize}
          title="Minimize to header"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path 
              d="M6 12L18 12" 
              stroke="currentColor" 
              strokeWidth="2" 
              strokeLinecap="round" 
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>
    </nav>
  );
}

