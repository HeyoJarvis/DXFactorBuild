import { useState } from 'react';
import './Login.css';

export default function Login({ onLoginSuccess }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSlackLogin = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('🔐 Starting Slack login...');
      const result = await window.electronAPI.auth.signInWithSlack();
      
      if (result.success) {
        console.log('✅ Slack login successful!', result.user);
        if (onLoginSuccess) {
          onLoginSuccess(result.user, result.session);
        }
      } else {
        throw new Error(result.error || 'Login failed');
      }
    } catch (err) {
      console.error('❌ Slack login failed:', err);
      setError(err.message || 'Failed to sign in with Slack');
    } finally {
      setLoading(false);
    }
  };

  const handleTeamsLogin = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('🔐 Starting Teams login...');
      const result = await window.electronAPI.auth.signInWithTeams();
      
      if (result.success) {
        console.log('✅ Teams login successful!', result.user);
        if (onLoginSuccess) {
          onLoginSuccess(result.user, result.session);
        }
      } else {
        throw new Error(result.error || 'Login failed');
      }
    } catch (err) {
      console.error('❌ Teams login failed:', err);
      setError(err.message || 'Failed to sign in with Teams');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-container">
        <div className="logo-container">
          <div className="logo">🤖</div>
          <h1>Welcome to HeyJarvis</h1>
          <p className="subtitle">Your AI-powered business intelligence assistant</p>
        </div>

        <div className="sign-in-section">
          <button 
            className="slack-button"
            onClick={handleSlackLogin}
            disabled={loading}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z"/>
            </svg>
            {loading ? 'Signing in...' : 'Sign in with Slack'}
          </button>

          <div className="divider">
            <span>or</span>
          </div>

          <button 
            className="teams-button"
            onClick={handleTeamsLogin}
            disabled={loading}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20.625 8.127h-2.997V5.647c0-1.656-1.344-3-3-3h-9.375c-1.656 0-3 1.344-3 3v7.5c0 1.656 1.344 3 3 3h2.25v2.25c0 1.656 1.344 3 3 3h9.122c1.656 0 3-1.344 3-3v-7.27c0-1.656-1.344-3-3-3zm-12.75 4.77h-2.625c-.825 0-1.5-.675-1.5-1.5v-7.5c0-.825.675-1.5 1.5-1.5h9.375c.825 0 1.5.675 1.5 1.5v7.5c0 .825-.675 1.5-1.5 1.5h-5.25a1.5 1.5 0 0 0-1.5 1.5v-1.5zm12.75 7.5c0 .825-.675 1.5-1.5 1.5h-9.122c-.825 0-1.5-.675-1.5-1.5v-8.145c.459.201.961.312 1.5.312h5.25c1.656 0 3-1.344 3-3v-2.436h2.997c.825 0 1.5.675 1.5 1.5v11.769zM13.875 9.75c.621 0 1.125.504 1.125 1.125s-.504 1.125-1.125 1.125-1.125-.504-1.125-1.125.504-1.125 1.125-1.125z"/>
            </svg>
            {loading ? 'Signing in...' : 'Sign in with Microsoft Teams'}
          </button>
        </div>

        {error && (
          <div className="error-message">
            {error}
          </div>
        )}

        <div className="footer-text">
          By signing in, you agree to our Terms of Service and Privacy Policy
        </div>
      </div>
    </div>
  );
}


