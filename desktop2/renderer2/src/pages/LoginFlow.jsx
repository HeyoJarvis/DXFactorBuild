import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import './LoginFlow.css';
import './LoginFlowEnhancements.css';

/**
 * HeyJarvis Enterprise Login Flow
 * Multi-step onboarding: Auth → Workspace → Permissions → Success
 *
 * Flow States:
 * - welcome: Initial landing screen with provider selection
 * - authenticating: OAuth redirect in progress
 * - detectingWorkspace: Fetching user's workspaces
 * - selectingWorkspace: Choose from multiple workspaces
 * - creatingWorkspace: No workspaces found, create new
 * - reviewingPermissions: Grant app permissions
 * - success: Onboarding complete
 * - error: Error state with recovery options
 */

const FLOW_STATES = {
  WELCOME: 'welcome',
  AUTHENTICATING: 'authenticating',
  DETECTING_WORKSPACE: 'detectingWorkspace',
  SELECTING_WORKSPACE: 'selectingWorkspace',
  CREATING_WORKSPACE: 'creatingWorkspace',
  SELECTING_ROLE: 'selectingRole',
  SUCCESS: 'success',
  ERROR: 'error'
};

const PROGRESS_MAP = {
  [FLOW_STATES.WELCOME]: 0,
  [FLOW_STATES.AUTHENTICATING]: 20,
  [FLOW_STATES.DETECTING_WORKSPACE]: 40,
  [FLOW_STATES.SELECTING_WORKSPACE]: 50,
  [FLOW_STATES.CREATING_WORKSPACE]: 50,
  [FLOW_STATES.SELECTING_ROLE]: 75,
  [FLOW_STATES.SUCCESS]: 100
};

export default function LoginFlow({ onLoginSuccess }) {
  // State management
  const [flowState, setFlowState] = useState(FLOW_STATES.WELCOME);
  const [provider, setProvider] = useState(null);
  const [workspaces, setWorkspaces] = useState([]);
  const [selectedWorkspace, setSelectedWorkspace] = useState(null);
  const [newWorkspaceName, setNewWorkspaceName] = useState('');
  const [selectedRole, setSelectedRole] = useState(null);
  const [error, setError] = useState(null);
  const [loadingEmail, setLoadingEmail] = useState(false);
  const [authTimeout, setAuthTimeout] = useState(false);
  const [showMorphAnimation, setShowMorphAnimation] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);

  // Calculate progress
  const progress = PROGRESS_MAP[flowState] || 0;

  // Reset error when state changes
  useEffect(() => {
    setError(null);
  }, [flowState]);

  // Auth timeout handler (15 seconds)
  useEffect(() => {
    if (flowState === FLOW_STATES.AUTHENTICATING) {
      const timer = setTimeout(() => {
        setAuthTimeout(true);
      }, 15000);
      return () => clearTimeout(timer);
    } else {
      setAuthTimeout(false);
    }
  }, [flowState]);

  // ============================================
  // AUTH HANDLERS
  // ============================================

  const handleEmailLogin = async (e) => {
    e.preventDefault();
    
    if (!email || !password) {
      setError('Please enter both email and password');
      return;
    }

    try {
      setLoadingEmail(true);
      setError(null);
      setProvider('email');
      setFlowState(FLOW_STATES.AUTHENTICATING);

      console.log(`🔐 Starting email ${isSignUp ? 'sign up' : 'login'}...`);
      
      const result = isSignUp 
        ? await window.electronAPI.auth.signUpWithEmail(email, password)
        : await window.electronAPI.auth.signInWithEmail(email, password);

      if (result.success) {
        console.log(`✅ Email ${isSignUp ? 'sign up' : 'login'} successful!`, result.user);
        await handleAuthSuccess(result);
      } else {
        throw new Error(result.error || 'Authentication failed');
      }
    } catch (err) {
      console.error(`❌ Email ${isSignUp ? 'sign up' : 'login'} failed:`, err);
      handleAuthError(err.message || `Failed to ${isSignUp ? 'sign up' : 'sign in'} with email`);
    } finally {
      setLoadingEmail(false);
    }
  };

  const handleAuthSuccess = async (authResult) => {
    // Skip workspace/team creation entirely - go straight to role selection
    // Teams functionality is hidden in this app
    console.log('✅ Authentication successful, proceeding to role selection');
    setFlowState(FLOW_STATES.SELECTING_ROLE);
  };

  const handleAuthError = (message) => {
    setError(message);
    setFlowState(FLOW_STATES.WELCOME);
  };

  const handleRetryAuth = () => {
    setError(null);
    setFlowState(FLOW_STATES.WELCOME);
  };

  const handleOpenInBrowser = () => {
    // TODO: Implement deep link to browser
    console.log('Opening auth in browser...');
  };

  // ============================================
  // WORKSPACE HANDLERS
  // ============================================

  const handleSelectWorkspace = (workspace) => {
    setSelectedWorkspace(workspace);
  };

  const handleContinueWithWorkspace = async () => {
    if (!selectedWorkspace) return;
    
    try {
      setError(null);
      console.log('Joining team:', selectedWorkspace);
      
      // Join the selected team
      const result = await window.electronAPI.teams.join(selectedWorkspace.id, 'member');
      
      if (result.success) {
        console.log('✅ Successfully joined team:', result.team);
        setFlowState(FLOW_STATES.SELECTING_ROLE);
      } else {
        throw new Error(result.error || 'Failed to join team');
      }
    } catch (err) {
      console.error('Failed to join team:', err);
      setError(err.message || 'Failed to join team. Please try again.');
    }
  };

  const handleCreateWorkspace = async () => {
    if (!newWorkspaceName.trim()) return;

    try {
      setError(null);
      console.log('Creating workspace:', newWorkspaceName);
      
      // Generate slug from name
      const slug = newWorkspaceName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      
      const result = await window.electronAPI.teams.create({
        name: newWorkspaceName,
        slug,
        description: `${newWorkspaceName} workspace`,
        department: null
      });
      
      if (result.success) {
        console.log('✅ Team created successfully:', result.team);
        setSelectedWorkspace({
          id: result.team.id,
          name: result.team.name,
          role: 'owner'
        });
        setFlowState(FLOW_STATES.SELECTING_ROLE);
      } else {
        throw new Error(result.error || 'Failed to create team');
      }
    } catch (err) {
      console.error('Failed to create team:', err);
      setError(err.message || 'Failed to create team. Please try again.');
    }
  };

  const handleRequestApproval = () => {
    const subject = encodeURIComponent('HeyJarvis Installation Approval Request');
    const body = encodeURIComponent(
      `Hi,\n\nI'd like to install HeyJarvis in our workspace. Could you please grant me admin permissions?\n\nThanks!`
    );
    window.open(`mailto:?subject=${subject}&body=${body}`);
  };

  // ============================================
  // ROLE SELECTION HANDLERS
  // ============================================

  const handleSelectRole = (role) => {
    setSelectedRole(role);
  };

  const handleContinueWithRole = async () => {
    if (!selectedRole) return;

    // Save role to backend and complete onboarding
    try {
      console.log(`🎯 Saving role: ${selectedRole}`);

      if (window.electronAPI?.onboarding?.saveRole) {
        const result = await window.electronAPI.onboarding.saveRole(selectedRole);

        if (result.success) {
          console.log(`✅ Role saved: ${selectedRole}, user:`, result.user);

          // Mark onboarding as complete
          if (window.electronAPI?.onboarding?.complete) {
            await window.electronAPI.onboarding.complete();
          }

          // Go straight to Mission Control
          await handleOpenMissionControl();
        } else {
          throw new Error(result.error || 'Failed to save role');
        }
      } else {
        console.error('❌ onboarding.saveRole not available');
        setError('Unable to save role. Please try again.');
      }
    } catch (err) {
      console.error('❌ Failed to save role:', err);
      setError('Failed to save role preference. Please try again.');
    }
  };

  // ============================================
  // SUCCESS HANDLERS
  // ============================================

  const handleOpenMissionControl = async () => {
    try {
      // Get the authenticated user from the backend
      const authResult = await window.electronAPI.auth.getSession();
      
      if (authResult.success && authResult.session) {
        // Call onLoginSuccess with the actual user data
        if (onLoginSuccess) {
          onLoginSuccess(authResult.session.user, authResult.session);
        }
      } else {
        console.error('❌ No active session found');
        setError('Session expired. Please log in again.');
      }
    } catch (error) {
      console.error('❌ Failed to open Mission Control:', error);
      setError('Failed to load session. Please try again.');
    }
  };

  const handleInviteTeammates = () => {
    console.log('Opening invite modal...');
    // TODO: Open invite modal
  };

  const handleConnectIntegrations = () => {
    console.log('Opening integrations...');
    // TODO: Navigate to integrations
  };

  const handleAutoImport = () => {
    console.log('Starting auto-import...');
    // TODO: Start auto-import
  };

  // ============================================
  // RENDER METHODS
  // ============================================

  const renderWelcome = () => (
    <>
      <h1 className="login-flow-title login-flow-title-welcome">
        {isSignUp ? 'Create Your Account' : 'Welcome to HeyJarvis'}
      </h1>
      <div className="login-flow-logo-container">
        <img src="/Jarvis.png" alt="HeyJarvis" className="login-flow-logo" />
      </div>

      <div className="login-flow-divider" />

      <form onSubmit={handleEmailLogin} className="login-flow-form">
        <div className="login-flow-input-group">
          <label htmlFor="email" className="login-flow-label">Email</label>
          <input
            id="email"
            type="email"
            className="login-flow-input"
            placeholder="your.email@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loadingEmail}
            required
            autoComplete="email"
          />
        </div>

        <div className="login-flow-input-group">
          <label htmlFor="password" className="login-flow-label">Password</label>
          <input
            id="password"
            type="password"
            className="login-flow-input"
            placeholder="Enter your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loadingEmail}
            required
            autoComplete={isSignUp ? 'new-password' : 'current-password'}
          />
        </div>

        <button
          type="submit"
          className="login-flow-button login-flow-button-primary"
          disabled={loadingEmail}
        >
          {loadingEmail && <div className="login-flow-loader" />}
          <span>{isSignUp ? 'Sign Up' : 'Sign In'}</span>
        </button>
      </form>

      <div className="login-flow-toggle-auth">
        <button
          type="button"
          className="login-flow-link-button"
          onClick={() => {
            setIsSignUp(!isSignUp);
            setError(null);
          }}
          disabled={loadingEmail}
        >
          {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
        </button>
      </div>

      {error && (
        <div className="login-flow-error" role="alert">
          <ErrorIcon />
          <span>{error}</span>
        </div>
      )}

      <div className="login-flow-footer">
        <a href="#" className="login-flow-micro-copy">Need access codes?</a>
      </div>
    </>
  );

  const renderAuthenticating = () => (
    <>
      <h1 className="login-flow-title login-flow-title-cinematic">Authenticating</h1>
      <p className="login-flow-subtitle login-flow-subtitle-enhanced loading-text-pulse">
        Verifying credentials<span className="loading-dots"></span>
      </p>

      <div className="login-flow-divider" />

      {/* Orb Pulse Loading Animation */}
      <div className="orb-loading-container">
        <div className="orb-pulse"></div>
        <div className="orb-particle"></div>
        <div className="orb-particle"></div>
        <div className="orb-particle"></div>
        <div className="orb-particle"></div>
        <div className="orb-particle"></div>
        <div className="orb-particle"></div>
      </div>

      {authTimeout && (
        <div className="login-flow-mt-md">
          <p className="login-flow-body login-flow-mb-sm">Still working...</p>
          <button className="login-flow-link-button" onClick={handleOpenInBrowser}>
            Open auth in browser
          </button>
        </div>
      )}
    </>
  );

  const renderDetectingWorkspace = () => (
    <>
      <h1 className="login-flow-title login-flow-title-cinematic">Link your workspace</h1>
      <p className="login-flow-subtitle login-flow-subtitle-enhanced loading-text-pulse">
        Synchronizing Mission Data<span className="loading-dots"></span>
      </p>

      <div className="login-flow-divider" />

      {/* Orb Pulse Loading Animation */}
      <div className="orb-loading-container">
        <div className="orb-pulse"></div>
        <div className="orb-particle"></div>
        <div className="orb-particle"></div>
        <div className="orb-particle"></div>
        <div className="orb-particle"></div>
        <div className="orb-particle"></div>
        <div className="orb-particle"></div>
      </div>
    </>
  );

  const renderWorkspacePicker = () => (
    <>
      <h1 className="login-flow-title">Select a workspace</h1>
      <p className="login-flow-subtitle">
        You can request admin approval if needed.
      </p>

      <div className="login-flow-divider" />

      {/* Search or Create Input */}
      <input
        type="text"
        className="login-flow-input login-flow-workspace-search"
        placeholder="Search or create workspace..."
        aria-label="Search or create workspace"
      />

      <div className="login-flow-workspace-list">
        {workspaces.map(workspace => (
          <div
            key={workspace.id}
            className={`login-flow-workspace-item ${selectedWorkspace?.id === workspace.id ? 'selected' : ''}`}
            onClick={() => handleSelectWorkspace(workspace)}
            role="radio"
            aria-checked={selectedWorkspace?.id === workspace.id}
            tabIndex={0}
            onKeyPress={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                handleSelectWorkspace(workspace);
              }
            }}
          >
            <div className="login-flow-workspace-info">
              <div className="login-flow-workspace-name">{workspace.name}</div>
              <div className="login-flow-workspace-meta">
                {workspace.memberCount} members • Active {workspace.lastActive || '2 hours ago'}
              </div>
            </div>
            {selectedWorkspace?.id === workspace.id ? (
              <button className="login-flow-workspace-button selected">
                Selected
              </button>
            ) : (
              <button className="login-flow-workspace-button">
                Select
              </button>
            )}
          </div>
        ))}
      </div>

      <div className="login-flow-button-group-horizontal">
        <button
          className="login-flow-button login-flow-button-primary"
          onClick={handleContinueWithWorkspace}
          disabled={!selectedWorkspace}
        >
          <span className="button-shimmer"></span>
          Continue
        </button>

        <button
          className="login-flow-button login-flow-button-secondary"
          onClick={handleRequestApproval}
        >
          Request approval
        </button>
      </div>

      <p className="login-flow-footer-text">
        Search to find your workspace or create a new one
      </p>
    </>
  );

  const renderWorkspaceCreate = () => (
    <>
      <h1 className="login-flow-title">Create a workspace</h1>
      <p className="login-flow-subtitle">
        You can rename this later.
      </p>

      <div className="login-flow-divider" />

      <input
        type="text"
        className="login-flow-input"
        placeholder="Workspace name"
        value={newWorkspaceName}
        onChange={(e) => setNewWorkspaceName(e.target.value)}
        onKeyPress={(e) => {
          if (e.key === 'Enter' && newWorkspaceName.trim()) {
            handleCreateWorkspace();
          }
        }}
        autoFocus
        aria-label="Workspace name"
      />

      {newWorkspaceName && (
        <p className="login-flow-caption login-flow-mt-sm">
          Slug: {newWorkspaceName.toLowerCase().replace(/\s+/g, '-')}.heyjarvis.app
        </p>
      )}

      <div className="login-flow-button-group login-flow-mt-lg">
        <button
          className="login-flow-button login-flow-button-primary"
          onClick={handleCreateWorkspace}
          disabled={!newWorkspaceName.trim()}
        >
          <span className="button-shimmer"></span>
          Create & continue
        </button>
      </div>
    </>
  );


  const renderRoleSelection = () => (
    <>
      <h1 className="login-flow-title">Choose your role</h1>
      <p className="login-flow-subtitle">
        This helps us customize your experience with relevant features and workflows.
      </p>

      <div className="login-flow-divider" />

      <div className="login-flow-workspace-list">
        <div
          className={`login-flow-workspace-item ${selectedRole === 'developer' ? 'selected' : ''}`}
          onClick={() => handleSelectRole('developer')}
          role="radio"
          aria-checked={selectedRole === 'developer'}
          tabIndex={0}
        >
          <div className="login-flow-workspace-info">
            <div className="login-flow-workspace-name">Developer</div>
            <div className="login-flow-workspace-meta">
              Code analysis, architecture diagrams, Jira integration
            </div>
          </div>
          <span className="login-flow-workspace-badge">Engineering</span>
        </div>

        <div
          className={`login-flow-workspace-item ${selectedRole === 'sales' ? 'selected' : ''}`}
          onClick={() => handleSelectRole('sales')}
          role="radio"
          aria-checked={selectedRole === 'sales'}
          tabIndex={0}
        >
          <div className="login-flow-workspace-info">
            <div className="login-flow-workspace-name">Sales</div>
            <div className="login-flow-workspace-meta">
              CRM integration, deal tracking, customer communications
            </div>
          </div>
          <span className="login-flow-workspace-badge">Sales</span>
        </div>

        <div
          className={`login-flow-workspace-item ${selectedRole === 'unit_lead' ? 'selected' : ''}`}
          onClick={() => handleSelectRole('unit_lead')}
          role="radio"
          aria-checked={selectedRole === 'unit_lead'}
          tabIndex={0}
        >
          <div className="login-flow-workspace-info">
            <div className="login-flow-workspace-name">Unit Lead</div>
            <div className="login-flow-workspace-meta">
              Manage team members within your units
            </div>
          </div>
          <span className="login-flow-workspace-badge">Management</span>
        </div>

        <div
          className={`login-flow-workspace-item ${selectedRole === 'team_lead' ? 'selected' : ''}`}
          onClick={() => handleSelectRole('team_lead')}
          role="radio"
          aria-checked={selectedRole === 'team_lead'}
          tabIndex={0}
        >
          <div className="login-flow-workspace-info">
            <div className="login-flow-workspace-name">Team Lead</div>
            <div className="login-flow-workspace-meta">
              Create and manage teams within your department
            </div>
          </div>
          <span className="login-flow-workspace-badge">Management</span>
        </div>

        <div
          className={`login-flow-workspace-item ${selectedRole === 'admin' ? 'selected' : ''}`}
          onClick={() => handleSelectRole('admin')}
          role="radio"
          aria-checked={selectedRole === 'admin'}
          tabIndex={0}
        >
          <div className="login-flow-workspace-info">
            <div className="login-flow-workspace-name">Admin</div>
            <div className="login-flow-workspace-meta">
              Team management, settings, integrations, analytics
            </div>
          </div>
          <span className="login-flow-workspace-badge">Admin</span>
        </div>
      </div>

      <div className="login-flow-button-group-horizontal login-flow-mt-lg">
        <button
          className="login-flow-button login-flow-button-primary"
          onClick={handleContinueWithRole}
          disabled={!selectedRole}
        >
          <span className="button-shimmer"></span>
          Continue
        </button>
      </div>

      <p className="login-flow-caption login-flow-text-center login-flow-mt-md">
        You can change this later in Settings.
      </p>
    </>
  );

  const renderSuccess = () => (
    <>
      {/* Blank screen - animation will overlay */}
    </>
  );

  // ============================================
  // MAIN RENDER
  // ============================================

  return (
    <div className="login-flow-page">
      <div className="login-flow-container">
        {/* Draggable Header Area - allows window dragging */}
        <div className="login-flow-drag-area" />

        {/* Progress Bar */}
        <div className="progress-bar" role="progressbar" aria-valuenow={progress} aria-valuemin="0" aria-valuemax="100">
          <div className="progress-bar-fill" style={{ width: `${progress}%` }} />
        </div>

        {/* Render current step */}
        {flowState === FLOW_STATES.WELCOME && renderWelcome()}
        {flowState === FLOW_STATES.AUTHENTICATING && renderAuthenticating()}
        {flowState === FLOW_STATES.DETECTING_WORKSPACE && renderDetectingWorkspace()}
        {flowState === FLOW_STATES.SELECTING_WORKSPACE && renderWorkspacePicker()}
        {flowState === FLOW_STATES.CREATING_WORKSPACE && renderWorkspaceCreate()}
        {flowState === FLOW_STATES.SELECTING_ROLE && renderRoleSelection()}
        {flowState === FLOW_STATES.SUCCESS && renderSuccess()}
      </div>

      {/* Mission Control Morphing Animation */}
      {showMorphAnimation && (
        <div className="mission-control-morph">
          <div className="morph-orb"></div>
          <div className="morph-text">Mission Control</div>
        </div>
      )}
    </div>
  );
}

// ============================================
// ICON COMPONENTS
// ============================================

const SlackIcon = () => (
  <svg viewBox="0 0 24 24" width="20" height="20">
    <g>
      <path fill="#E01E5A" d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52z"/>
      <path fill="#E01E5A" d="M6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313z"/>
      <path fill="#36C5F0" d="M8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834z"/>
      <path fill="#36C5F0" d="M8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312z"/>
      <path fill="#2EB67D" d="M18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834z"/>
      <path fill="#2EB67D" d="M17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312z"/>
      <path fill="#ECB22E" d="M15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52z"/>
      <path fill="#ECB22E" d="M15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z"/>
    </g>
  </svg>
);

const MicrosoftIcon = () => (
  <svg viewBox="0 0 24 24" width="20" height="20">
    <g>
      <path fill="#F25022" d="M11.4 11.4H0V0h11.4v11.4z"/>
      <path fill="#00A4EF" d="M24 11.4H12.6V0H24v11.4z"/>
      <path fill="#7FBA00" d="M11.4 24H0V12.6h11.4V24z"/>
      <path fill="#FFB900" d="M24 24H12.6V12.6H24V24z"/>
    </g>
  </svg>
);

const ErrorIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="8" x2="12" y2="12" />
    <line x1="12" y1="16" x2="12.01" y2="16" />
  </svg>
);

const CheckIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
  </svg>
);
