export default function MessageIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg 
      viewBox="0 0 16 16" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <path 
        d="M14.6667 11.3333C14.6667 11.687 14.5262 12.0261 14.2762 12.2761C14.0261 12.5262 13.687 12.6667 13.3334 12.6667H4.55204C4.19845 12.6667 3.85936 12.8073 3.60937 13.0573L2.14137 14.5253C2.07518 14.5915 1.99084 14.6366 1.89903 14.6548C1.80722 14.6731 1.71206 14.6637 1.62558 14.6279C1.5391 14.5921 1.46518 14.5314 1.41316 14.4536C1.36115 14.3758 1.33339 14.2843 1.33337 14.1907V3.33333C1.33337 2.97971 1.47385 2.64057 1.7239 2.39052C1.97395 2.14048 2.31309 2 2.66671 2H13.3334C13.687 2 14.0261 2.14048 14.2762 2.39052C14.5262 2.64057 14.6667 2.97971 14.6667 3.33333V11.3333Z" 
        stroke="currentColor" 
        strokeWidth={1.5}
        strokeLinecap="round" 
        strokeLinejoin="round"
      />
      <path 
        d="M4.66663 7.33398H11.3333" 
        stroke="currentColor" 
        strokeWidth={1.5}
        strokeLinecap="round" 
        strokeLinejoin="round"
      />
      <path 
        d="M4.66663 10H8.66663" 
        stroke="currentColor" 
        strokeWidth={1.5}
        strokeLinecap="round" 
        strokeLinejoin="round"
      />
      <path 
        d="M4.66663 4.66602H9.99996" 
        stroke="currentColor" 
        strokeWidth={1.5}
        strokeLinecap="round" 
        strokeLinejoin="round"
      />
    </svg>
  );
}
