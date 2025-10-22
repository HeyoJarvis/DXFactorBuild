import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('React Error Boundary caught an error:', error, errorInfo);
    this.setState({
      error,
      errorInfo
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: '2rem',
          maxWidth: '800px',
          margin: '2rem auto',
          background: '#fee2e2',
          border: '2px solid #ef4444',
          borderRadius: '8px'
        }}>
          <h2 style={{ color: '#991b1b', marginTop: 0 }}>⚠️ Something went wrong</h2>
          <p style={{ color: '#7f1d1d' }}>
            The application encountered an error. Please refresh the page or restart the app.
          </p>
          
          {this.state.error && (
            <details style={{
              marginTop: '1rem',
              background: 'white',
              padding: '1rem',
              borderRadius: '4px',
              border: '1px solid #fca5a5'
            }}>
              <summary style={{ cursor: 'pointer', fontWeight: 'bold', marginBottom: '0.5rem' }}>
                Error Details
              </summary>
              <pre style={{
                fontSize: '0.85rem',
                overflow: 'auto',
                background: '#f9fafb',
                padding: '0.5rem',
                borderRadius: '4px',
                border: '1px solid #e5e7eb'
              }}>
                {this.state.error.toString()}
                {'\n\n'}
                {this.state.errorInfo.componentStack}
              </pre>
            </details>
          )}
          
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: '1rem',
              padding: '0.5rem 1rem',
              background: '#2563eb',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: '500'
            }}
          >
            🔄 Reload Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;

