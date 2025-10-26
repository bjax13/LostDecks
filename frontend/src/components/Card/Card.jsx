import { useState, useMemo } from 'react';
import './Card.css';
import { getTheme } from '../../themes/cardThemes';

export default function Card({ 
  frontContent, 
  backContent, 
  className = '', 
  onClick,
  isFlipped: controlledIsFlipped,
  onFlip,
  theme = 'default',
  isNonsense = false,
  nonsensePosition
}) {
  const [internalIsFlipped, setInternalIsFlipped] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  
  // Get theme configuration
  const themeConfig = getTheme(theme);
  
  // Generate random stamp position if not provided and card is nonsense
  const stampPosition = useMemo(() => {
    if (!isNonsense) return null;
    
    if (nonsensePosition) {
      return nonsensePosition;
    }
    
    // Generate random position 1-8 (excluding center position 5)
    const positions = [1, 2, 3, 4, 6, 7, 8, 9];
    return positions[Math.floor(Math.random() * positions.length)];
  }, [isNonsense, nonsensePosition]);
  
  // Map position to CSS positioning
  const getStampStyle = (position) => {
    const positionMap = {
      1: { top: '15%', left: '15%' },
      2: { top: '15%', left: '50%', transform: 'translateX(-50%)' },
      3: { top: '15%', right: '15%' },
      4: { top: '50%', left: '15%', transform: 'translateY(-50%)' },
      6: { top: '50%', right: '15%', transform: 'translateY(-50%)' },
      7: { bottom: '15%', left: '15%' },
      8: { bottom: '15%', left: '50%', transform: 'translateX(-50%)' },
      9: { bottom: '15%', right: '15%' }
    };
    
    const baseStyle = positionMap[position] || {};
    const rotation = Math.random() * 20 - 10; // Random rotation between -10 and 10 degrees
    
    return {
      ...baseStyle,
      transform: `${baseStyle.transform || ''} rotate(${rotation}deg)`.trim()
    };
  };
  
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
          {isNonsense && stampPosition && (
            <div 
              className="card-stamp"
              style={getStampStyle(stampPosition)}
            >
              NONSENSE
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
