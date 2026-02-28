'use client';

export function LogoIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* @ symbol stylized as a chat/mention bubble */}
      <rect width="32" height="32" rx="8" fill="currentColor" className="text-primary" />
      <path
        d="M16 7C11.03 7 7 11.03 7 16c0 2.76 1.24 5.23 3.19 6.88.18.15.44.12.59-.06.15-.18.12-.44-.06-.59C9.04 20.72 8 18.48 8 16c0-4.42 3.58-8 8-8s8 3.58 8 8c0 1.86-.86 3.23-1.93 3.23-.55 0-.82-.4-.82-1.05V14.5c0-.28-.22-.5-.5-.5s-.5.22-.5.5v.32A3.5 3.5 0 0016.5 13a3.5 3.5 0 00-3.5 3.5 3.5 3.5 0 003.5 3.5c1.12 0 2.1-.53 2.75-1.34.31.8 1.02 1.34 1.93 1.34 1.65 0 2.82-1.82 2.82-4.23V16c0-4.97-4.03-9-9-9zm.5 12a2.5 2.5 0 01-2.5-2.5 2.5 2.5 0 012.5-2.5 2.5 2.5 0 012.5 2.5A2.5 2.5 0 0116.5 19z"
        fill="white"
        className="text-primary-foreground"
      />
    </svg>
  );
}

export function LogoFull({ className }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2 ${className ?? ''}`}>
      <LogoIcon className="w-8 h-8" />
      <span className="text-lg font-bold">GetMention</span>
    </div>
  );
}

export function LogoSmall({ className }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2 ${className ?? ''}`}>
      <LogoIcon className="w-6 h-6" />
      <span className="text-sm font-semibold">GetMention</span>
    </div>
  );
}
