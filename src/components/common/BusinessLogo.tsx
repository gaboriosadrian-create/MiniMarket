import React, { useState, useEffect } from 'react';
import { Store } from 'lucide-react';

export interface BusinessLogoProps {
  src?: string | null;
  name?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'custom';
  shape?: 'rounded' | 'circle' | 'square';
  className?: string;
  border?: boolean;
  alt?: string;
  fit?: 'contain' | 'cover';
}

export const BusinessLogo: React.FC<BusinessLogoProps> = ({
  src,
  name = 'Mi Negocio',
  size = 'md',
  shape = 'rounded',
  className = '',
  border = true,
  alt = 'Logo del negocio',
  fit = 'contain',
}) => {
  const [hasError, setHasError] = useState(false);

  // Reset error state if image source changes
  useEffect(() => {
    setHasError(false);
  }, [src]);

  // Size styling maps
  const sizeStyles = {
    xs: 'w-6 h-6 max-h-[24px] text-[10px]',
    sm: 'w-8 h-8 max-h-[32px] text-xs',
    md: 'w-10 h-10 max-h-[40px] text-sm',
    lg: 'w-14 h-14 max-h-[56px] text-base',
    xl: 'w-20 h-20 max-h-[80px] text-xl',
    '2xl': 'w-28 h-28 max-h-[112px] text-3xl',
    custom: '',
  }[size];

  const iconSizes = {
    xs: 'w-3.5 h-3.5',
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-7 h-7',
    xl: 'w-10 h-10',
    '2xl': 'w-14 h-14',
    custom: 'w-5 h-5',
  }[size];

  const shapeStyles = {
    rounded: 'rounded-xl',
    circle: 'rounded-full',
    square: 'rounded-none',
  }[shape];

  // Derive initials from business name
  const initials = React.useMemo(() => {
    if (!name) return 'N';
    const words = name.trim().split(/\s+/);
    if (words.length === 1) {
      return words[0].slice(0, 2).toUpperCase();
    }
    return (words[0][0] + words[1][0]).toUpperCase();
  }, [name]);

  const borderStyle = border ? 'border border-stone-200 shadow-2xs' : '';
  const fitClass = fit === 'cover' ? 'object-cover' : 'object-contain p-0.5';

  if (src && !hasError) {
    return (
      <img
        src={src}
        alt={alt || name}
        onError={() => setHasError(true)}
        className={`${sizeStyles} ${shapeStyles} ${borderStyle} ${fitClass} bg-white shrink-0 ${className}`}
        referrerPolicy="no-referrer"
      />
    );
  }

  // Fallback: Initials or Store icon with clean subtle background
  return (
    <div
      role="img"
      aria-label={alt || name}
      className={`${sizeStyles} ${shapeStyles} ${borderStyle} bg-gradient-to-br from-stone-100 to-stone-200 text-stone-700 flex items-center justify-center font-black tracking-tight shrink-0 select-none ${className}`}
    >
      {initials ? (
        <span>{initials}</span>
      ) : (
        <Store className={`${iconSizes} text-stone-500`} />
      )}
    </div>
  );
};
