'use client';

import { useState, useEffect } from 'react';
import { getImageUrl } from '@/app/lib/imageUrl';

interface AvatarProps {
  src?: string | null;
  name?: string | null;
  email?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  showOnlineIndicator?: boolean;
  className?: string;
  onClick?: () => void;
}

const sizeClasses = {
  xs: 'w-6 h-6 text-xs',
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-12 h-12 text-lg',
  xl: 'w-20 h-20 text-xl',
  '2xl': 'w-24 h-24 text-2xl',
};

const containerSizes = {
  xs: 'w-6 h-6',
  sm: 'w-8 h-8',
  md: 'w-10 h-10',
  lg: 'w-12 h-12',
  xl: 'w-20 h-20',
  '2xl': 'w-24 h-24',
};

const indicatorSizes = {
  xs: 'w-2 h-2',
  sm: 'w-2.5 h-2.5',
  md: 'w-3 h-3',
  lg: 'w-3.5 h-3.5',
  xl: 'w-4 h-4',
  '2xl': 'w-4 h-4',
};

export default function Avatar({
  src,
  name,
  email,
  size = 'md',
  showOnlineIndicator = false,
  className = '',
  onClick,
}: AvatarProps) {
  const [imgError, setImgError] = useState(false);
  
  // Reset error state when src changes
  useEffect(() => {
    setImgError(false);
  }, [src]);
  
  const initials = name?.charAt(0) || email?.charAt(0)?.toUpperCase() || '?';

  const baseClasses = `rounded-full ${sizeClasses[size]} ${onClick ? 'cursor-pointer hover:opacity-80 transition' : ''}`;

  const showImage = src && !imgError;

  return (
    <div className={`relative flex-shrink-0 ${containerSizes[size]} ${className}`} onClick={onClick}>
      {showImage ? (
        <img
          src={getImageUrl(src)}
          alt={name || 'User'}
          className={`${baseClasses} object-cover`}
          onError={() => setImgError(true)}
        />
      ) : (
        <div className={`${baseClasses} bg-pink-100 flex items-center justify-center font-bold text-pink-600`}>
          {initials}
        </div>
      )}
      
      {showOnlineIndicator && (
        <span className={`absolute bottom-0 right-0 ${indicatorSizes[size]} bg-[#A7EA7B] border-2 border-white rounded-full`} />
      )}
    </div>
  );
}
