'use client';

import { useState } from 'react';

interface ComingSoonTooltipProps {
  children: React.ReactNode;
  /** Direction the tail arrow points from the tooltip toward the trigger */
  tailDirection: 'up' | 'right';
}

export default function ComingSoonTooltip({ children, tailDirection }: ComingSoonTooltipProps) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      className="relative"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {children}

      {isHovered && (
        <div
          className={`absolute z-50 ${
            tailDirection === 'up'
              ? 'top-full mt-2 left-1/2 -translate-x-1/2'
              : 'right-full mr-2 top-1/2 -translate-y-1/2'
          }`}
          style={{ pointerEvents: 'none' }}
        >
          {/* Tail arrow - up (for navbar item) */}
          {tailDirection === 'up' && (
            <div className="flex justify-center -mb-px">
              <svg width="16" height="8" viewBox="0 0 16 8" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path
                  d="M0 8L16 8L9.41421 1.41421C8.63316 0.633165 7.36683 0.633165 6.58579 1.41421L0 8Z"
                  fill="#A7EA7B"
                />
              </svg>
            </div>
          )}

          <div className="flex items-center">
            {/* Tooltip bubble as SVG */}
            <div className="relative flex items-center justify-center" style={{ width: '284px', height: '40px' }}>
              <svg viewBox="0 0 284 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="absolute inset-0 w-full h-full">
                <rect width="284" height="40" rx="8" fill="#A7EA7B" />
              </svg>
              <span className="relative text-black font-normal" style={{ fontSize: '16px' }}>
                הפיצ&apos;ר הזה בדרך! אנחנו עובדים על זה.
              </span>
            </div>
          </div>

          {/* Tail arrow - right (for sidebar item, pointing right toward trigger) */}
          {tailDirection === 'right' && (
            <div className="flex justify-center -mt-px">
              <svg width="8" height="16" viewBox="0 0 8 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ position: 'absolute', right: '-8px', top: '50%', transform: 'translateY(-50%)' }}>
                <path
                  d="M-2.22545e-07 0L4.76837e-07 16L6.58579 9.41421C7.36684 8.63316 7.36684 7.36683 6.58579 6.58579L-2.22545e-07 0Z"
                  fill="#A7EA7B"
                />
              </svg>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
