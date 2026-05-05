'use client';

import { useState } from 'react';

interface ComingSoonTooltipProps {
  children: React.ReactNode;
  /** Direction the tail arrow points from the tooltip toward the trigger */
  tailDirection: 'up' | 'right';
  /** Tooltip body. Defaults to the "feature coming soon" message. */
  text?: string;
  /** Override the wrapper sizing — defaults to w-fit (content-sized).
   *  Pass "w-full" / "flex-1" etc. when used inside a flex parent that
   *  expects the tooltip wrapper to expand. */
  wrapperClassName?: string;
}

const DEFAULT_TEXT = 'הפיצ’ר הזה בדרך! אנחנו עובדים על זה.';

export default function ComingSoonTooltip({ children, tailDirection, text, wrapperClassName }: ComingSoonTooltipProps) {
  const [isHovered, setIsHovered] = useState(false);
  const message = text ?? DEFAULT_TEXT;

  return (
    <div
      className={`relative ${wrapperClassName ?? 'w-fit'}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={() => setIsHovered((prev) => !prev)}
    >
      {children}

      {isHovered && (
        <div
          className={`absolute z-50 ${
            tailDirection === 'up'
              ? 'top-full mt-2 left-1/2 -translate-x-1/2'
              : 'top-1/2 -translate-y-1/2'
          }`}
          style={tailDirection === 'right' ? { pointerEvents: 'none', right: '100%', marginRight: '2px' } : { pointerEvents: 'none' }}
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

          <div
            className="relative flex items-center justify-center text-black font-normal whitespace-nowrap"
            style={{
              backgroundColor: '#A7EA7B',
              borderRadius: '8px',
              padding: '10px 16px',
              fontSize: '16px',
              minWidth: '160px',
            }}
          >
            {message}

            {/* Tail arrow - right (for sidebar item, pointing right toward trigger) */}
            {tailDirection === 'right' && (
              <svg width="8" height="16" viewBox="0 0 8 16" fill="none" xmlns="http://www.w3.org/2000/svg" className="absolute" style={{ right: '-8px', top: '50%', transform: 'translateY(-50%)' }}>
                <path
                  d="M-2.22545e-07 0L4.76837e-07 16L6.58579 9.41421C7.36684 8.63316 7.36684 7.36683 6.58579 6.58579L-2.22545e-07 0Z"
                  fill="#A7EA7B"
                />
              </svg>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
