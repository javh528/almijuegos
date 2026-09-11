// src/components/Footer.tsx
import React from 'react';

interface FooterProps {
  variant?: 'light' | 'dark';
  compact?: boolean;
  className?: string;
}

export default function Footer({
  variant = 'light',
  compact = false,
  className = '',
}: FooterProps) {
  const isDark = variant === 'dark';

  return (
    <footer
      className={`text-center px-3 sm:px-4 flex flex-col items-center justify-center gap-0.5 shrink-0 bg-transparent ${
        compact ? 'py-1 sm:py-1.5' : 'py-2 sm:py-2.5'
      } ${className}`}
    >
      <a
        href="https://github.com/javh528"
        target="_blank"
        rel="noopener noreferrer"
        className={`inline-flex items-center gap-1.5 text-xs font-bold transition-colors group ${
          isDark
            ? 'text-yellow-300 hover:text-white'
            : 'text-[#a3320e] hover:text-[#e06d2c]'
        }`}
        title="GitHub javh528"
      >
        <svg
          className={`w-3.5 h-3.5 fill-current transition-transform group-hover:scale-110 ${
            isDark ? 'text-yellow-400' : 'text-[#e06d2c]'
          }`}
          viewBox="0 0 24 24"
        >
          <path
            fillRule="evenodd"
            clipRule="evenodd"
            d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
          />
        </svg>
        <span>javh528</span>
      </a>
      <p
        className={`text-[11px] font-medium tracking-wide ${
          isDark ? 'text-[#e6d3d2]/80' : 'text-[#c38f7c]'
        }`}
      >
        Elaborado por Julián Andrés Vidal
      </p>
    </footer>
  );
}
