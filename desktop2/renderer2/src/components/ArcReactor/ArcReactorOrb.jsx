import { useState, useRef, useEffect } from 'react';
import './ArcReactorOrb.css';

/**
 * Arc Reactor Orb - The glowing, draggable orb that serves as the main interaction point
 * Features:
 * - Draggable by mouse (hold and drag)
 * - Quick click to open menu
 * - Pulsing glow animation
 * - Role-based indicator (developer/sales)
 */
function ArcReactorOrb({ onMenuToggle, isMenuOpen, currentRole = 'developer', onPositionChange, isCollapsed = true }) {
  const [isDragging, setIsDragging] = useState(false);
  const [clickStart, setClickStart] = useState(0);
  const [hasMoved, setHasMoved] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const orbRef = useRef(null); // Reference to the orb element
  
  // Orb is always positioned consistently
  // Centered in the window with enough space for the glow
  const position = { x: 100, y: 100 }; // Centered in window

  // Role-based colors
  const roleColors = {
    developer: { primary: '#00d9ff', glow: 'rgba(0, 217, 255, 0.6)' },
    sales: { primary: '#00ff88', glow: 'rgba(0, 255, 136, 0.6)' }
  };

  const colors = roleColors[currentRole] || roleColors.developer;

  const handleMouseEnter = () => {
    // Only manage mouse forwarding in collapsed mode
    // In expanded mode, pointer-events CSS handles everything
    if (isCollapsed && window.electronAPI?.window?.setMouseForward) {
      window.electronAPI.window.setMouseForward(false);
    }
  };

  const handleMouseLeave = () => {
    // Only re-enable mouse forwarding in collapsed mode
    // In expanded mode, we never want mouse forwarding
    if (isCollapsed && !isDragging && window.electronAPI?.window?.setMouseForward) {
      window.electronAPI.window.setMouseForward(true);
    }
  };

  const handleMouseDown = (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    setClickStart(Date.now());
    setHasMoved(false);
    setIsDragging(true);
    
    const rect = e.currentTarget.getBoundingClientRect();
    dragOffset.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    
    setHasMoved(true);
    
    // Move the entire window, not just the orb within the window
    // Use screenX/screenY for absolute screen coordinates
    if (window.electronAPI?.window?.moveWindow) {
      const windowX = e.screenX - dragOffset.current.x;
      const windowY = e.screenY - dragOffset.current.y;
      
      window.electronAPI.window.moveWindow(windowX, windowY);
    }
  };

  const handleMouseUp = (e) => {
    if (!isDragging) return;
    
    const clickDuration = Date.now() - clickStart;
    setIsDragging(false);
    
    console.log('🖱️ Mouse up:', { clickDuration, hasMoved, isDragging });
    
    // Re-enable mouse event forwarding after drag (only in collapsed mode)
    if (isCollapsed && window.electronAPI?.window?.setMouseForward && orbRef.current) {
      // Check if mouse is still over the orb using the ref
      const rect = orbRef.current.getBoundingClientRect();
      const isStillOver = e.clientX >= rect.left && e.clientX <= rect.right &&
                          e.clientY >= rect.top && e.clientY <= rect.bottom;
      if (!isStillOver) {
        window.electronAPI.window.setMouseForward(true);
      }
    }
    
    // Quick click (< 300ms) and no movement = toggle menu
    if (clickDuration < 300 && !hasMoved) {
      console.log('🎯 Quick click detected - toggling menu');
      onMenuToggle();
    } else {
      console.log('⏱️ Not a quick click:', { clickDuration, threshold: 300, hasMoved });
    }
  };

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging]);

  return (
    <div
      ref={orbRef}
      className={`arc-reactor-orb ${isDragging ? 'dragging' : ''} ${isMenuOpen ? 'menu-open' : ''}`}
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        '--orb-color': colors.primary,
        '--orb-glow': colors.glow
      }}
      onMouseDown={handleMouseDown}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      data-role={currentRole}
    >
      {/* Outer glow ring */}
      <div className="orb-glow-ring"></div>
      
      {/* Main orb */}
      <div className="orb-main">
        {/* Inner rings */}
        <div className="orb-ring orb-ring-1"></div>
        <div className="orb-ring orb-ring-2"></div>
        <div className="orb-ring orb-ring-3"></div>
        
        {/* Core */}
        <div className="orb-core">
          <div className="orb-core-inner"></div>
        </div>
        
        {/* Energy particles */}
        <div className="orb-particle orb-particle-1"></div>
        <div className="orb-particle orb-particle-2"></div>
        <div className="orb-particle orb-particle-3"></div>
        <div className="orb-particle orb-particle-4"></div>
      </div>
      
      {/* Role indicator badge */}
      <div className="orb-role-indicator">
        {currentRole === 'developer' ? '👨‍💻' : '💼'}
      </div>
    </div>
  );
}

export default ArcReactorOrb;

