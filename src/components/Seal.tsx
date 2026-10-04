export function Seal({ size = 34, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      className={className}
      role="img"
      aria-label="Pactmark seal"
    >
      <defs>
        <radialGradient id="sealWax" cx="0.5" cy="0.42" r="0.72">
          <stop offset="0" stopColor="#c63a22" />
          <stop offset="1" stopColor="#8d210f" />
        </radialGradient>
      </defs>
      <rect width="64" height="64" rx="15" className="fill-ink" />
      <circle cx="32" cy="32" r="23" fill="url(#sealWax)" />
      <circle cx="32" cy="32" r="16.5" fill="none" stroke="#f2e7ce" strokeWidth="1.6" opacity="0.9" />
      <path
        d="M24 32.5 29.4 37.9 40.5 25.9"
        fill="none"
        stroke="#f2e7ce"
        strokeWidth="3.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
