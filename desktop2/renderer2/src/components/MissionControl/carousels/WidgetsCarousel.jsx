import './WidgetsCarousel.css';

/**
 * WidgetsCarousel - Displays custom widgets
 */
export default function WidgetsCarousel({ widgets, user }) {
  return (
    <div className="widgets-carousel-container">
      <div className="carousel-empty">
        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="3" y="3" width="7" height="7"></rect>
          <rect x="14" y="3" width="7" height="7"></rect>
          <rect x="14" y="14" width="7" height="7"></rect>
          <rect x="3" y="14" width="7" height="7"></rect>
        </svg>
        <p>Widgets Coming Soon</p>
        <span className="empty-hint">Custom widgets will appear here</span>
      </div>
    </div>
  );
}

