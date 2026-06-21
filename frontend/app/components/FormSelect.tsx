'use client';

import { useState, useRef, useEffect } from 'react';

interface FormSelectOption {
  value: string;
  label: string;
}

interface FormSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: FormSelectOption[];
  placeholder?: string;
  label?: string;
  required?: boolean;
  className?: string;
  disabled?: boolean;
  openUpward?: boolean;
}

export default function FormSelect({ 
  value, 
  onChange, 
  options, 
  placeholder = 'בחר...',
  label,
  required = false,
  className = '',
  disabled = false,
  openUpward = false
}: FormSelectProps) {
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

  return (
    <div className={`relative ${className}`} dir="rtl" ref={dropdownRef}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-2 text-right">
          {label}
          {required && <span className="mr-1" style={{ color: 'var(--color-error)' }}>*</span>}
        </label>
      )}
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        style={{
          borderRadius: '10px',
          borderWidth: '1px',
          borderStyle: 'solid',
          borderColor: isOpen ? '#3F3F46' : '#D0D0D4',
          paddingTop: '6px',
          paddingBottom: '6px',
        }}
        className={`
          w-full flex items-center justify-between gap-4 px-4
          bg-white font-semibold text-black transition-colors duration-200
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-gray-400 cursor-pointer'}
          ${value === '' ? 'text-gray-400' : 'text-black'}
        `}
      >
        <span style={{ fontSize: '16px' }}>{displayLabel}</span>
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
          className={`absolute w-full bg-white border border-[#D0D0D4] rounded-md z-50 overflow-hidden p-1.5 ${openUpward ? 'bottom-full mb-2' : 'top-full mt-2'}`}
          style={{ 
            maxHeight: '280px', 
            overflowY: 'auto',
            boxShadow: '0px 2px 6px rgba(0, 0, 0, 0.12)'
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
                style={{ fontSize: '16px' }}
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
