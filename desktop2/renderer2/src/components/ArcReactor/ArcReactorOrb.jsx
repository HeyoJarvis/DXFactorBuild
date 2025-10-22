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
  const [dragTransform, setDragTransform] = useState({ x: 0, y: 0 }); // Visual offset during drag
  const dragOffset = useRef({ x: 0, y: 0 }); // Offset from mouse to window top-left
  const orbRef = useRef(null); // Reference to the orb element
  const dragStartPos = useRef({ x: 0, y: 0 }); // Screen position when drag started
  
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
      console.log('🖱️ [ORB] Mouse entered orb - disabled forwarding');
    }
  };

  const handleMouseLeave = () => {
    // NEVER re-enable mouse forwarding in collapsed mode!
    // The orb should ALWAYS remain clickable
    // User can click desktop by minimizing the app (not by mouse forwarding)
    console.log('🖱️ [ORB] Mouse left orb - keeping forwarding DISABLED (orb always clickable)');
  };

  const handleMouseDown = (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    setClickStart(Date.now());
    setHasMoved(false);
    setIsDragging(true);
    setDragTransform({ x: 0, y: 0 }); // Reset transform
    
    const rect = e.currentTarget.getBoundingClientRect();
    dragOffset.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
    
    // Store starting screen position for smooth CSS transform
    dragStartPos.current = {
      x: e.screenX,
      y: e.screenY
    };
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    
    setHasMoved(true);
    
    // Calculate offset from drag start for instant visual feedback
    const deltaX = e.screenX - dragStartPos.current.x;
    const deltaY = e.screenY - dragStartPos.current.y;
    
    // ONLY update CSS transform for perfectly smooth visual feedback
    // NO IPC calls during drag = butter smooth movement
    setDragTransform({ x: deltaX, y: deltaY });
  };

  const handleMouseUp = (e) => {
    if (!isDragging) return;
    
    const clickDuration = Date.now() - clickStart;
    
    // Move window to final position ONCE at the end of drag
    // This is the only IPC call, making drag perfectly smooth
    if (hasMoved && window.electronAPI?.window?.moveWindow) {
      const finalX = e.screenX - dragOffset.current.x;
      const finalY = e.screenY - dragOffset.current.y;
      window.electronAPI.window.moveWindow(finalX, finalY);
      console.log('🪟 Window moved to final position:', { x: finalX, y: finalY });
    }
    
    // Reset drag state
    setIsDragging(false);
    setDragTransform({ x: 0, y: 0 });
    
    console.log('🖱️ Mouse up:', { clickDuration, hasMoved });
    
    // Quick click (< 300ms) and no movement = toggle menu
    if (clickDuration < 300 && !hasMoved) {
      console.log('🎯 Quick click detected - toggling menu');
      onMenuToggle();
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

  // Ensure forwarding is always disabled when in collapsed mode
  useEffect(() => {
    if (isCollapsed && window.electronAPI?.window?.setMouseForward) {
      window.electronAPI.window.setMouseForward(false);
      console.log('🖱️ [ORB] Window collapsed - forcing forwarding DISABLED');
    }
  }, [isCollapsed]);

  return (
    <div
      ref={orbRef}
      className={`arc-reactor-orb ${isDragging ? 'dragging' : ''} ${isMenuOpen ? 'menu-open' : ''}`}
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        transform: `translate(${dragTransform.x}px, ${dragTransform.y}px)`,
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

