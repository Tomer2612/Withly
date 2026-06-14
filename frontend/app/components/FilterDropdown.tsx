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
  const buttonHeight = isSmall ? '36px' : '51px';
  const buttonRadius = isSmall ? '10px' : '15.5px';
  const buttonPadding = isSmall ? '6px 12px' : '0 16px';
  const fontSize = buttonFontSize ?? (isSmall ? '14px' : '18px');
  const minWidth = isSmall ? '90px' : '110px';
  const dropdownFontSize = isSmall ? '14px' : '16px';

  return (
    <div className={`relative inline-block text-right ${className}`} dir="rtl" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          minWidth,
          height: buttonHeight,
          borderRadius: buttonRadius,
          padding: buttonPadding,
          borderWidth: '1px',
          borderStyle: 'solid',
          borderColor: isOpen ? '#3F3F46' : '#D0D0D4',
          fontWeight: 400,
        }}
        className="flex items-center justify-between gap-2 bg-white font-normal text-black transition-colors duration-200 hover:border-gray-400 overflow-visible"
      >
        <span style={{ fontSize, fontWeight: 400 }}>{displayLabel}</span>
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
          className="absolute top-full mt-2 w-full min-w-[140px] bg-white border border-[#D0D0D4] rounded-[10px] z-50 overflow-hidden p-1.5"
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
                  w-full px-3 py-2 text-right rounded-lg transition-colors
                  ${value === '' 
                    ? 'bg-[#E4E4E7] font-normal text-black' 
                    : 'text-gray-700 hover:bg-[#F4F4F5] active:bg-[#3F3F46] active:text-white font-normal'
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
                  w-full px-3 py-2 text-right rounded-lg transition-colors
                  ${value === option.value 
                    ? 'bg-[#E4E4E7] font-normal text-black' 
                    : 'text-gray-700 hover:bg-[#F4F4F5] active:bg-[#3F3F46] active:text-white font-normal'
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
