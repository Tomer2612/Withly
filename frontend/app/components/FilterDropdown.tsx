'use client';

import { useState, useRef, useEffect } from 'react';

interface DropdownOption {
  value: string;
  label: string;
}

interface FilterDropdownProps {
  value: string;
  onChange: (value: string) => void;
  options: DropdownOption[];
  placeholder: string;
  allLabel?: string;
  className?: string;
  size?: 'default' | 'small';
  buttonFontSize?: string;
}

export default function FilterDropdown({
  value,
  onChange,
  options,
  placeholder,
  allLabel,
  className = '',
  size = 'default',
  buttonFontSize
}: FilterDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, []);

  const selectedOption = options.find((o) => o.value === value);
  const displayLabel = value === '' ? placeholder : selectedOption?.label || placeholder;

  // Size-specific styles
  const isSmall = size === 'small';
  const dropdownFontSize = isSmall ? '14px' : '16px';

  // `small` stays compact/fixed everywhere (community feed toolbars).
  // `default` is responsive: compact + shrinkable on mobile, full size on sm+ (homepage).
  const buttonSizeClasses = isSmall
    ? 'h-[36px] rounded-[10px] px-3 min-w-[90px]'
    : 'h-[51px] rounded-lg px-4 min-w-[110px]';
  const labelSizeClasses = isSmall ? '' : 'text-[18px]';
  // default size: drive font via responsive classes; small (or explicit override) via inline.
  const labelFontSize = isSmall ? (buttonFontSize ?? '14px') : buttonFontSize;

  return (
    <div className={`relative inline-block text-right ${className}`} dir="rtl" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          borderColor: isOpen ? '#3F3F46' : '#D0D0D4',
          fontWeight: 400,
        }}
        className={`flex w-full items-center justify-between gap-2 border border-solid bg-white font-normal text-black transition-colors duration-200 hover:border-gray-400 ${buttonSizeClasses}`}
      >
        <span className={`truncate ${labelSizeClasses}`} style={{ fontSize: labelFontSize, fontWeight: 400 }}>{displayLabel}</span>
        <svg 
          width="10" height="5" viewBox="0 0 10 5" fill="none" 
          xmlns="http://www.w3.org/2000/svg"
          className={`transform transition-transform duration-200 flex-shrink-0 overflow-visible ${isOpen ? 'rotate-180' : ''}`}
        >
          <path 
            d="M1 1L5 5L9 1" 
            stroke="currentColor" 
            strokeWidth="1.5" 
            strokeLinecap="round" 
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {isOpen && (
        <div
          className="absolute top-full mt-2 right-0 w-max min-w-[140px] max-w-[calc(100vw-1rem)] bg-white border border-[#D0D0D4] rounded-md z-50 overflow-hidden p-1.5"
          style={{ 
            maxHeight: '280px', 
            overflowY: 'auto',
            boxShadow: '0px 2px 6px rgba(0, 0, 0, 0.12)'
          }}
        >
          <div dir="rtl" className="flex flex-col gap-0.5">
            {allLabel && (
              <button
                onClick={() => {
                  onChange('');
                  setIsOpen(false);
                }}
                style={{ fontSize: dropdownFontSize }}
                className={`
                  w-full px-3 py-2 text-right rounded-sm transition-colors
                  ${value === '' 
                    ? 'bg-[#E4E4E7] font-semibold text-black' 
                    : 'text-gray-700 hover:bg-[#F4F4F5] active:bg-[#3F3F46] active:text-white font-semibold'
                  }
                `}
              >
                {allLabel}
              </button>
            )}
            
            {options.map((option) => (
              <button
                key={option.value}
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
                style={{ fontSize: dropdownFontSize }}
                className={`
                  w-full px-3 py-2 text-right rounded-sm transition-colors
                  ${value === option.value 
                    ? 'bg-[#E4E4E7] font-semibold text-black' 
                    : 'text-gray-700 hover:bg-[#F4F4F5] active:bg-[#3F3F46] active:text-white font-semibold'
                  }
                `}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
