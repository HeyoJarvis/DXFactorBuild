import './ReportsCarousel.css';

/**
 * ReportsCarousel - Displays reports and metrics
 */
export default function ReportsCarousel({ reports, user }) {
  return (
    <div className="reports-carousel-container">
      <div className="carousel-empty">
        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <line x1="18" y1="20" x2="18" y2="10"></line>
          <line x1="12" y1="20" x2="12" y2="4"></line>
          <line x1="6" y1="20" x2="6" y2="14"></line>
        </svg>
        <p>Reports Coming Soon</p>
        <span className="empty-hint">Analytics and metrics will appear here</span>
      </div>
    </div>
  );
}

