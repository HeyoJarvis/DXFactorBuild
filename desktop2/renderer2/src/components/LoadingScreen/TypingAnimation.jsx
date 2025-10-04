import { useState, useEffect } from 'react';
import './TypingAnimation.css';

export default function TypingAnimation({ onComplete }) {
  const [displayText, setDisplayText] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showCursor, setShowCursor] = useState(true);
  
  const fullText = 'Welcome ... J.A.R.V.I.S is Loading';
  const typingSpeed = 100; // milliseconds per character
  const pauseAfterComplete = 1500; // pause before calling onComplete

  useEffect(() => {
    // Cursor blinking effect
    const cursorInterval = setInterval(() => {
      setShowCursor(prev => !prev);
    }, 500);

    return () => clearInterval(cursorInterval);
  }, []);

  useEffect(() => {
    if (currentIndex < fullText.length) {
      const timer = setTimeout(() => {
        setDisplayText(fullText.slice(0, currentIndex + 1));
        setCurrentIndex(currentIndex + 1);
      }, typingSpeed);

      return () => clearTimeout(timer);
    } else if (currentIndex === fullText.length) {
      // Typing complete, pause then call onComplete
      const completeTimer = setTimeout(() => {
        onComplete?.();
      }, pauseAfterComplete);

      return () => clearTimeout(completeTimer);
    }
  }, [currentIndex, fullText, onComplete]);

  return (
    <div className="typing-animation">
      <div className="typing-content">
        <div className="typing-text">
          {displayText}
          <span className={`typing-cursor ${showCursor ? 'visible' : ''}`}>|</span>
        </div>
      </div>
    </div>
  );
}
