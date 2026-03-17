'use client';

import { useState, useRef, useEffect } from 'react';

interface CalendarSelectOption {
  value: number;
  label: string;
}

interface CalendarSelectProps {
  value: number;
  onChange: (value: number) => void;
  options: CalendarSelectOption[];
  className?: string;
}

export default function CalendarSelect({ 
  value, 
  onChange, 
  options, 
  className = ''
}: CalendarSelectProps) {
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

  return (
    <div className={`relative ${className}`} dir="rtl" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        style={{
          borderRadius: '8px',
          borderWidth: '1px',
          borderStyle: 'solid',
          borderColor: isOpen ? '#3F3F46' : '#D0D0D4',
        }}
        className={`
          flex items-center justify-between gap-2 px-3 py-1.5
          bg-white text-sm font-semibold text-black transition-colors duration-200
          hover:border-gray-400 cursor-pointer
        `}
      >
        <span className="whitespace-nowrap">{selectedOption?.label}</span>
        <svg 
          width="10" height="6" viewBox="0 0 10 6" fill="none" 
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
          dir="ltr"
          className="absolute w-max min-w-full bg-white border border-[#D0D0D4] rounded-lg z-[9999] overflow-hidden p-1 top-full mt-1"
          style={{ 
            maxHeight: '200px', 
            overflowY: 'auto',
            boxShadow: '0px 2px 6px rgba(0, 0, 0, 0.12)',
          }}
        >
          <div dir="rtl" className="flex flex-col gap-0.5">
            {options.map((option) => (
              <button
                type="button"
                key={option.value}
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
                className={`
                  w-full px-2 py-1.5 text-right text-sm rounded transition-colors whitespace-nowrap
                  ${value === option.value 
                    ? 'bg-[#E4E4E7] font-semibold text-black' 
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
