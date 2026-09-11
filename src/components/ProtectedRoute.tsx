// src/components/ProtectedRoute.tsx
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-[#fbf8f5]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 border-4 border-[#e06d2c] border-t-transparent rounded-full animate-spin" />
          <p className="text-[#a3320e] font-semibold">Verificando acceso...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/admin/login" replace />;
  }

  return <>{children}</>;
}
