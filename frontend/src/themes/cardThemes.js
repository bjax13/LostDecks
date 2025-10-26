// Card theme definitions for different stories
const themes = {
  default: {
    primary: '#8A2BE2', // Purple (current default)
    primaryRgb: '138, 43, 226',
    secondary: '#1a1a1a',
    tertiary: '#0f0f0f',
    accent: '#ffd700', // Gold
    text: '#e0e0e0',
    textSecondary: '#b0b0b0',
    border: 'rgba(138, 43, 226, 0.5)',
    borderHover: 'rgba(138, 43, 226, 0.3)',
    borderLocked: 'rgba(255, 215, 0, 0.6)',
    glow: 'rgba(138, 43, 226, 0.1)',
    glowLocked: 'rgba(255, 215, 0, 0.2)',
    frontGradient: 'linear-gradient(145deg, #1a1a1a 0%, #0f0f0f 100%)',
    backGradient: 'linear-gradient(145deg, #2a1a3a 0%, #1a0f2e 100%)',
    patternOverlay: 'rgba(138, 43, 226, 0.1)',
    patternOverlaySecondary: 'rgba(138, 43, 226, 0.05)',
    radialOverlay1: 'rgba(138, 43, 226, 0.3)',
    radialOverlay2: 'rgba(138, 43, 226, 0.2)',
    radialOverlay3: 'rgba(138, 43, 226, 0.15)'
  },
  elsecaller: {
    primary: '#8C5AC8', // Amethyst
    primaryRgb: '140, 90, 200',
    secondary: '#2B2F6C', // Indigo
    tertiary: '#0F1116', // Ink
    accent: '#31C0D5', // Cyan
    text: '#EAFBFF', // Glow
    textSecondary: '#C7CED6', // Silver
    border: 'rgba(140, 90, 200, 0.5)',
    borderHover: 'rgba(140, 90, 200, 0.3)',
    borderLocked: 'rgba(49, 192, 213, 0.6)',
    glow: 'rgba(140, 90, 200, 0.1)',
    glowLocked: 'rgba(49, 192, 213, 0.2)',
    frontGradient: 'linear-gradient(145deg, #2B2F6C 0%, #0F1116 100%)',
    backGradient: 'linear-gradient(145deg, #8C5AC8 0%, #2B2F6C 100%)',
    patternOverlay: 'rgba(140, 90, 200, 0.1)',
    patternOverlaySecondary: 'rgba(140, 90, 200, 0.05)',
    radialOverlay1: 'rgba(140, 90, 200, 0.3)',
    radialOverlay2: 'rgba(49, 192, 213, 0.2)',
    radialOverlay3: 'rgba(140, 90, 200, 0.15)'
  },
  lopen: {
    primary: '#E5B84B', // Gold
    primaryRgb: '229, 184, 75',
    secondary: '#0B5AC2', // Royal
    tertiary: '#1C2430', // Slate
    accent: '#FF6B57', // Coral
    text: '#F9F3E3', // Parchment
    textSecondary: '#7AD1FF', // Sky
    border: 'rgba(229, 184, 75, 0.5)',
    borderHover: 'rgba(229, 184, 75, 0.3)',
    borderLocked: 'rgba(255, 107, 87, 0.6)',
    glow: 'rgba(229, 184, 75, 0.1)',
    glowLocked: 'rgba(255, 107, 87, 0.2)',
    frontGradient: 'linear-gradient(145deg, #0B5AC2 0%, #1C2430 100%)',
    backGradient: 'linear-gradient(145deg, #E5B84B 0%, #0B5AC2 100%)',
    patternOverlay: 'rgba(229, 184, 75, 0.1)',
    patternOverlaySecondary: 'rgba(229, 184, 75, 0.05)',
    radialOverlay1: 'rgba(229, 184, 75, 0.3)',
    radialOverlay2: 'rgba(255, 107, 87, 0.2)',
    radialOverlay3: 'rgba(229, 184, 75, 0.15)'
  },
  chasm: {
    primary: '#FFCE4B', // Honey
    primaryRgb: '255, 206, 75',
    secondary: '#3AA766', // Moss
    tertiary: '#0D1216', // Ink
    accent: '#13A5A5', // Turquoise
    text: '#F582B6', // Spren
    textSecondary: '#616C7A', // Stone
    border: 'rgba(255, 206, 75, 0.5)',
    borderHover: 'rgba(255, 206, 75, 0.3)',
    borderLocked: 'rgba(19, 165, 165, 0.6)',
    glow: 'rgba(255, 206, 75, 0.1)',
    glowLocked: 'rgba(19, 165, 165, 0.2)',
    frontGradient: 'linear-gradient(145deg, #3AA766 0%, #0D1216 100%)',
    backGradient: 'linear-gradient(145deg, #FFCE4B 0%, #3AA766 100%)',
    patternOverlay: 'rgba(255, 206, 75, 0.1)',
    patternOverlaySecondary: 'rgba(255, 206, 75, 0.05)',
    radialOverlay1: 'rgba(255, 206, 75, 0.3)',
    radialOverlay2: 'rgba(19, 165, 165, 0.2)',
    radialOverlay3: 'rgba(255, 206, 75, 0.15)'
  }
};

/**
 * Get theme configuration for a given story code or theme name
 * @param {string} storyCodeOrTheme - The story code (ELS, LOP, CHM) or theme name (elsecaller, lopen, chasm, default)
 * @returns {object} Theme configuration object
 */
export function getTheme(storyCodeOrTheme) {
  // If it's already a theme name, use it directly
  if (themes[storyCodeOrTheme]) {
    return themes[storyCodeOrTheme];
  }
  
  // Otherwise, map story codes to theme names
  const themeMap = {
    'ELS': 'elsecaller',
    'LOP': 'lopen', 
    'CHM': 'chasm'
  };
  
  const themeName = themeMap[storyCodeOrTheme] || 'default';
  return themes[themeName];
}

/**
 * Get all available theme names
 * @returns {string[]} Array of theme names
 */
export function getAvailableThemes() {
  return Object.keys(themes);
}

export default themes;
