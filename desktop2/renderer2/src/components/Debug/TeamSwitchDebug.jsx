import { useState, useEffect } from 'react';
import './TeamSwitchDebug.css';

/**
 * Debug component to verify team switching infrastructure
 * Shows API availability, teams loaded, and current state
 */
export default function TeamSwitchDebug({ mode, teams, selectedTeam, loading }) {
  const [apiStatus, setApiStatus] = useState({});
  const [testResults, setTestResults] = useState([]);

  useEffect(() => {
    checkAPIAvailability();
  }, []);

  const checkAPIAvailability = () => {
    const status = {
      electronAPI: !!window.electronAPI,
      teamChat: !!window.electronAPI?.teamChat,
      loadTeams: !!window.electronAPI?.teamChat?.loadTeams,
      getHistory: !!window.electronAPI?.teamChat?.getHistory,
      sendMessage: !!window.electronAPI?.teamChat?.sendMessage,
      saveContextSettings: !!window.electronAPI?.teamChat?.saveContextSettings
    };
    
    setApiStatus(status);
    console.log('🔍 Team Switch Debug - API Status:', status);
  };

  const runDiagnostics = async () => {
    const results = [];
    
    // Test 1: Check electronAPI
    results.push({
      test: 'ElectronAPI Available',
      status: apiStatus.electronAPI ? '✅ PASS' : '❌ FAIL',
      details: apiStatus.electronAPI ? 'window.electronAPI is present' : 'window.electronAPI is missing'
    });

    // Test 2: Check teamChat namespace
    results.push({
      test: 'TeamChat Namespace',
      status: apiStatus.teamChat ? '✅ PASS' : '❌ FAIL',
      details: apiStatus.teamChat ? 'teamChat namespace exists' : 'teamChat namespace missing'
    });

    // Test 3: Check loadTeams function
    results.push({
      test: 'loadTeams Function',
      status: apiStatus.loadTeams ? '✅ PASS' : '❌ FAIL',
      details: apiStatus.loadTeams ? 'loadTeams function available' : 'loadTeams function missing'
    });

    // Test 4: Try calling loadTeams
    if (apiStatus.loadTeams) {
      try {
        const result = await window.electronAPI.teamChat.loadTeams();
        results.push({
          test: 'Load Teams Call',
          status: result.success ? '✅ PASS' : '❌ FAIL',
          details: result.success 
            ? `Loaded ${result.teams?.length || 0} teams` 
            : `Error: ${result.error}`
        });
      } catch (error) {
        results.push({
          test: 'Load Teams Call',
          status: '❌ FAIL',
          details: `Exception: ${error.message}`
        });
      }
    }

    setTestResults(results);
  };

  return (
    <div className="team-switch-debug">
      <div className="debug-header">
        <h3>🔧 Team Switch Debug Panel</h3>
        <button onClick={runDiagnostics} className="debug-test-button">
          Run Diagnostics
        </button>
      </div>

      <div className="debug-section">
        <h4>API Status</h4>
        <div className="debug-grid">
          {Object.entries(apiStatus).map(([key, value]) => (
            <div key={key} className="debug-row">
              <span className="debug-label">{key}:</span>
              <span className={`debug-value ${value ? 'success' : 'error'}`}>
                {value ? '✅' : '❌'}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="debug-section">
        <h4>Current State</h4>
        <div className="debug-grid">
          <div className="debug-row">
            <span className="debug-label">Mode:</span>
            <span className="debug-value">{mode}</span>
          </div>
          <div className="debug-row">
            <span className="debug-label">Teams Loaded:</span>
            <span className="debug-value">{teams?.length || 0}</span>
          </div>
          <div className="debug-row">
            <span className="debug-label">Selected Team:</span>
            <span className="debug-value">{selectedTeam?.name || 'None'}</span>
          </div>
          <div className="debug-row">
            <span className="debug-label">Loading:</span>
            <span className="debug-value">{loading ? 'Yes' : 'No'}</span>
          </div>
        </div>
      </div>

      {teams && teams.length > 0 && (
        <div className="debug-section">
          <h4>Available Teams</h4>
          <ul className="debug-list">
            {teams.map(team => (
              <li key={team.id} className="debug-list-item">
                <strong>{team.name}</strong>
                <span className="debug-list-meta">({team.slug})</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {testResults.length > 0 && (
        <div className="debug-section">
          <h4>Diagnostic Results</h4>
          {testResults.map((result, index) => (
            <div key={index} className="debug-test-result">
              <div className="debug-test-name">{result.test}</div>
              <div className="debug-test-status">{result.status}</div>
              <div className="debug-test-details">{result.details}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}



