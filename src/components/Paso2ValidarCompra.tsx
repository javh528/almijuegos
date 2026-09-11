// src/components/Paso2ValidarCompra.tsx
import { useState, useEffect } from 'react';
import {
  doc,
  collection,
  query,
  where,
  getDocs,
  setDoc,
  updateDoc,
  addDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import {
  validarPin,
  calcularBoletas,
  obtenerFechaHoy,
  resolverCodigo,
} from '../utils/validaciones';
import { Cliente, RateLimitState } from '../types';
import { Lock, ArrowRight, Clock, ChevronLeft, LayoutGrid, ShieldAlert, CheckCircle2 } from 'lucide-react';
import confetti from 'canvas-confetti';

interface Props {
  cliente: Cliente;
  onCompraValidada: (clienteActualizado: Cliente, nuevasBoletas: number) => void;
  onVolver: () => void;
  onVerTablero?: () => void;
}

const RATE_LIMIT_KEY = 'rifa_pin_rate_limit';
const MAX_INTENTOS = 3;
const BLOQUEO_MS = 15 * 60 * 1000; // 15 minutos

function getRateLimit(): RateLimitState {
  try {
    const stored = localStorage.getItem(RATE_LIMIT_KEY);
    if (stored) return JSON.parse(stored);
  } catch {}
  return { intentos: 0, bloqueadoHasta: null };
}

function saveRateLimit(state: RateLimitState) {
  localStorage.setItem(RATE_LIMIT_KEY, JSON.stringify(state));
}

function resetRateLimit() {
  localStorage.removeItem(RATE_LIMIT_KEY);
}

export default function Paso2ValidarCompra({ cliente, onCompraValidada, onVolver, onVerTablero }: Props) {
  const [codigo, setCodigo] = useState('');
  const [errorCodigo, setErrorCodigo] = useState('');
  const [errorGeneral, setErrorGeneral] = useState('');
  const [mensajeExito, setMensajeExito] = useState<{ texto: string; presas: number; categoria: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [bloqueado, setBloqueado] = useState(false);
  const [tiempoRestante, setTiempoRestante] = useState(0);

  // Revisar rate limit al montar
  useEffect(() => {
    const rl = getRateLimit();
    if (rl.bloqueadoHasta && Date.now() < rl.bloqueadoHasta) {
      setBloqueado(true);
      setTiempoRestante(Math.ceil((rl.bloqueadoHasta - Date.now()) / 1000));
    } else if (rl.bloqueadoHasta && Date.now() >= rl.bloqueadoHasta) {
      resetRateLimit();
    }
  }, []);

  // Contador de tiempo de bloqueo
  useEffect(() => {
    if (!bloqueado) return;
    const interval = setInterval(() => {
      const rl = getRateLimit();
      if (!rl.bloqueadoHasta || Date.now() >= rl.bloqueadoHasta) {
        setBloqueado(false);
        setTiempoRestante(0);
        resetRateLimit();
        clearInterval(interval);
      } else {
        setTiempoRestante(Math.ceil((rl.bloqueadoHasta - Date.now()) / 1000));
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [bloqueado]);

  const formatTiempo = (seg: number) => {
    const m = Math.floor(seg / 60);
    const s = seg % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorCodigo('');
    setErrorGeneral('');
    setMensajeExito(null);

    if (bloqueado) return;

    // Validar formato del código de 4 dígitos
    const valCodigo = validarPin(codigo);
    if (!valCodigo.valido) {
      setErrorCodigo(valCodigo.error!);
      return;
    }

    setLoading(true);

    try {
      // 1. Buscar códigos activos del día en Firestore
      const hoy = obtenerFechaHoy();
      const pinesRef = collection(db, 'pines_diarios');
      const q = query(pinesRef, where('fecha', '==', hoy), where('activo', '==', true));
      const snap = await getDocs(q);

      if (snap.empty) {
        registrarIntentoFallido();
        setErrorCodigo('No hay códigos activos configurados para hoy. Consulta en caja.');
        setLoading(false);
        return;
      }

      const docData = snap.docs[0].data();

      // 2. Resolver a qué categoría y presas corresponde el código ingresado
      const resultadoCodigo = resolverCodigo(docData.codigos, docData.pin, codigo);

      if (!resultadoCodigo || !resultadoCodigo.valido) {
        const bloqueadoAhora = registrarIntentoFallido();
        if (bloqueadoAhora) {
          setBloqueado(true);
          setTiempoRestante(BLOQUEO_MS / 1000);
        } else {
          const rl = getRateLimit();
          const intentosRestantes = MAX_INTENTOS - rl.intentos;
          setErrorCodigo(
            intentosRestantes > 0
              ? `Código incorrecto o no reconocido. Te quedan ${intentosRestantes} intento${intentosRestantes !== 1 ? 's' : ''}.`
              : 'Código incorrecto.'
          );
        }
        setLoading(false);
        return;
      }

      // Código correcto: resetear contador de rate limit
      resetRateLimit();

      const { presas: presasAsignadas, categoria: nombreCategoria } = resultadoCodigo;

      // 3. SEGURIDAD ANTIFRAUDE: Verificar que este cliente no haya usado este código hoy
      const txRef = collection(db, 'transacciones');
      const txQuery = query(
        txRef,
        where('whatsapp', '==', cliente.whatsapp),
        where('pin_usado', '==', codigo)
      );
      const txSnap = await getDocs(txQuery);

      if (!txSnap.empty) {
        setErrorGeneral(
          `Ya registraste este código (${codigo}) el día de hoy. Cada código es de un único uso por cliente al día.`
        );
        setLoading(false);
        return;
      }

      // 4. Calcular boletas automáticamente con las presas fijas asignadas por el código
      const { boletasGanadas, nuevoSaldo } = calcularBoletas(cliente.presas_saldo, presasAsignadas);
      const nuevasBoletas_disponibles = cliente.boletas_disponibles + boletasGanadas;

      // 5. Actualizar saldo del cliente en Firestore (con merge para máxima tolerancia a fallos)
      const clienteRef = doc(db, 'clientes', cliente.whatsapp);
      await setDoc(
        clienteRef,
        {
          whatsapp: cliente.whatsapp,
          nombre: cliente.nombre,
          presas_saldo: nuevoSaldo,
          boletas_disponibles: nuevasBoletas_disponibles,
        },
        { merge: true }
      );

      // 6. Registrar transacción inmutable con categoría asignada
      await addDoc(collection(db, 'transacciones'), {
        whatsapp: cliente.whatsapp,
        nombre: cliente.nombre,
        presas_sumadas: presasAsignadas,
        categoria: nombreCategoria,
        pin_usado: codigo,
        fecha_str: hoy,
        boletas_ganadas: boletasGanadas,
        fecha: serverTimestamp(),
      });

      // 7. Confeti y mensaje de acreditación automática
      confetti({
        particleCount: 120,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#a3320e', '#e06d2c', '#c6501b', '#fbbf24', '#f59e0b'],
      });

      const clienteActualizado: Cliente = {
        ...cliente,
        presas_saldo: nuevoSaldo,
        boletas_disponibles: nuevasBoletas_disponibles,
      };

      setMensajeExito({
        texto: `¡Código Validado! Se han acreditado automáticamente +${presasAsignadas} presas de ${nombreCategoria}.`,
        presas: presasAsignadas,
        categoria: nombreCategoria,
      });

      // Dar una breve pausa de 1.2s para que el usuario aprecie el mensaje de éxito antes de pasar al tablero
      setTimeout(() => {
        onCompraValidada(clienteActualizado, boletasGanadas);
      }, 1200);

    } catch (err: unknown) {
      if (import.meta.env.DEV) console.error(err);
      const errMsg = err instanceof Error ? err.message : '';
      if (errMsg.includes('permission-denied')) {
        setErrorGeneral('Permiso denegado por las reglas de seguridad de Firebase. Revisa las reglas en Firebase Console.');
      } else {
        setErrorGeneral(
          errMsg
            ? `Error al procesar: ${errMsg}. Verifica tu conexión e intenta de nuevo.`
            : 'Error al procesar el código. Verifica tu conexión e intenta de nuevo.'
        );
      }
    } finally {
      setLoading(false);
    }
  };

  function registrarIntentoFallido(): boolean {
    const rl = getRateLimit();
    const nuevosIntentos = rl.intentos + 1;
    if (nuevosIntentos >= MAX_INTENTOS) {
      saveRateLimit({ intentos: nuevosIntentos, bloqueadoHasta: Date.now() + BLOQUEO_MS });
      return true;
    }
    saveRateLimit({ intentos: nuevosIntentos, bloqueadoHasta: null });
    return false;
  }

  return (
    <div className="flex-1 flex flex-col px-3.5 sm:px-4 py-2.5 sm:py-3 gap-2.5 sm:gap-3 animate-slide-up">
      {/* Resumen Cliente */}
      <div className="card bg-gradient-to-r from-orange-50 to-amber-50 border-[#e06d2c]/30 p-3 sm:p-3.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-[#a3320e] text-white flex items-center justify-center font-black text-sm sm:text-base font-display shadow-sm shrink-0">
              {cliente.nombre.charAt(0).toUpperCase()}
            </div>
            <div className="overflow-hidden">
              <p className="font-bold text-[#331c19] text-sm truncate max-w-[130px] sm:max-w-[190px]">{cliente.nombre}</p>
              <p className="text-[#c38f7c] text-xs">📱 {cliente.whatsapp}</p>
            </div>
          </div>
          <div className="text-right shrink-0">
            <span className="text-[10px] text-[#c38f7c] font-semibold block uppercase">Saldo actual</span>
            <span className="font-black text-[#a3320e] text-lg font-display">
              {cliente.presas_saldo} <span className="text-xs font-semibold">presas</span>
            </span>
          </div>
        </div>
      </div>

      {/* Pantalla de bloqueo */}
      {bloqueado && (
        <div className="card border-red-200 bg-red-50 flex flex-col items-center gap-3 py-6 text-center">
          <Clock size={36} className="text-red-400" />
          <h3 className="font-display font-bold text-red-600 text-lg">Acceso Bloqueado</h3>
          <p className="text-red-500 text-sm leading-relaxed">
            Demasiados intentos fallidos.<br />
            Espera <strong>{formatTiempo(tiempoRestante)}</strong> para intentar de nuevo.
          </p>
        </div>
      )}

      {/* Formulario de Código Único */}
      {!bloqueado && (
        <form onSubmit={handleSubmit} className="card flex flex-col gap-4 p-5 shadow-sm" noValidate>
          <div className="border-b border-[#e6d3d2]/60 pb-2 text-center">
            <h2 className="font-display font-black text-lg text-[#331c19] flex items-center justify-center gap-2">
              🍗 Validar Código de Compra
            </h2>
            <p className="text-[#c38f7c] text-xs mt-1 leading-relaxed">
              Ingresa el código de 4 dígitos que aparece en tu recibo de caja.<br />
              <span className="font-semibold text-[#a3320e]">Tus presas se acreditan de forma 100% automática según tu pedido.</span>
            </p>
          </div>

          {/* Campo de Código (Único campo, sin selección manual) */}
          <div className="flex flex-col gap-1.5 items-center">
            <label className="text-xs font-bold text-[#331c19] flex items-center gap-1">
              <Lock size={14} className="text-[#e06d2c]" />
              Código de Compra (4 dígitos)
            </label>
            <input
              type="text"
              className={`input-base text-center text-3xl font-black tracking-[0.35em] font-display py-3 max-w-[220px] ${
                errorCodigo ? 'border-red-400 focus:border-red-500' : ''
              }`}
              placeholder="••••"
              value={codigo}
              onChange={(e) => {
                const v = e.target.value.replace(/\D/g, '').slice(0, 4);
                setCodigo(v);
                setErrorCodigo('');
                setErrorGeneral('');
              }}
              maxLength={4}
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              disabled={loading || mensajeExito !== null}
            />
            {errorCodigo && (
              <p className="text-red-500 text-xs font-medium flex items-center gap-1 mt-1">
                ⚠ {errorCodigo}
              </p>
            )}
            <p className="text-[#c38f7c] text-[11px] text-center">
              Código entregado en el punto de venta correspondiente a tu compra.
            </p>
          </div>

          {/* Mensaje de Éxito y Acreditación Automática */}
          {mensajeExito && (
            <div className="bg-green-50 border border-green-300 rounded-2xl p-3.5 text-center animate-bounce-in flex flex-col items-center gap-1.5">
              <CheckCircle2 size={28} className="text-green-600" />
              <p className="font-display font-black text-green-800 text-sm">
                ¡Código Validado!
              </p>
              <p className="text-xs font-bold text-green-700">
                Se han acreditado +{mensajeExito.presas} presas ({mensajeExito.categoria})
              </p>
              <p className="text-[11px] text-green-600">
                Cargando tu tablero de boletas...
              </p>
            </div>
          )}

          {/* Error general o código ya usado */}
          {errorGeneral && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-xs text-red-700 flex items-start gap-2">
              <ShieldAlert size={18} className="text-red-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Aviso de Seguridad:</p>
                <p className="mt-0.5 leading-relaxed">{errorGeneral}</p>
                <p className="mt-1 text-[11px] text-red-800 font-semibold">
                  💡 Si realizaste un segundo pedido hoy, solicita en caja la carga directa a través del panel de administración.
                </p>
              </div>
            </div>
          )}

          <button
            type="submit"
            className="btn-primary flex items-center justify-center gap-2 py-3.5 text-base shadow-md"
            disabled={loading || mensajeExito !== null || codigo.length !== 4}
          >
            {loading ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Validando compra...
              </>
            ) : (
              <>
                Validar y Sumar Presas
                <ArrowRight size={18} />
              </>
            )}
          </button>
        </form>
      )}

      {/* Acciones secundarias */}
      <div className="flex gap-2">
        <button onClick={onVolver} className="btn-outline flex items-center justify-center gap-1 text-xs flex-1 py-2.5">
          <ChevronLeft size={15} />
          Cambiar cliente
        </button>

        {onVerTablero && (
          <button
            onClick={onVerTablero}
            className="btn-secondary flex items-center justify-center gap-1 text-xs flex-1 py-2.5 bg-[#331c19] hover:bg-[#a3320e]"
          >
            <LayoutGrid size={15} />
            Ver mi Tablero
          </button>
        )}
      </div>
    </div>
  );
}
