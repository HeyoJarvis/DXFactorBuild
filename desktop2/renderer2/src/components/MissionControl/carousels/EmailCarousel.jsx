import { useState } from 'react';
import './EmailCarousel.css';

/**
 * EmailCarousel - Overlapping card carousel for emails
 */
export default function EmailCarousel({ emails, onEmailSelect, user }) {
  const [currentIndex, setCurrentIndex] = useState(0);

  const emailList = emails || [];

  const handlePrev = () => {
    setCurrentIndex(prev => Math.max(0, prev - 1));
  };

  const handleNext = () => {
    setCurrentIndex(prev => Math.min(emailList.length - 1, prev + 1));
  };

  const handleCardClick = (email, index) => {
    setCurrentIndex(currentIndex + index);
    if (onEmailSelect) {
      onEmailSelect(email);
    }
  };

  if (!emailList || emailList.length === 0) {
    return (
      <div className="email-carousel-empty">
        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
          <polyline points="22,6 12,13 2,6"></polyline>
        </svg>
        <p>No new emails</p>
        <span className="empty-hint">Your inbox is empty</span>
      </div>
    );
  }

  const visibleEmails = emailList.slice(currentIndex, currentIndex + 5);

  return (
    <div className="email-carousel">
      <button 
        onClick={handlePrev} 
        disabled={currentIndex === 0} 
        className="carousel-nav-btn left"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="15 18 9 12 15 6"></polyline>
        </svg>
      </button>

      <div className="carousel-cards-container">
        {visibleEmails.map((email, index) => (
          <div
            key={email.id || index}
            className="carousel-card-wrapper"
            style={{
              zIndex: 5 - index,
              transform: `translateX(${index * 60}px) scale(${1 - index * 0.05})`,
              opacity: 1 - index * 0.15
            }}
            onClick={() => handleCardClick(email, index)}
          >
            <div className="email-card">
              <div className="email-card-header">
                <span className="email-from">{email.from || 'Unknown Sender'}</span>
                {email.unread && <span className="unread-badge">New</span>}
              </div>
              <h3 className="email-card-subject">{email.subject || 'No Subject'}</h3>
              <p className="email-card-preview">{email.snippet || email.preview || ''}</p>
              <div className="email-card-time">
                {new Date(email.receivedDateTime || email.date).toLocaleDateString()}
              </div>
            </div>
          </div>
        ))}
      </div>

      <button 
        onClick={handleNext} 
        disabled={currentIndex >= emailList.length - 1} 
        className="carousel-nav-btn right"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="9 18 15 12 9 6"></polyline>
        </svg>
      </button>

      {emailList.length > 1 && (
        <div className="carousel-progress">
          {currentIndex + 1} / {emailList.length}
        </div>
      )}
    </div>
  );
}
