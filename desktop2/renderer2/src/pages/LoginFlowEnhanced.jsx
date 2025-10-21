import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Zap, Building2, Users, Shield } from 'lucide-react';
import './LoginFlow.css';

/**
 * HeyJarvis Enterprise Login Flow - Enhanced with Premium Animations
 * Multi-step onboarding: Auth → Workspace → Permissions → Success
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

export default function LoginFlowEnhanced({ onLoginSuccess }) {
  // State management
  const [flowState, setFlowState] = useState(FLOW_STATES.WELCOME);
  const [provider, setProvider] = useState(null);
  const [workspaces, setWorkspaces] = useState([]);
  const [selectedWorkspace, setSelectedWorkspace] = useState(null);
  const [newWorkspaceName, setNewWorkspaceName] = useState('');
  const [selectedRole, setSelectedRole] = useState(null);
  const [error, setError] = useState(null);
  const [loadingSlack, setLoadingSlack] = useState(false);
  const [loadingMicrosoft, setLoadingMicrosoft] = useState(false);
  const [authTimeout, setAuthTimeout] = useState(false);

  // Animation state
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [particles, setParticles] = useState([]);

  // Calculate progress
  const progress = PROGRESS_MAP[flowState] || 0;

  // Initialize particles and mouse tracking
  useEffect(() => {
    const handleMouseMove = (e) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener('mousemove', handleMouseMove);

    const newParticles = Array.from({ length: 30 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 3 + 1,
      duration: Math.random() * 10 + 10
    }));
    setParticles(newParticles);

    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  // Reset error when state changes
  useEffect(() => {
    setError(null);
  }, [flowState]);

  // Auth timeout handler
  useEffect(() => {
    if (flowState === FLOW_STATES.AUTHENTICATING) {
      const timer = setTimeout(() => setAuthTimeout(true), 15000);
      return () => clearTimeout(timer);
    } else {
      setAuthTimeout(false);
    }
  }, [flowState]);

  // ============================================
  // AUTH HANDLERS
  // ============================================

  const handleSlackLogin = async () => {
    try {
      setLoadingSlack(true);
      setError(null);
      setProvider('slack');
      setFlowState(FLOW_STATES.AUTHENTICATING);

      const result = await window.electronAPI.auth.signInWithSlack();
      if (result.success) {
        await handleAuthSuccess(result);
      } else {
        throw new Error(result.error || 'Login failed');
      }
    } catch (err) {
      handleAuthError(err.message || 'Failed to sign in with Slack');
    } finally {
      setLoadingSlack(false);
    }
  };

  const handleMicrosoftLogin = async () => {
    try {
      setLoadingMicrosoft(true);
      setError(null);
      setProvider('microsoft');
      setFlowState(FLOW_STATES.AUTHENTICATING);

      const result = await window.electronAPI.auth.signInWithMicrosoft();
      if (result.success) {
        await handleAuthSuccess(result);
      } else {
        throw new Error(result.error || 'Login failed');
      }
    } catch (err) {
      handleAuthError(err.message || 'Failed to sign in with Microsoft');
    } finally {
      setLoadingMicrosoft(false);
    }
  };

  const handleAuthSuccess = async (result) => {
    setFlowState(FLOW_STATES.DETECTING_WORKSPACE);

    setTimeout(async () => {
      try {
        const workspaceResult = await window.electronAPI.teams.getUserTeams();

        if (workspaceResult.success && workspaceResult.teams && workspaceResult.teams.length > 0) {
          setWorkspaces(workspaceResult.teams);
          setFlowState(FLOW_STATES.SELECTING_WORKSPACE);
        } else {
          setFlowState(FLOW_STATES.CREATING_WORKSPACE);
        }
      } catch (err) {
        handleAuthError('Failed to fetch workspaces');
      }
    }, 2000);
  };

  const handleAuthError = (message) => {
    setError(message);
    setFlowState(FLOW_STATES.ERROR);
  };

  const handleWorkspaceSelect = async (workspace) => {
    setSelectedWorkspace(workspace);
    setFlowState(FLOW_STATES.SELECTING_ROLE);
  };

  const handleRoleSelect = async (role) => {
    setSelectedRole(role);

    try {
      const joinResult = await window.electronAPI.teams.join(selectedWorkspace.id, role);

      if (joinResult.success) {
        setFlowState(FLOW_STATES.SUCCESS);
        setTimeout(() => {
          if (onLoginSuccess) {
            onLoginSuccess(joinResult);
          }
        }, 2500);
      } else {
        throw new Error(joinResult.error || 'Failed to join workspace');
      }
    } catch (err) {
      handleAuthError(err.message || 'Failed to join workspace');
    }
  };

  const handleCreateWorkspace = async () => {
    if (!newWorkspaceName.trim()) {
      setError('Please enter a workspace name');
      return;
    }

    try {
      const createResult = await window.electronAPI.teams.create({
        name: newWorkspaceName,
        role: 'admin'
      });

      if (createResult.success) {
        setFlowState(FLOW_STATES.SUCCESS);
        setTimeout(() => {
          if (onLoginSuccess) {
            onLoginSuccess(createResult);
          }
        }, 2500);
      } else {
        throw new Error(createResult.error || 'Failed to create workspace');
      }
    } catch (err) {
      handleAuthError(err.message || 'Failed to create workspace');
    }
  };

  const handleRetry = () => {
    setFlowState(FLOW_STATES.WELCOME);
    setError(null);
    setProvider(null);
  };

  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      {/* Premium Gradient Mesh Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          className="absolute inset-0 opacity-30"
          style={{
            background: 'radial-gradient(circle at 20% 50%, rgba(99, 102, 241, 0.4) 0%, transparent 50%), radial-gradient(circle at 80% 50%, rgba(139, 92, 246, 0.4) 0%, transparent 50%), radial-gradient(circle at 50% 80%, rgba(59, 130, 246, 0.3) 0%, transparent 50%)'
          }}
        />

        {/* Floating Particles */}
        {particles.map((particle) => (
          <motion.div
            key={particle.id}
            className="absolute rounded-full"
            style={{
              left: `${particle.x}%`,
              top: `${particle.y}%`,
              width: particle.size,
              height: particle.size,
              background: `linear-gradient(135deg, rgba(99, 102, 241, ${0.3 + Math.random() * 0.3}), rgba(139, 92, 246, ${0.2 + Math.random() * 0.3}))`
            }}
            animate={{
              y: [0, -30, 0],
              opacity: [0.2, 0.6, 0.2],
            }}
            transition={{
              duration: particle.duration,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          />
        ))}

        {/* Animated Orbs */}
        <motion.div
          className="absolute w-[600px] h-[600px] rounded-full blur-3xl opacity-20"
          style={{
            background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.4), rgba(139, 92, 246, 0.4))',
          }}
          animate={{
            x: [0, 150, 0],
            y: [0, -150, 0],
            scale: [1, 1.3, 1],
          }}
          transition={{
            duration: 25,
            repeat: Infinity,
            ease: "easeInOut"
          }}
          style={{ top: '5%', left: '5%' }}
        />
        <motion.div
          className="absolute w-[500px] h-[500px] rounded-full blur-3xl opacity-20"
          style={{
            background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.4), rgba(99, 102, 241, 0.4))',
          }}
          animate={{
            x: [0, -150, 0],
            y: [0, 150, 0],
            scale: [1.2, 1, 1.2],
          }}
          transition={{
            duration: 28,
            repeat: Infinity,
            ease: "easeInOut"
          }}
          style={{ bottom: '5%', right: '5%' }}
        />

        {/* Mouse Follow Glow */}
        <motion.div
          className="absolute w-96 h-96 rounded-full blur-3xl pointer-events-none opacity-15"
          style={{
            background: 'radial-gradient(circle, rgba(99, 102, 241, 0.3) 0%, transparent 70%)',
            left: mousePosition.x - 192,
            top: mousePosition.y - 192,
          }}
          transition={{ type: "spring", damping: 30, stiffness: 200 }}
        />
      </div>

      {/* Premium Header */}
      <header className="relative z-10 p-6">
        <div className="flex justify-center items-center p-4 rounded-2xl backdrop-blur-xl bg-white/50 border border-white/40 shadow-lg max-w-md mx-auto">
          <div className="flex items-center space-x-3">
            <motion.div
              className="relative w-12 h-12"
              whileHover={{ scale: 1.1 }}
              transition={{ type: "spring", stiffness: 400 }}
            >
              <motion.div
                className="absolute inset-0 rounded-full bg-gradient-to-br from-indigo-500 via-purple-500 to-blue-500 shadow-xl"
                animate={{ rotate: 360 }}
                transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
              />
              <motion.div
                className="absolute inset-1 rounded-full bg-white flex items-center justify-center"
              >
                <Sparkles className="text-indigo-600" size={20} />
              </motion.div>
            </motion.div>
            <div>
              <span className="text-xl font-bold bg-gradient-to-r from-indigo-600 via-purple-600 to-blue-600 bg-clip-text text-transparent">
                HeyJarvis
              </span>
              <div className="text-xs text-gray-600">Enterprise Suite</div>
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        {flowState !== FLOW_STATES.WELCOME && flowState !== FLOW_STATES.SUCCESS && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-md mx-auto mt-4"
          >
            <div className="h-2 bg-white/40 rounded-full overflow-hidden backdrop-blur-xl">
              <motion.div
                className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-blue-500"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.5, ease: "easeOut" }}
              />
            </div>
          </motion.div>
        )}
      </header>

      {/* Main Content */}
      <div className="relative z-10 flex items-center justify-center min-h-[calc(100vh-140px)] px-4">
        <AnimatePresence mode="wait">
          {/* WELCOME SCREEN */}
          {flowState === FLOW_STATES.WELCOME && (
            <motion.div
              key="welcome"
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.95 }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="w-full max-w-md"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-400/15 via-purple-400/15 to-blue-400/15 blur-3xl rounded-3xl" />

              <div className="relative p-8 rounded-3xl backdrop-blur-2xl bg-white/60 border border-white/40 shadow-2xl">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-1 bg-gradient-to-r from-transparent via-indigo-500 to-transparent rounded-full" />

                <div className="text-center mb-8 mt-2">
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                  >
                    <h1 className="text-3xl font-bold mb-2 bg-gradient-to-r from-indigo-700 via-purple-700 to-blue-700 bg-clip-text text-transparent">
                      Welcome to HeyJarvis
                    </h1>
                    <p className="text-sm text-gray-600">
                      Connect your account to link tools and personalize defaults.
                    </p>
                  </motion.div>
                </div>

                <div className="space-y-3">
                  <motion.button
                    onClick={handleMicrosoftLogin}
                    disabled={loadingMicrosoft}
                    whileHover={{ scale: 1.02, y: -2 }}
                    whileTap={{ scale: 0.98 }}
                    transition={{ type: "spring", stiffness: 400 }}
                    className="relative w-full py-4 rounded-xl overflow-hidden group shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 group-hover:from-blue-500 group-hover:via-indigo-500 group-hover:to-purple-500 transition-all" />
                    <motion.div
                      className="absolute inset-0 bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400 opacity-0 group-hover:opacity-100 blur-xl transition-opacity"
                    />
                    <span className="relative z-10 text-white font-semibold flex items-center justify-center gap-2">
                      {loadingMicrosoft ? 'Connecting...' : 'Continue with Microsoft'}
                      <Zap size={18} />
                    </span>
                  </motion.button>

                  <motion.button
                    onClick={handleSlackLogin}
                    disabled={loadingSlack}
                    whileHover={{ scale: 1.02, y: -2 }}
                    whileTap={{ scale: 0.98 }}
                    transition={{ type: "spring", stiffness: 400 }}
                    className="relative w-full py-4 rounded-xl border bg-white/60 border-indigo-200 hover:bg-white/90 hover:border-indigo-300 font-medium transition-all overflow-hidden group shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <motion.div
                      className="absolute inset-0 bg-gradient-to-r from-indigo-500 to-purple-500 opacity-0 group-hover:opacity-10 transition-opacity"
                    />
                    <span className="text-gray-700">
                      {loadingSlack ? 'Connecting...' : 'Continue with Slack'}
                    </span>
                  </motion.button>
                </div>

                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm"
                  >
                    {error}
                  </motion.div>
                )}

                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3 }}
                  className="mt-6 text-xs text-center text-gray-500"
                >
                  By continuing, you agree to our{' '}
                  <span className="text-indigo-600 hover:text-indigo-700 cursor-pointer">Terms</span>
                  {' '}and{' '}
                  <span className="text-indigo-600 hover:text-indigo-700 cursor-pointer">Privacy Policy</span>
                </motion.p>
              </div>
            </motion.div>
          )}

          {/* AUTHENTICATING / LOADING STATE */}
          {(flowState === FLOW_STATES.AUTHENTICATING || flowState === FLOW_STATES.DETECTING_WORKSPACE) && (
            <motion.div
              key="loading"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.2 }}
              className="text-center"
            >
              <div className="relative w-80 h-80 flex items-center justify-center">
                {/* Outer Rotating Ring */}
                <motion.div
                  className="absolute w-64 h-64 rounded-full"
                  style={{
                    background: 'conic-gradient(from 0deg, rgba(99, 102, 241, 0.7), rgba(139, 92, 246, 0.7), rgba(59, 130, 246, 0.7), rgba(99, 102, 241, 0.7))',
                    padding: '3px',
                  }}
                  animate={{ rotate: 360 }}
                  transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                >
                  <div className="w-full h-full rounded-full bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 backdrop-blur-xl" />
                </motion.div>

                {/* Middle Ring */}
                <motion.div
                  className="absolute w-48 h-48 rounded-full border-4 border-transparent"
                  style={{
                    background: 'linear-gradient(white, white) padding-box, conic-gradient(from 180deg, rgba(99, 102, 241, 0.5), rgba(139, 92, 246, 0.5), rgba(59, 130, 246, 0.5), rgba(99, 102, 241, 0.5)) border-box',
                  }}
                  animate={{ rotate: -360 }}
                  transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                />

                {/* Center Orb */}
                <motion.div
                  className="absolute w-32 h-32 rounded-full bg-gradient-to-br from-indigo-400 via-purple-400 to-blue-400 shadow-2xl"
                  animate={{
                    scale: [1, 1.1, 1],
                    boxShadow: [
                      "0 0 60px rgba(99, 102, 241, 0.5)",
                      "0 0 100px rgba(139, 92, 246, 0.7)",
                      "0 0 60px rgba(59, 130, 246, 0.5)"
                    ]
                  }}
                  transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                />

                {/* Orbiting Particles */}
                {[...Array(8)].map((_, i) => (
                  <motion.div
                    key={i}
                    className="absolute w-3 h-3 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500"
                    style={{
                      boxShadow: '0 0 20px rgba(99, 102, 241, 0.6)'
                    }}
                    animate={{
                      x: [0, Math.cos(i * Math.PI / 4) * 100],
                      y: [0, Math.sin(i * Math.PI / 4) * 100],
                      scale: [0, 1, 0],
                      opacity: [0, 1, 0]
                    }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      delay: i * 0.2,
                      ease: "easeOut"
                    }}
                  />
                ))}

                {/* Radiating Rings */}
                {[...Array(3)].map((_, i) => (
                  <motion.div
                    key={`ring-${i}`}
                    className="absolute rounded-full border-2 border-indigo-400/30"
                    initial={{ width: 120, height: 120, opacity: 0.5 }}
                    animate={{
                      width: [120, 280],
                      height: [120, 280],
                      opacity: [0.5, 0]
                    }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      delay: i * 0.6,
                      ease: "easeOut"
                    }}
                  />
                ))}
              </div>

              <motion.h2
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="text-2xl font-bold mt-12 bg-gradient-to-r from-indigo-600 via-purple-600 to-blue-600 bg-clip-text text-transparent"
              >
                {flowState === FLOW_STATES.AUTHENTICATING ? 'Authenticating...' : 'Loading your workspace...'}
              </motion.h2>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
                className="mt-3 text-gray-600"
              >
                {flowState === FLOW_STATES.AUTHENTICATING ? 'Establishing secure connection' : 'Preparing your environment'}
              </motion.p>

              {authTimeout && flowState === FLOW_STATES.AUTHENTICATING && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-6"
                >
                  <p className="text-sm text-gray-600 mb-3">Taking longer than expected...</p>
                  <button
                    onClick={handleRetry}
                    className="px-6 py-2 rounded-lg bg-white/60 border border-indigo-200 hover:bg-white/90 text-sm font-medium transition-all"
                  >
                    Try Again
                  </button>
                </motion.div>
              )}

              {/* Progress Dots */}
              <div className="flex justify-center gap-2 mt-8">
                {[...Array(4)].map((_, i) => (
                  <motion.div
                    key={i}
                    className="w-2 h-2 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500"
                    animate={{
                      scale: [1, 1.5, 1],
                      opacity: [0.3, 1, 0.3]
                    }}
                    transition={{
                      duration: 1.5,
                      repeat: Infinity,
                      delay: i * 0.2,
                      ease: "easeInOut"
                    }}
                  />
                ))}
              </div>
            </motion.div>
          )}

          {/* WORKSPACE SELECTOR */}
          {flowState === FLOW_STATES.SELECTING_WORKSPACE && (
            <motion.div
              key="workspace"
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.95 }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="w-full max-w-md"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-400/15 via-purple-400/15 to-blue-400/15 blur-3xl rounded-3xl" />

              <div className="relative p-8 rounded-3xl backdrop-blur-2xl bg-white/60 border border-white/40 shadow-2xl">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-1 bg-gradient-to-r from-transparent via-indigo-500 to-transparent rounded-full" />

                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mb-6 mt-2"
                >
                  <h2 className="text-2xl font-bold mb-2 bg-gradient-to-r from-indigo-700 via-purple-700 to-blue-700 bg-clip-text text-transparent">
                    Select a workspace
                  </h2>
                  <p className="text-sm text-gray-600">
                    Choose which workspace you'd like to join
                  </p>
                </motion.div>

                <div className="space-y-3 max-h-96 overflow-y-auto pr-2 custom-scrollbar">
                  {workspaces.map((workspace, idx) => (
                    <motion.button
                      key={workspace.id}
                      onClick={() => handleWorkspaceSelect(workspace)}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      whileHover={{ scale: 1.02, x: 4 }}
                      whileTap={{ scale: 0.98 }}
                      className="relative w-full p-5 rounded-xl border bg-white/60 border-indigo-200 hover:bg-white/90 hover:border-indigo-400 text-left transition-all overflow-hidden group shadow-sm"
                    >
                      <motion.div
                        className="absolute inset-0 bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-blue-500/10 opacity-0 group-hover:opacity-100 transition-opacity"
                      />
                      <div className="relative flex justify-between items-center">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-500 flex items-center justify-center font-bold text-white shadow-lg">
                            <Building2 size={20} />
                          </div>
                          <div>
                            <h3 className="font-semibold text-lg text-gray-900">
                              {workspace.name}
                            </h3>
                            <p className="text-sm text-gray-500 flex items-center gap-2">
                              <Users size={14} />
                              {workspace.member_count || 0} members
                            </p>
                          </div>
                        </div>
                        <motion.div
                          whileHover={{ x: 4 }}
                          className="text-indigo-600 text-sm font-semibold"
                        >
                          Join →
                        </motion.div>
                      </div>
                    </motion.button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {/* ROLE SELECTOR */}
          {flowState === FLOW_STATES.SELECTING_ROLE && (
            <motion.div
              key="role"
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.95 }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="w-full max-w-md"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-400/15 via-purple-400/15 to-blue-400/15 blur-3xl rounded-3xl" />

              <div className="relative p-8 rounded-3xl backdrop-blur-2xl bg-white/60 border border-white/40 shadow-2xl">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-1 bg-gradient-to-r from-transparent via-indigo-500 to-transparent rounded-full" />

                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mb-6 mt-2"
                >
                  <h2 className="text-2xl font-bold mb-2 bg-gradient-to-r from-indigo-700 via-purple-700 to-blue-700 bg-clip-text text-transparent">
                    Choose your role
                  </h2>
                  <p className="text-sm text-gray-600">
                    Select how you'll be using HeyJarvis
                  </p>
                </motion.div>

                <div className="space-y-3">
                  {['developer', 'sales', 'manager'].map((role, idx) => (
                    <motion.button
                      key={role}
                      onClick={() => handleRoleSelect(role)}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.1 }}
                      whileHover={{ scale: 1.02, x: 4 }}
                      whileTap={{ scale: 0.98 }}
                      className="relative w-full p-5 rounded-xl border bg-white/60 border-indigo-200 hover:bg-white/90 hover:border-indigo-400 text-left transition-all overflow-hidden group shadow-sm"
                    >
                      <motion.div
                        className="absolute inset-0 bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-blue-500/10 opacity-0 group-hover:opacity-100 transition-opacity"
                      />
                      <div className="relative flex justify-between items-center">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-500 flex items-center justify-center text-white shadow-lg">
                            <Shield size={20} />
                          </div>
                          <div>
                            <h3 className="font-semibold text-lg text-gray-900 capitalize">
                              {role}
                            </h3>
                          </div>
                        </div>
                        <motion.div
                          whileHover={{ x: 4 }}
                          className="text-indigo-600 text-sm font-semibold"
                        >
                          Select →
                        </motion.div>
                      </div>
                    </motion.button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {/* SUCCESS ANIMATION */}
          {flowState === FLOW_STATES.SUCCESS && (
            <motion.div
              key="success"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="fixed inset-0 flex items-center justify-center z-50"
            >
              <motion.div
                className="absolute w-32 h-32 rounded-full bg-gradient-to-br from-indigo-500 via-purple-500 to-blue-500"
                initial={{ scale: 1, opacity: 1 }}
                animate={{
                  scale: [1, 2, 100],
                  opacity: [1, 0.8, 0]
                }}
                transition={{
                  duration: 2,
                  ease: "easeInOut"
                }}
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: [0, 1, 0], scale: [0.8, 1, 0.8] }}
                transition={{ duration: 2 }}
                className="relative z-10 text-center"
              >
                <h2 className="text-3xl font-bold bg-gradient-to-r from-indigo-700 via-purple-700 to-blue-700 bg-clip-text text-transparent">
                  Welcome to HeyJarvis
                </h2>
                <p className="mt-2 text-gray-600">Loading your workspace...</p>
              </motion.div>
            </motion.div>
          )}

          {/* ERROR STATE */}
          {flowState === FLOW_STATES.ERROR && (
            <motion.div
              key="error"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="w-full max-w-md"
            >
              <div className="relative p-8 rounded-3xl backdrop-blur-2xl bg-white/60 border border-white/40 shadow-2xl">
                <div className="text-center">
                  <h2 className="text-2xl font-bold mb-4 text-red-600">
                    Something went wrong
                  </h2>
                  <p className="text-gray-600 mb-6">{error}</p>
                  <motion.button
                    onClick={handleRetry}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="px-8 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold shadow-lg"
                  >
                    Try Again
                  </motion.button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(99, 102, 241, 0.1);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: linear-gradient(to bottom, rgba(99, 102, 241, 0.4), rgba(139, 92, 246, 0.4));
          border-radius: 10px;
        }
      `}</style>
    </div>
  );
}
