interface PlayIconProps {
  className?: string;
  size?: number;
  color?: string;
}

export default function PlayIcon({ className = "w-12 h-12", size = 48, color = "white" }: PlayIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <foreignObject x="-4" y="-4" width="56" height="56">
        <div
          style={{
            backdropFilter: "blur(2px)",
            clipPath: "url(#bgblur_0_737_443_clip_path)",
            height: "100%",
            width: "100%",
          }}
        />
      </foreignObject>
      <g data-figma-bg-blur-radius="4">
        <rect
          x="1.5"
          y="1.5"
          width="45"
          height="45"
          rx="22.5"
          fill="black"
          fillOpacity="0.25"
        />
        <rect
          x="1.5"
          y="1.5"
          width="45"
          height="45"
          rx="22.5"
          stroke={color}
          strokeWidth="3"
        />
        <path
          d="M17 17.0006C16.9999 16.6487 17.0926 16.303 17.2689 15.9984C17.4451 15.6938 17.6986 15.4411 18.0038 15.2658C18.3089 15.0905 18.6549 14.9988 19.0068 15C19.3587 15.0012 19.7041 15.0952 20.008 15.2726L32.005 22.2706C32.3078 22.4463 32.5591 22.6983 32.7339 23.0016C32.9088 23.3049 33.0009 23.6487 33.0012 23.9987C33.0015 24.3488 32.91 24.6928 32.7357 24.9963C32.5614 25.2999 32.3105 25.5524 32.008 25.7286L20.008 32.7286C19.7041 32.906 19.3587 33 19.0068 33.0012C18.6549 33.0024 18.3089 32.9107 18.0038 32.7354C17.6986 32.5601 17.4451 32.3074 17.2689 32.0028C17.0926 31.6982 16.9999 31.3525 17 31.0006V17.0006Z"
          fill={color}
        />
      </g>
      <defs>
        <clipPath id="bgblur_0_737_443_clip_path" transform="translate(4 4)">
          <rect x="1.5" y="1.5" width="45" height="45" rx="22.5" />
        </clipPath>
      </defs>
    </svg>
  );
}
