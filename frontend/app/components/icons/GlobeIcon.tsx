interface GlobeIconProps {
  className?: string;
  size?: number;
  color?: string;
}

export default function GlobeIcon({ className = "w-4 h-4", size, color = "currentColor" }: GlobeIconProps) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      width={size}
      height={size}
      style={{ color }}
    >
      <path 
        d="M8.00065 14.6654C11.6825 14.6654 14.6673 11.6806 14.6673 7.9987C14.6673 4.3168 11.6825 1.33203 8.00065 1.33203C4.31875 1.33203 1.33398 4.3168 1.33398 7.9987C1.33398 11.6806 4.31875 14.6654 8.00065 14.6654Z" 
        stroke="currentColor" 
        strokeWidth="1.25"
        strokeLinecap="round" 
        strokeLinejoin="round"
      />
      <path 
        d="M8.00065 1.33203C6.28881 3.12947 5.33398 5.51652 5.33398 7.9987C5.33398 10.4809 6.28881 12.8679 8.00065 14.6654C9.71249 12.8679 10.6673 10.4809 10.6673 7.9987C10.6673 5.51652 9.71249 3.12947 8.00065 1.33203Z" 
        stroke="currentColor" 
        strokeWidth="1.25"
        strokeLinecap="round" 
        strokeLinejoin="round"
      />
      <path 
        d="M1.33398 8H14.6673" 
        stroke="currentColor" 
        strokeWidth="1.25"
        strokeLinecap="round" 
        strokeLinejoin="round"
      />
    </svg>
  );
}
