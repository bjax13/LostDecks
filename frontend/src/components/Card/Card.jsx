import { useState } from 'react';
import './Card.css';
import { getTheme } from '../../themes/cardThemes';

export default function Card({ 
  frontContent, 
  backContent, 
  className = '', 
  onClick,
  isFlipped: controlledIsFlipped,
  onFlip,
  theme = 'default'
}) {
  const [internalIsFlipped, setInternalIsFlipped] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  
  // Get theme configuration
  const themeConfig = getTheme(theme);
  
  // Create CSS variables object for inline styles
  const cssVariables = {
    '--card-primary': themeConfig.primary,
    '--card-primary-rgb': themeConfig.primaryRgb,
    '--card-secondary': themeConfig.secondary,
    '--card-tertiary': themeConfig.tertiary,
    '--card-accent': themeConfig.accent,
    '--card-text': themeConfig.text,
    '--card-text-secondary': themeConfig.textSecondary,
    '--card-border': themeConfig.border,
    '--card-border-hover': themeConfig.borderHover,
    '--card-border-locked': themeConfig.borderLocked,
    '--card-glow': themeConfig.glow,
    '--card-glow-locked': themeConfig.glowLocked,
    '--card-front-gradient': themeConfig.frontGradient,
    '--card-back-gradient': themeConfig.backGradient,
    '--card-pattern-overlay': themeConfig.patternOverlay,
    '--card-pattern-overlay-secondary': themeConfig.patternOverlaySecondary,
    '--card-radial-overlay-1': themeConfig.radialOverlay1,
    '--card-radial-overlay-2': themeConfig.radialOverlay2,
    '--card-radial-overlay-3': themeConfig.radialOverlay3
  };
  
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
      style={cssVariables}
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
