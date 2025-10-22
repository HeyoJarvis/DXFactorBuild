import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Meetings from './pages/Meetings';
import TeamChat from './pages/TeamChat';
import Teams from './pages/Teams';
import JiraTasks from './pages/JiraTasks';
import CodeIndexer from './pages/CodeIndexer';
import Settings from './pages/Settings';
import Login from './pages/Login';
import './styles/App.css';

function Navigation({ user, onLogout }) {
  const location = useLocation();
  
  const isActive = (path) => location.pathname === path;
  
  return (
    <nav className="sidebar">
      <div className="app-header">
        <h1 className="app-title">Team Sync</h1>
        <p className="app-subtitle">Intelligence</p>
      </div>
      
      <div className="nav-links">
        <Link 
          to="/" 
          className={`nav-link ${isActive('/') ? 'active' : ''}`}
        >
          <span className="nav-icon">📊</span>
          <span className="nav-text">Dashboard</span>
        </Link>
        
        <Link 
          to="/meetings" 
          className={`nav-link ${isActive('/meetings') ? 'active' : ''}`}
        >
          <span className="nav-icon">📅</span>
          <span className="nav-text">Meetings</span>
        </Link>
        
        <Link 
          to="/chat" 
          className={`nav-link ${isActive('/chat') ? 'active' : ''}`}
        >
          <span className="nav-icon">💬</span>
          <span className="nav-text">Team Chat</span>
        </Link>
        
        <Link 
          to="/teams" 
          className={`nav-link ${isActive('/teams') ? 'active' : ''}`}
        >
          <span className="nav-icon">👥</span>
          <span className="nav-text">Teams</span>
        </Link>
        
        <Link 
          to="/jira" 
          className={`nav-link ${isActive('/jira') ? 'active' : ''}`}
        >
          <span className="nav-icon">📋</span>
          <span className="nav-text">JIRA Tasks</span>
        </Link>
        
        <Link 
          to="/code" 
          className={`nav-link ${isActive('/code') ? 'active' : ''}`}
        >
          <span className="nav-icon">🔍</span>
          <span className="nav-text">Code Indexer</span>
        </Link>
        
        <Link 
          to="/settings" 
          className={`nav-link ${isActive('/settings') ? 'active' : ''}`}
        >
          <span className="nav-icon">⚙️</span>
          <span className="nav-text">Settings</span>
        </Link>
      </div>
      
      <div className="sidebar-footer">
        <div className="user-info">
          <div className="user-avatar">
            {user.name ? user.name[0].toUpperCase() : 'U'}
          </div>
          <div className="user-details">
            <div className="user-name">{user.name || 'User'}</div>
            <div className="user-email">{user.email || ''}</div>
          </div>
        </div>
        <button className="btn btn-ghost btn-sm logout-btn" onClick={onLogout}>
          Logout
        </button>
      </div>
    </nav>
  );
}

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      // Check for existing session with Supabase
      const result = await window.electronAPI.auth.getSession();
      
      if (result.success && result.user) {
        setCurrentUser(result.user);
        setIsAuthenticated(true);
        
        // Initialize services with user
        await window.electronAPI.auth.initializeServices(result.user.id);
      }
    } catch (error) {
      console.error('Auth check failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (user) => {
    setCurrentUser(user);
    setIsAuthenticated(true);
    
    // Initialize services with user
    await window.electronAPI.auth.initializeServices(user.id);
  };

  const handleLogout = async () => {
    try {
      await window.electronAPI.auth.logout();
      setIsAuthenticated(false);
      setCurrentUser(null);
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  if (loading) {
    return (
      <div className="app-loading">
        <div className="loading-spinner"></div>
        <p>Loading...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <Router>
      <div className="app-container">
        <Navigation user={currentUser} onLogout={handleLogout} />
        <main className="main-content">
          <Routes>
            <Route path="/" element={<Dashboard user={currentUser} />} />
            <Route path="/meetings" element={<Meetings user={currentUser} />} />
            <Route path="/chat" element={<TeamChat user={currentUser} />} />
            <Route path="/teams" element={<Teams user={currentUser} />} />
            <Route path="/jira" element={<JiraTasks user={currentUser} />} />
            <Route path="/code" element={<CodeIndexer user={currentUser} />} />
            <Route path="/settings" element={<Settings user={currentUser} />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;

