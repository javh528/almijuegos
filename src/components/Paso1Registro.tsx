// src/components/Paso1Registro.tsx
import { useState } from 'react';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { validarWhatsApp, validarNombre, sanitizarNombre } from '../utils/validaciones';
import { Cliente } from '../types';
import { User, Phone, ArrowRight } from 'lucide-react';

interface Props {
  onClienteIdentificado: (cliente: Cliente) => void;
}

export default function Paso1Registro({ onClienteIdentificado }: Props) {
  const [nombre, setNombre] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [errores, setErrores] = useState<{ nombre?: string; whatsapp?: string }>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validar campos
    const valNombre = validarNombre(nombre);
    const valWA = validarWhatsApp(whatsapp);

    const nuevosErrores: { nombre?: string; whatsapp?: string } = {};
    if (!valNombre.valido) nuevosErrores.nombre = valNombre.error;
    if (!valWA.valido) nuevosErrores.whatsapp = valWA.error;

    if (Object.keys(nuevosErrores).length > 0) {
      setErrores(nuevosErrores);
      return;
    }
    setErrores({});

    setLoading(true);
    try {
      const nombreLimpio = sanitizarNombre(nombre);
      const waLimpio = valWA.limpio;
      const clienteRef = doc(db, 'clientes', waLimpio);
      const snap = await getDoc(clienteRef);

      let cliente: Cliente;

      if (snap.exists()) {
        // Cliente existente: cargar datos
        const data = snap.data();
        cliente = {
          whatsapp: waLimpio,
          nombre: data.nombre,
          presas_saldo: data.presas_saldo ?? 0,
          boletas_disponibles: data.boletas_disponibles ?? 0,
          creado_en: data.creado_en?.toDate() ?? new Date(),
        };
      } else {
        // Cliente nuevo: crear en Firestore
        const nuevoCliente = {
          whatsapp: waLimpio,
          nombre: nombreLimpio,
          presas_saldo: 0,
          boletas_disponibles: 0,
          creado_en: serverTimestamp(),
        };
        await setDoc(clienteRef, nuevoCliente);
        cliente = {
          whatsapp: waLimpio,
          nombre: nombreLimpio,
          presas_saldo: 0,
          boletas_disponibles: 0,
          creado_en: new Date(),
        };
      }

      onClienteIdentificado(cliente);
    } catch (err) {
      if (import.meta.env.DEV) console.error(err);
      setError('Error al conectar con el servidor. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col justify-evenly px-3 sm:px-4 py-1 gap-1 sm:gap-2 animate-slide-up overflow-hidden min-h-0">
      {/* Bienvenida con Mascota */}
      <div className="text-center flex flex-col items-center shrink-0">
        <div className="relative mb-0.5 sm:mb-1 group">
          <div className="absolute inset-0 bg-[#e06d2c]/20 rounded-full blur-lg animate-pulse" />
          <img
            src="/mascota.jpg"
            alt="Mascota Almi Pollo"
            className="w-14 h-14 sm:w-20 sm:h-20 rounded-full object-cover shadow-xl border-2 sm:border-3 border-white bg-white ring-2 sm:ring-3 ring-yellow-400/90 relative z-10"
            onError={(e) => {
              (e.currentTarget as HTMLElement).style.display = 'none';
            }}
          />
        </div>
        <h1 className="font-display font-extrabold text-base sm:text-2xl text-[#331c19] leading-tight">
          ¡Bienvenido!<br />
          <span className="text-[#a3320e]">Ganate 1 mes gratis de Netflix!</span>
        </h1>
        <p className="text-[#c38f7c] text-[10.5px] sm:text-xs mt-0.5 sm:mt-1 leading-snug">
          Por cada pollo que compres elige tu número<br />del tablero 00-99 para ganar.
        </p>
      </div>

      {/* Formulario */}
      <form onSubmit={handleSubmit} className="card flex flex-col gap-2 sm:gap-2.5 p-3 sm:p-4 shrink-0 shadow-sm" noValidate>
        {/* Nombre */}
        <div className="flex flex-col gap-1">
          <input
            type="text"
            className={`input-base py-2.5 px-3.5 text-sm ${errores.nombre ? 'border-red-400 focus:border-red-500 focus:ring-red-200' : ''}`}
            placeholder="Nombre Completo"
            value={nombre}
            onChange={(e) => {
              setNombre(e.target.value);
              if (errores.nombre) setErrores((p) => ({ ...p, nombre: undefined }));
            }}
            maxLength={60}
            autoComplete="name"
          />
          {errores.nombre && (
            <p className="text-red-500 text-[11px] font-medium flex items-center gap-1">
              ⚠ {errores.nombre}
            </p>
          )}
        </div>

        {/* WhatsApp */}
        <div className="flex flex-col gap-1">
          <div className="relative">
            <input
              type="tel"
              className={`input-base py-2.5 pl-[58px] sm:pl-16 pr-3 text-sm ${errores.whatsapp ? 'border-red-400 focus:border-red-500 focus:ring-red-200' : ''}`}
              placeholder="Ingresa tu whatssapp"
              value={whatsapp}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, '').slice(0, 12);
                setWhatsapp(val);
                if (errores.whatsapp) setErrores((p) => ({ ...p, whatsapp: undefined }));
              }}
              maxLength={12}
              autoComplete="tel"
              inputMode="numeric"
            />
          </div>
          {errores.whatsapp && (
            <p className="text-red-500 text-[11px] font-medium flex items-center gap-1">
              ⚠ {errores.whatsapp}
            </p>
          )}
          <p className="text-[#c38f7c] text-[10px]">
            Tu número es tu ID único — úsalo siempre el mismo.
          </p>
        </div>

        {/* Error general */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 text-xs rounded-xl px-3 py-2 font-medium">
            ⚠ {error}
          </div>
        )}

        <button type="submit" className="btn-primary flex items-center justify-center gap-2 py-2.5 sm:py-3 text-base mt-0.5" disabled={loading}>
          {loading ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Verificando...
            </>
          ) : (
            <>
              Continuar
              <ArrowRight size={18} />
            </>
          )}
        </button>
      </form>
    </div>
  );
}
