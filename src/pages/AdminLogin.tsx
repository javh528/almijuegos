// src/pages/AdminLogin.tsx
import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Lock, Mail, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { FirebaseError } from 'firebase/app';
import Footer from '../components/Footer';

export default function AdminLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const apiKey = import.meta.env.VITE_FIREBASE_API_KEY;
  const isDemoKey = !apiKey || apiKey === 'demo-key' || apiKey === 'TU_API_KEY_AQUI';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const cleanEmail = email.trim();
    if (!cleanEmail || !password) {
      setError('Completa todos los campos.');
      return;
    }

    if (isDemoKey) {
      setError('Las credenciales de Firebase en .env.local aún tienen valores de prueba (demo-key). Copia tus credenciales reales desde Firebase Console.');
      return;
    }

    setLoading(true);
    try {
      await login(cleanEmail, password);
      navigate('/admin', { replace: true });
    } catch (err: unknown) {
      if (import.meta.env.DEV) {
        console.error('Firebase Auth error:', err);
      }
      if (err instanceof FirebaseError) {
        switch (err.code) {
          case 'auth/invalid-credential':
          case 'auth/wrong-password':
          case 'auth/user-not-found':
            setError('Usuario o contraseña incorrectos. Verifica que el correo esté registrado en la pestaña Authentication > Users de Firebase.');
            break;
          case 'auth/invalid-email':
            setError('El formato del correo electrónico no es válido.');
            break;
          case 'auth/user-disabled':
            setError('Esta cuenta de usuario ha sido inhabilitada.');
            break;
          case 'auth/too-many-requests':
            setError('Acceso bloqueado temporalmente por demasiados intentos fallidos. Espera unos minutos.');
            break;
          case 'auth/operation-not-allowed':
            setError('El método "Correo electrónico/Contraseña" no está habilitado en Firebase Authentication > Sign-in method.');
            break;
          case 'auth/invalid-api-key':
          case 'auth/api-key-not-valid':
            setError('La API Key configurada en .env.local no es válida para este proyecto de Firebase.');
            break;
          case 'auth/network-request-failed':
            setError('Error de conexión a internet o bloqueo de red. Verifica tu conexión.');
            break;
          default:
            setError(`Error de autenticación: ${err.message} (${err.code})`);
        }
      } else {
        setError('Error inesperado al conectar con el servidor.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-dvh max-h-dvh overflow-y-auto sm:overflow-hidden flex flex-col items-center justify-between bg-gradient-to-b from-[#a3320e] via-[#c6501b] to-[#331c19] px-3.5 sm:px-4 py-2 sm:py-4">
      <div className="w-full max-w-sm flex flex-col justify-center my-auto">
        {/* Logo oficial de Almi Pollo */}
        <div className="text-center mb-2.5 sm:mb-4 flex flex-col items-center">
          <img
            src="/logo.png"
            alt="Almi Pollo Logo"
            className="h-15 sm:h-20 w-auto max-w-[230px] sm:max-w-[260px] object-contain drop-shadow-2xl mb-1 transition-transform hover:scale-105"
            onError={(e) => {
              (e.currentTarget as HTMLElement).style.display = 'none';
            }}
          />
          <p className="text-yellow-200 text-xs font-bold uppercase tracking-wider">
            Panel de Administración
          </p>
        </div>

        <div className="card p-4 sm:p-5 shadow-2xl">
          <h1 className="font-display font-extrabold text-[#331c19] text-lg mb-3.5 text-center flex items-center justify-center gap-1.5">
            🔐 Acceso Seguro
          </h1>

          {isDemoKey && (
            <div className="mb-3 bg-amber-50 border border-amber-300 rounded-xl p-2.5 text-xs text-amber-800 flex items-start gap-2">
              <AlertCircle size={16} className="text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Credenciales demo detectadas</p>
                <p className="mt-0.5 text-[11px]">
                  Configura tus credenciales reales en <code className="bg-amber-100 px-1 rounded">.env.local</code>.
                </p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-3" noValidate>
            {/* Email */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-[#331c19] flex items-center gap-1">
                <Mail size={13} className="text-[#e06d2c]" />
                Correo Electrónico
              </label>
              <input
                type="email"
                className="input-base py-2.5 px-3 text-sm"
                placeholder="admin@almipollo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                autoFocus
              />
            </div>

            {/* Password */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-[#331c19] flex items-center gap-1">
                <Lock size={13} className="text-[#e06d2c]" />
                Contraseña
              </label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  className="input-base py-2.5 pl-3 pr-10 text-sm"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPass((p) => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#c38f7c] hover:text-[#a3320e] transition-colors"
                >
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 text-xs rounded-xl px-3 py-2 font-medium leading-relaxed">
                ⚠ {error}
              </div>
            )}

            <button type="submit" className="btn-primary flex items-center justify-center gap-2 py-3 text-base mt-1" disabled={loading}>
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Ingresando...
                </>
              ) : (
                'Ingresar al Panel'
              )}
            </button>
          </form>
        </div>

        <div className="flex flex-col items-center gap-1.5 mt-4">
          <Link
            to="/rifa"
            className="text-xs text-yellow-300 hover:text-white transition-colors font-semibold flex items-center gap-1"
          >
            ← Volver a la Rifa de Clientes
          </Link>
          <p className="text-center text-[#e6d3d2]/60 text-[10px]">
            Acceso restringido — solo personal autorizado
          </p>
        </div>
      </div>

      <Footer variant="dark" compact />
    </div>
  );
}
