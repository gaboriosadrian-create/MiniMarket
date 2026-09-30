import React from 'react';

export interface UwiLogoProps {
  variant?: 'animated' | 'static' | 'isotype';
  theme?: 'gradient' | 'white' | 'dark' | 'emerald';
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'custom';
  showText?: boolean;
  className?: string;
  id?: string;
}

export const UwiLogo: React.FC<UwiLogoProps> = ({
  variant = 'animated',
  theme = 'gradient',
  size = 'md',
  showText = true,
  className = '',
  id,
}) => {
  // Size mapping
  const sizeStyles = {
    xs: { icon: 'w-5 h-5', text: 'text-xs', height: 20 },
    sm: { icon: 'w-7 h-7', text: 'text-sm', height: 28 },
    md: { icon: 'w-9 h-9', text: 'text-base', height: 36 },
    lg: { icon: 'w-12 h-12', text: 'text-xl', height: 48 },
    xl: { icon: 'w-16 h-16', text: 'text-2xl', height: 64 },
    '2xl': { icon: 'w-24 h-24', text: 'text-4xl', height: 96 },
    custom: { icon: '', text: '', height: 36 },
  }[size];

  // Gradients and colors based on theme
  const getColors = () => {
    switch (theme) {
      case 'white':
        return {
          stroke1: '#ffffff',
          stroke2: '#f3f4f6',
          dot: '#38bdf8',
          text: 'text-white',
          badgeBg: 'bg-white/15',
          border: 'border-white/20',
        };
      case 'dark':
        return {
          stroke1: '#0f172a',
          stroke2: '#334155',
          dot: '#0284c7',
          text: 'text-stone-900',
          badgeBg: 'bg-stone-100',
          border: 'border-stone-200',
        };
      case 'emerald':
        return {
          stroke1: '#059669',
          stroke2: '#10b981',
          dot: '#34d399',
          text: 'text-emerald-950',
          badgeBg: 'bg-emerald-500/15',
          border: 'border-emerald-500/30',
        };
      case 'gradient':
      default:
        return {
          stroke1: '#0284c7',
          stroke2: '#6366f1',
          dot: '#006AFF',
          text: 'text-stone-900',
          badgeBg: 'bg-sky-500/10',
          border: 'border-sky-500/20',
        };
    }
  };

  const colors = getColors();
  const isAnimated = variant === 'animated';
  const isIsotypeOnly = variant === 'isotype' || !showText;

  // Unique gradient IDs to prevent DOM collision
  const uid = React.useId().replace(/:/g, '');
  const gradId1 = `uwi-grad1-${uid}`;
  const gradId2 = `uwi-grad2-${uid}`;
  const dotGradId = `uwi-dot-grad-${uid}`;

  // Pure Isotype Icon (Icon mark only - stylized connected 'u' with modern floating dot)
  if (isIsotypeOnly) {
    return (
      <div
        id={id}
        role="img"
        aria-label="uwi logo"
        className={`inline-flex items-center justify-center select-none ${sizeStyles.icon} ${className}`}
      >
        <svg
          viewBox="0 0 100 100"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full overflow-visible"
        >
          <defs>
            <linearGradient id={gradId1} x1="0%" y1="0%" x2="100%" y2="100%">
              {theme === 'white' ? (
                <>
                  <stop offset="0%" stopColor="#ffffff" />
                  <stop offset="100%" stopColor="#e0f2fe" />
                </>
              ) : theme === 'dark' ? (
                <>
                  <stop offset="0%" stopColor="#1e293b" />
                  <stop offset="100%" stopColor="#0f172a" />
                </>
              ) : theme === 'emerald' ? (
                <>
                  <stop offset="0%" stopColor="#059669" />
                  <stop offset="100%" stopColor="#10b981" />
                </>
              ) : (
                <>
                  <stop offset="0%" stopColor="#006AFF" />
                  <stop offset="50%" stopColor="#6366F1" />
                  <stop offset="100%" stopColor="#0284c7" />
                </>
              )}
            </linearGradient>

            <linearGradient id={dotGradId} x1="0%" y1="0%" x2="100%" y2="100%">
              {theme === 'white' ? (
                <>
                  <stop offset="0%" stopColor="#38bdf8" />
                  <stop offset="100%" stopColor="#60a5fa" />
                </>
              ) : (
                <>
                  <stop offset="0%" stopColor="#00D26A" />
                  <stop offset="100%" stopColor="#006AFF" />
                </>
              )}
            </linearGradient>
          </defs>

          {/* Smooth Isotype glyph representing 'uwi' in continuous harmonic curves */}
          <path
            d="M 22 28 C 22 56, 32 72, 50 72 C 68 72, 78 56, 78 28"
            stroke={`url(#${gradId1})`}
            strokeWidth="13"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={isAnimated ? 'uwi-draw-path-fast' : ''}
          />
          {/* Central ascending pulse */}
          <path
            d="M 50 48 L 50 28"
            stroke={`url(#${gradId1})`}
            strokeWidth="11"
            strokeLinecap="round"
            className={isAnimated ? 'uwi-draw-path-fast' : ''}
          />
          {/* Energetic signature dot on 'i' */}
          <circle
            cx="78"
            cy="14"
            r="7"
            fill={`url(#${dotGradId})`}
            className={isAnimated ? 'uwi-pop-dot' : ''}
          />
        </svg>
      </div>
    );
  }

  // Full Wordmark Logo: u + w + i in smooth animated SVG paths
  return (
    <div
      id={id}
      role="img"
      aria-label="uwi"
      className={`inline-flex items-center gap-2 select-none ${className}`}
    >
      <svg
        viewBox="0 0 240 80"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={`h-full max-h-full overflow-visible ${sizeStyles.icon ? '' : 'w-auto'}`}
        style={{ height: sizeStyles.height ? `${sizeStyles.height}px` : undefined }}
      >
        <defs>
          <linearGradient id={gradId1} x1="0%" y1="0%" x2="100%" y2="100%">
            {theme === 'white' ? (
              <>
                <stop offset="0%" stopColor="#ffffff" />
                <stop offset="100%" stopColor="#e0f2fe" />
              </>
            ) : theme === 'dark' ? (
              <>
                <stop offset="0%" stopColor="#0f172a" />
                <stop offset="100%" stopColor="#334155" />
              </>
            ) : theme === 'emerald' ? (
              <>
                <stop offset="0%" stopColor="#059669" />
                <stop offset="100%" stopColor="#10b981" />
              </>
            ) : (
              <>
                <stop offset="0%" stopColor="#006AFF" />
                <stop offset="45%" stopColor="#6366F1" />
                <stop offset="100%" stopColor="#0284c7" />
              </>
            )}
          </linearGradient>

          <linearGradient id={gradId2} x1="0%" y1="0%" x2="100%" y2="100%">
            {theme === 'white' ? (
              <>
                <stop offset="0%" stopColor="#bae6fd" />
                <stop offset="100%" stopColor="#ffffff" />
              </>
            ) : (
              <>
                <stop offset="0%" stopColor="#6366F1" />
                <stop offset="100%" stopColor="#00D26A" />
              </>
            )}
          </linearGradient>

          <linearGradient id={dotGradId} x1="0%" y1="0%" x2="100%" y2="100%">
            {theme === 'white' ? (
              <>
                <stop offset="0%" stopColor="#38bdf8" />
                <stop offset="100%" stopColor="#60a5fa" />
              </>
            ) : (
              <>
                <stop offset="0%" stopColor="#00D26A" />
                <stop offset="100%" stopColor="#006AFF" />
              </>
            )}
          </linearGradient>
        </defs>

        {/* Letter 'u': Clean rounded trough & downstroke */}
        <path
          d="M 22 26 C 22 52, 32 64, 48 64 C 64 64, 74 52, 74 26 L 74 64"
          stroke={`url(#${gradId1})`}
          strokeWidth="11"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={isAnimated ? 'uwi-draw-u' : ''}
        />

        {/* Letter 'w': Harmonious double rounded valleys */}
        <path
          d="M 94 26 C 94 52, 102 64, 114 64 C 126 64, 134 50, 134 32 C 134 50, 142 64, 154 64 C 166 64, 174 52, 174 26 L 174 64"
          stroke={`url(#${gradId1})`}
          strokeWidth="11"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={isAnimated ? 'uwi-draw-w' : ''}
        />

        {/* Letter 'i' Stem: Elegant straight line */}
        <path
          d="M 198 26 L 198 64"
          stroke={`url(#${gradId2})`}
          strokeWidth="11"
          strokeLinecap="round"
          className={isAnimated ? 'uwi-draw-i' : ''}
        />

        {/* Letter 'i' Dot: Distinctive vibrant jewel dot */}
        <circle
          cx="198"
          cy="12"
          r="6.5"
          fill={`url(#${dotGradId})`}
          className={isAnimated ? 'uwi-pop-dot' : ''}
        />
      </svg>
    </div>
  );
};
