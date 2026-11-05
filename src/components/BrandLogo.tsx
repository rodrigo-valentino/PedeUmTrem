import React from 'react';

export const BrandLogo: React.FC<{ size?: 'sm' | 'md' | 'lg' }> = ({ size = 'md' }) => {
  const iconSizes = {
    sm: 'w-6 h-6',
    md: 'w-8 h-8',
    lg: 'w-10 h-10',
  };
  const textSizes = {
    sm: 'text-lg',
    md: 'text-2xl',
    lg: 'text-3xl',
  };

  return (
    <div className="inline-flex items-center gap-2 select-none">
      <svg
        className={`${iconSizes[size]} text-[#166534] shrink-0`}
        viewBox="0 0 40 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M9 14H31L33 34C33.1 35.1 32.2 36 31.1 36H8.9C7.8 36 6.9 35.1 7 34L9 14Z"
          stroke="currentColor"
          strokeWidth="2.8"
          strokeLinejoin="round"
          fill="#E8F5EC"
        />
        <path
          d="M14 14V11C14 7.68629 16.6863 5 20 5C23.3137 5 26 7.68629 26 11V14"
          stroke="currentColor"
          strokeWidth="2.8"
          strokeLinecap="round"
        />
      </svg>
      <span
        className={`${textSizes[size]} font-extrabold italic tracking-tight text-[#0F2918]`}
      >
        PedeUmTrem
      </span>
    </div>
  );
};

export const HeroBagIllustration: React.FC = () => (
  <svg
    className="w-28 h-28 sm:w-32 sm:h-32 shrink-0 drop-shadow-md"
    viewBox="0 0 140 130"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    {/* Speed lines */}
    <line x1="8" y1="54" x2="34" y2="54" stroke="#14532D" strokeWidth="4.5" strokeLinecap="round" />
    <line x1="18" y1="68" x2="40" y2="68" stroke="#166534" strokeWidth="4.5" strokeLinecap="round" />
    <line x1="4" y1="82" x2="36" y2="82" stroke="#14532D" strokeWidth="4.5" strokeLinecap="round" />
    <line x1="22" y1="96" x2="42" y2="96" stroke="#166534" strokeWidth="4.5" strokeLinecap="round" />

    {/* Shadow */}
    <ellipse cx="86" cy="118" rx="36" ry="6" fill="#14532D" fillOpacity="0.18" />

    {/* 3D Shopping Bag Side */}
    <path d="M104 38L124 44L118 112L98 114L104 38Z" fill="#14532D" />

    {/* 3D Shopping Bag Front */}
    <path
      d="M46 34L106 38L98 114L38 106L46 34Z"
      fill="url(#bagGrad)"
      stroke="#14532D"
      strokeWidth="2.5"
      strokeLinejoin="round"
    />

    {/* Top Handles */}
    <path
      d="M62 35V25C62 17.8 67.8 12 75 12C82.2 12 88 17.8 88 25V37"
      stroke="#14532D"
      strokeWidth="5"
      strokeLinecap="round"
    />
    <path
      d="M74 36V27C74 20.9 78.9 16 85 16C91.1 16 96 20.9 96 27V38"
      stroke="#1E7E3E"
      strokeWidth="4"
      strokeLinecap="round"
    />

    {/* Inner mini bag icon */}
    <rect
      x="58"
      y="58"
      width="28"
      height="28"
      rx="5"
      stroke="#14532D"
      strokeWidth="3.2"
      fill="#E8F5EC"
      transform="rotate(4 72 72)"
    />
    <path
      d="M66 58V54C66 50.7 68.7 48 72 48C75.3 48 78 50.7 78 54V58"
      stroke="#14532D"
      strokeWidth="3"
      strokeLinecap="round"
    />

    <defs>
      <linearGradient id="bagGrad" x1="46" y1="34" x2="100" y2="114" gradientUnits="userSpaceOnUse">
        <stop stopColor="#FFFFFF" />
        <stop offset="0.55" stopColor="#DCFCE7" />
        <stop offset="1" stopColor="#86EFAC" />
      </linearGradient>
    </defs>
  </svg>
);
