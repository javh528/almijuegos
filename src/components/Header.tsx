// src/components/Header.tsx
import { Link } from 'react-router-dom';
import { Shield } from 'lucide-react';

interface HeaderProps {
  showAdminLink?: boolean;
}

export default function Header({ showAdminLink = true }: HeaderProps) {
  return (
    <header className="w-full bg-gradient-to-b from-[#a3320e] via-[#c6501b] to-[#a3320e] text-white py-1.5 sm:py-2.5 px-3 sm:px-4 shadow-md relative overflow-hidden flex items-center justify-center shrink-0">
      {/* Background glow decoration */}
      <div className="absolute -top-10 -right-10 w-36 h-36 bg-[#e06d2c]/25 rounded-full blur-2xl pointer-events-none" />
      <div className="absolute -bottom-10 -left-10 w-36 h-36 bg-yellow-500/20 rounded-full blur-2xl pointer-events-none" />

      {/* Botón de escudo Admin pequeño y accesible en la esquina derecha */}
      {showAdminLink && (
        <Link
          to="/admin/login"
          title="Acceso Administrador"
          aria-label="Acceso Administrador"
          className="absolute right-2 top-2 sm:right-3 sm:top-3 z-20 bg-[#331c19]/50 hover:bg-[#331c19] text-yellow-300/90 hover:text-yellow-300 w-8.5 h-8.5 sm:w-10 sm:h-10 rounded-full border border-yellow-400/30 shadow-sm transition-all active:scale-90 flex items-center justify-center"
        >
          <Shield size={15} />
        </Link>
      )}

      {/* Logo adaptativo centrado */}
      <div className="flex items-center justify-center relative z-10 w-full px-9 sm:px-10">
        <img
          src="/logo.png"
          alt="Almi Pollo Logo"
          className="h-14 sm:h-20 max-h-16 sm:max-h-22 w-auto max-w-[220px] sm:max-w-[320px] object-contain drop-shadow-2xl transition-transform hover:scale-105"
          onError={(e) => {
            (e.currentTarget as HTMLElement).style.display = 'none';
          }}
        />
      </div>
    </header>
  );
}
