import { useState } from 'react';
import './Card.css';

export default function Card({ 
  frontContent, 
  backContent, 
  className = '', 
  onClick,
  isFlipped: controlledIsFlipped,
  onFlip
}) {
  const [internalIsFlipped, setInternalIsFlipped] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  
  // Use controlled state if provided, otherwise use internal state
  const isFlipped = controlledIsFlipped !== undefined ? controlledIsFlipped : internalIsFlipped;
  
  // Determine if card should be flipped based on hover state and lock state
  const shouldBeFlipped = isLocked ? isFlipped : isHovered;
  
  const handleCardClick = () => {
    if (isLocked) {
      // If locked, unlock and return to hover behavior
      setIsLocked(false);
      setInternalIsFlipped(false);
      if (onFlip) {
        onFlip(false);
      }
    } else {
      // If not locked, lock the current state
      setIsLocked(true);
      const newFlippedState = isHovered;
      setInternalIsFlipped(newFlippedState);
      if (onFlip) {
        onFlip(newFlippedState);
      }
    }
    
    if (onClick) {
      onClick();
    }
  };

  const handleMouseEnter = () => {
    if (!isLocked) {
      setIsHovered(true);
    }
  };

  const handleMouseLeave = () => {
    if (!isLocked) {
      setIsHovered(false);
    }
  };

  return (
    <div 
      className={`card ${className} ${shouldBeFlipped ? 'flipped' : ''} ${isLocked ? 'locked' : ''}`} 
      onClick={handleCardClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div className="card-inner">
        <div className="card-front">
          {frontContent}
        </div>
        <div className="card-back">
          <div className="card-back-content">
            {backContent}
          </div>
        </div>
      </div>
    </div>
  );
}
