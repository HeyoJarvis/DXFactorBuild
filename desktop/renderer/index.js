// Entry point for the renderer process
import React from 'react';
import { createRoot } from 'react-dom/client';

// Main App component
function App() {
  return (
    <div id="app">
      <h1>HeyJarvis Desktop</h1>
      <p>Competitive Intelligence Dashboard</p>
      <div id="content">
        {/* App content will be loaded here */}
      </div>
    </div>
  );
}

// Initialize the React app
const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<App />);
} else {
  // Fallback for non-React content
  console.log('HeyJarvis Desktop renderer loaded');
}
