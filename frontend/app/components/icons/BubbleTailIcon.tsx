export default function BubbleTailIcon({ className = "w-2 h-4", style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg 
      viewBox="0 0 8 16" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={style}
    >
      <path 
        d="M-2.22545e-07 0L4.76837e-07 16L6.58579 9.41421C7.36684 8.63316 7.36684 7.36683 6.58579 6.58579L-2.22545e-07 0Z" 
        fill="#A7EA7B"
      />
    </svg>
  );
}
