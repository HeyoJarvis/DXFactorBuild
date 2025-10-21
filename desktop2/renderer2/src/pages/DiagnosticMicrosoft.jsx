import React, { useState } from 'react';

/**
 * Microsoft Authentication Diagnostic Tool
 * 
 * This page helps diagnose Microsoft authentication issues
 */
export default function DiagnosticMicrosoft() {
  const [logs, setLogs] = useState([]);
  const [testing, setTesting] = useState(false);

  const addLog = (message, type = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, { timestamp, message, type }]);
    console.log(`[${timestamp}] ${message}`);
  };

  const testAuthentication = async () => {
    setTesting(true);
    setLogs([]);
    
    try {
      addLog('🔍 Starting Microsoft authentication diagnostic...', 'info');
      
      // 1. Check if electronAPI exists
      addLog('1️⃣  Checking if window.electronAPI exists...', 'info');
      if (!window.electronAPI) {
        addLog('❌ window.electronAPI is undefined!', 'error');
        return;
      }
      addLog('✅ window.electronAPI exists', 'success');
      
      // 2. Check if microsoft object exists
      addLog('2️⃣  Checking if window.electronAPI.microsoft exists...', 'info');
      if (!window.electronAPI.microsoft) {
        addLog('❌ window.electronAPI.microsoft is undefined!', 'error');
        return;
      }
      addLog('✅ window.electronAPI.microsoft exists', 'success');
      
      // 3. Check if authenticate method exists
      addLog('3️⃣  Checking if authenticate method exists...', 'info');
      if (!window.electronAPI.microsoft.authenticate) {
        addLog('❌ window.electronAPI.microsoft.authenticate is undefined!', 'error');
        return;
      }
      addLog('✅ authenticate method exists', 'success');
      
      // 4. Call authenticate
      addLog('4️⃣  Calling window.electronAPI.microsoft.authenticate()...', 'info');
      addLog('⏳ Waiting for response (timeout: 2 minutes)...', 'info');
      
      const startTime = Date.now();
      
      try {
        const result = await window.electronAPI.microsoft.authenticate();
        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        
        addLog(`✅ Got response after ${duration}s`, 'success');
        addLog(`Response: ${JSON.stringify(result, null, 2)}`, 'info');
        
        if (result.success) {
          addLog('🎉 Authentication successful!', 'success');
          if (result.account) {
            addLog(`Account: ${result.account}`, 'success');
          }
        } else {
          addLog(`❌ Authentication failed: ${result.error}`, 'error');
        }
        
      } catch (error) {
        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        addLog(`❌ Error after ${duration}s: ${error.message}`, 'error');
        addLog(`Error stack: ${error.stack}`, 'error');
      }
      
    } catch (error) {
      addLog(`❌ Diagnostic error: ${error.message}`, 'error');
    } finally {
      setTesting(false);
    }
  };

  const getLogColor = (type) => {
    switch (type) {
      case 'success': return '#34C759';
      case 'error': return '#FF3B30';
      case 'warning': return '#FF9500';
      default: return '#8E8E93';
    }
  };

  return (
    <div style={{
      padding: '40px',
      maxWidth: '1200px',
      margin: '0 auto',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    }}>
      <h1 style={{ marginBottom: '10px' }}>🔧 Microsoft Authentication Diagnostic</h1>
      <p style={{ color: '#8E8E93', marginBottom: '30px' }}>
        This tool helps diagnose Microsoft Teams authentication issues
      </p>

      <button
        onClick={testAuthentication}
        disabled={testing}
        style={{
          padding: '12px 24px',
          fontSize: '16px',
          fontWeight: '600',
          color: 'white',
          background: testing ? '#8E8E93' : '#007AFF',
          border: 'none',
          borderRadius: '8px',
          cursor: testing ? 'not-allowed' : 'pointer',
          marginBottom: '30px'
        }}
      >
        {testing ? '⏳ Testing...' : '🧪 Run Diagnostic Test'}
      </button>

      {logs.length > 0 && (
        <div style={{
          background: '#1C1C1E',
          borderRadius: '12px',
          padding: '20px',
          fontFamily: 'Monaco, Menlo, monospace',
          fontSize: '13px',
          maxHeight: '600px',
          overflowY: 'auto'
        }}>
          {logs.map((log, index) => (
            <div key={index} style={{
              marginBottom: '8px',
              color: getLogColor(log.type),
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word'
            }}>
              <span style={{ color: '#8E8E93' }}>[{log.timestamp}]</span> {log.message}
            </div>
          ))}
        </div>
      )}

      <div style={{
        marginTop: '40px',
        padding: '20px',
        background: '#F2F2F7',
        borderRadius: '12px'
      }}>
        <h3 style={{ marginTop: 0 }}>📋 Common Issues</h3>
        <ul style={{ lineHeight: '1.8' }}>
          <li><strong>Port 8890 in use:</strong> Another OAuth flow may be running. Restart the app.</li>
          <li><strong>Timeout:</strong> Check Azure app configuration (see FIX_TEAMS_AUTH_TIMEOUT.md)</li>
          <li><strong>User not authenticated:</strong> Sign in first before connecting Teams</li>
          <li><strong>Reply was never sent:</strong> IPC handler may not be registered properly</li>
        </ul>
      </div>

      <div style={{
        marginTop: '20px',
        padding: '20px',
        background: '#FFF3CD',
        borderRadius: '12px',
        borderLeft: '4px solid #FF9500'
      }}>
        <h3 style={{ marginTop: 0 }}>⚠️ Expected Behavior</h3>
        <ol style={{ lineHeight: '1.8', marginBottom: 0 }}>
          <li>Click "Run Diagnostic Test"</li>
          <li>Browser window should open for Microsoft login</li>
          <li>Sign in with your Microsoft account</li>
          <li>Browser shows "✅ Authentication Successful!"</li>
          <li>This page shows success message with your account</li>
        </ol>
      </div>
    </div>
  );
}

