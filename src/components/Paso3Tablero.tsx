// src/components/Paso3Tablero.tsx
import { useState, useEffect } from 'react';
import {
  collection,
  onSnapshot,
  doc,
  runTransaction,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Cliente, Boleta } from '../types';
import { formatearNumero } from '../utils/validaciones';
import { Trophy, X, LogOut, PlusCircle, UserCheck } from 'lucide-react';
import confetti from 'canvas-confetti';

interface Props {
  cliente: Cliente;
  onBoletaReservada: (clienteActualizado: Cliente, numero: string) => void;
  onSalir: () => void;
  onIrACompra: () => void;
}

interface ModalState {
  tipo: 'confirmar' | 'exito' | 'error' | 'colision' | 'confirmar_salir';
  numero?: string;
  mensaje?: string;
}

export default function Paso3Tablero({ cliente, onBoletaReservada, onSalir, onIrACompra }: Props) {
  const [boletas, setBoletas] = useState<Record<string, Boleta>>({});
  const [loadingTablero, setLoadingTablero] = useState(true);
  const [procesando, setProcesando] = useState(false);
  const [modal, setModal] = useState<ModalState | null>(null);
  const [clienteLocal, setClienteLocal] = useState<Cliente>(cliente);

  // Sincronizar cliente si cambia desde el padre
  useEffect(() => {
    setClienteLocal(cliente);
  }, [cliente]);

  // Listener en tiempo real del tablero
  useEffect(() => {
    const ref = collection(db, 'boletas');
    const unsub = onSnapshot(ref, (snap) => {
      const mapa: Record<string, Boleta> = {};
      snap.forEach((d) => {
        const data = d.data();
        mapa[d.id] = {
          numero: d.id,
          estado: data.estado,
          cliente_whatsapp: data.cliente_whatsapp,
          cliente_nombre: data.cliente_nombre,
          fecha_seleccion: data.fecha_seleccion?.toDate(),
        };
      });
      setBoletas(mapa);
      setLoadingTablero(false);
    });
    return unsub;
  }, []);

  const handleClickNumero = (numero: string) => {
    const boleta = boletas[numero];

    // Si el número ya es del propio cliente
    if (boleta?.cliente_whatsapp === clienteLocal.whatsapp) {
      setModal({
        tipo: 'error',
        mensaje: `El número ${numero} ya está reservado por ti para el sorteo de este mes.`,
      });
      return;
    }

    // Si está ocupado por otro
    if (boleta?.estado === 'ocupado') return;

    // Si no tiene boletas disponibles
    if (clienteLocal.boletas_disponibles <= 0) {
      setModal({
        tipo: 'error',
        mensaje: 'No tienes boletas disponibles en este momento. Registra otra compra para ganar más boletas.',
      });
      return;
    }

    setModal({ tipo: 'confirmar', numero });
  };

  const confirmarSeleccion = async () => {
    if (!modal?.numero || procesando) return;
    const numero = modal.numero;
    setProcesando(true);
    setModal(null);

    try {
      const boletaRef = doc(db, 'boletas', numero);
      const clienteRef = doc(db, 'clientes', clienteLocal.whatsapp);

      await runTransaction(db, async (tx) => {
        const boletaSnap = await tx.get(boletaRef);
        const clienteSnap = await tx.get(clienteRef);

        if (!clienteSnap.exists()) throw new Error('Cliente no encontrado');

        const boletaData = boletaSnap.exists() ? boletaSnap.data() : null;
        const clienteData = clienteSnap.data();

        // Verificar disponibilidad en servidor
        if (boletaData && boletaData.estado === 'ocupado') {
          throw new Error('OCUPADO');
        }

        // Verificar saldo en servidor
        if (clienteData.boletas_disponibles <= 0) {
          throw new Error('SIN_BOLETAS');
        }

        // Todo OK: asignar
        tx.set(boletaRef, {
          numero,
          estado: 'ocupado',
          cliente_whatsapp: clienteLocal.whatsapp,
          cliente_nombre: clienteLocal.nombre,
          fecha_seleccion: serverTimestamp(),
        });

        tx.update(clienteRef, {
          boletas_disponibles: clienteData.boletas_disponibles - 1,
        });
      });

      // Actualizar estado local
      const clienteActualizado: Cliente = {
        ...clienteLocal,
        boletas_disponibles: clienteLocal.boletas_disponibles - 1,
      };
      setClienteLocal(clienteActualizado);

      // Confeti de victoria
      confetti({
        particleCount: 150,
        spread: 80,
        origin: { y: 0.5 },
        colors: ['#a3320e', '#e06d2c', '#fbbf24', '#f59e0b', '#c6501b'],
      });

      setModal({ tipo: 'exito', numero });
      onBoletaReservada(clienteActualizado, numero);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'ERROR';
      if (msg === 'OCUPADO') {
        setModal({
          tipo: 'colision',
          numero,
          mensaje: `¡El número ${numero} acaba de ser reservado por otro cliente! Por favor elige otro número.`,
        });
      } else if (msg === 'SIN_BOLETAS') {
        setModal({ tipo: 'error', mensaje: 'No tienes boletas disponibles.' });
      } else {
        setModal({ tipo: 'error', mensaje: 'Error al procesar la reserva. Intenta de nuevo.' });
      }
    } finally {
      setProcesando(false);
    }
  };

  const getCeldaStyle = (numero: string) => {
    const boleta = boletas[numero];
    const esPropia = boleta?.cliente_whatsapp === clienteLocal.whatsapp;
    const estaOcupado = boleta?.estado === 'ocupado';

    if (esPropia) return 'boleta-propia';
    if (estaOcupado) return 'boleta-ocupado';
    return clienteLocal.boletas_disponibles > 0
      ? 'boleta-disponible'
      : 'boleta-cell bg-[#e6d3d2] text-[#c38f7c] cursor-not-allowed';
  };

  const numerosOcupados = Object.values(boletas).filter((b) => b.estado === 'ocupado').length;
  const numerosDisponibles = 100 - numerosOcupados;
  const misNumeros = Object.values(boletas)
    .filter((b) => b.cliente_whatsapp === clienteLocal.whatsapp)
    .map((b) => b.numero);

  return (
    <div className="flex-1 flex flex-col px-2.5 sm:px-3 py-2 gap-2.5 sm:gap-3 animate-slide-up">
      {/* Barra de usuario activo con botón Salir y Registrar compra */}
      <div className="card bg-white border-[#e06d2c]/30 shadow-sm p-2.5 sm:p-3 flex items-center justify-between">
        <div className="flex items-center gap-2 sm:gap-2.5">
          <div className="w-8.5 h-8.5 sm:w-9 sm:h-9 rounded-full bg-gradient-to-br from-[#e06d2c] to-[#a3320e] text-white flex items-center justify-center font-black text-sm font-display shadow-sm shrink-0">
            <UserCheck size={17} />
          </div>
          <div className="text-left leading-tight overflow-hidden">
            <p className="font-bold text-[#331c19] text-xs sm:text-sm truncate max-w-[120px] sm:max-w-none">
              {clienteLocal.nombre}
            </p>
            <p className="text-[#c38f7c] text-[11px] sm:text-xs font-semibold">
              📱 {clienteLocal.whatsapp}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
          <button
            onClick={onIrACompra}
            className="flex items-center gap-1 bg-[#e06d2c]/10 hover:bg-[#e06d2c]/20 text-[#a3320e] px-2 sm:px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all active:scale-95"
            title="Registrar otra compra"
          >
            <PlusCircle size={14} />
            <span className="hidden sm:inline">Nueva Compra</span>
          </button>
          <button
            onClick={() => setModal({ tipo: 'confirmar_salir' })}
            className="flex items-center gap-1 bg-red-50 hover:bg-red-100 text-red-600 px-2 sm:px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all active:scale-95 border border-red-200"
            title="Cerrar sesión"
          >
            <LogOut size={14} />
            <span>Salir</span>
          </button>
        </div>
      </div>

      {/* Resumen de boletas */}
      <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
        <div className="card text-center py-2 sm:py-2.5 px-1.5 sm:px-2 bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200">
          <p className="text-xl sm:text-2xl font-black font-display text-[#e06d2c]">{clienteLocal.presas_saldo}</p>
          <p className="text-[9.5px] sm:text-[10px] text-[#c38f7c] font-semibold leading-tight">Presas<br/>acumuladas</p>
        </div>
        <div className="card text-center py-2 sm:py-2.5 px-1.5 sm:px-2 bg-gradient-to-br from-[#a3320e]/10 to-[#e06d2c]/10 border-[#e06d2c]/40">
          <p className="text-xl sm:text-2xl font-black font-display text-[#a3320e]">{clienteLocal.boletas_disponibles}</p>
          <p className="text-[9.5px] sm:text-[10px] text-[#c38f7c] font-semibold leading-tight">Boletas<br/>disponibles</p>
        </div>
        <div className="card text-center py-2 sm:py-2.5 px-1.5 sm:px-2 bg-gradient-to-br from-yellow-50 to-amber-50 border-yellow-200">
          <p className="text-xl sm:text-2xl font-black font-display text-[#331c19]">{misNumeros.length}</p>
          <p className="text-[9.5px] sm:text-[10px] text-[#c38f7c] font-semibold leading-tight">Números<br/>reservados</p>
        </div>
      </div>

      {/* Info tablero */}
      <div className="flex items-center justify-between px-1">
        <h2 className="font-display font-extrabold text-[#331c19] text-xs sm:text-sm">Tablero Mensual 00-99</h2>
        <div className="flex gap-1 sm:gap-1.5 text-xs">
          <span className="badge bg-[#e06d2c]/20 text-[#a3320e] py-0.5 text-[10px] sm:text-[11px] px-2 sm:px-3">🟢 {numerosDisponibles} libres</span>
          <span className="badge bg-[#331c19]/10 text-[#331c19] py-0.5 text-[10px] sm:text-[11px] px-2 sm:px-3">🔴 {numerosOcupados} ocupados</span>
        </div>
      </div>

      {/* Mis números */}
      {misNumeros.length > 0 && (
        <div className="card bg-yellow-50/80 border-yellow-300/80 py-2 sm:py-2.5 px-2.5 sm:px-3">
          <p className="text-xs font-bold text-yellow-800 mb-1.5 flex items-center gap-1">
            ✨ Tus números para el sorteo:
          </p>
          <div className="flex flex-wrap gap-1.5">
            {misNumeros.map((n) => (
              <span key={n} className="badge bg-yellow-400 text-[#331c19] font-black font-display text-xs sm:text-sm px-2.5 sm:px-3 py-0.5 sm:py-1 shadow-sm border border-yellow-500/30">
                #{n}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Tablero */}
      {loadingTablero ? (
        <div className="flex-1 flex items-center justify-center py-12">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-4 border-[#e06d2c] border-t-transparent rounded-full animate-spin" />
            <p className="text-[#c38f7c] text-sm font-semibold">Cargando tablero...</p>
          </div>
        </div>
      ) : (
        <div className="card p-2 sm:p-2.5">
          <div className="grid grid-cols-10 gap-0.5 sm:gap-1">
            {Array.from({ length: 100 }, (_, i) => {
              const numero = formatearNumero(i);
              return (
                <button
                  key={numero}
                  onClick={() => handleClickNumero(numero)}
                  className={`boleta-cell text-[10px] sm:text-xs ${getCeldaStyle(numero)} ${procesando ? 'pointer-events-none' : ''}`}
                  disabled={procesando}
                  title={
                    boletas[numero]?.estado === 'ocupado'
                      ? `${boletas[numero]?.cliente_nombre ?? 'Ocupado'}`
                      : `Número ${numero}`
                  }
                >
                  {numero}
                </button>
              );
            })}
          </div>

          {/* Leyenda */}
          <div className="flex justify-center gap-3 mt-2.5 pt-2.5 border-t border-[#e6d3d2]">
            <div className="flex items-center gap-1 text-[11px] text-[#c38f7c]">
              <div className="w-3.5 h-3.5 rounded bg-gradient-to-br from-[#e06d2c] to-[#a3320e]" />
              Libre
            </div>
            <div className="flex items-center gap-1 text-[11px] text-[#c38f7c]">
              <div className="w-3.5 h-3.5 rounded bg-[#331c19]" />
              Ocupado
            </div>
            <div className="flex items-center gap-1 text-[11px] text-[#c38f7c]">
              <div className="w-3.5 h-3.5 rounded bg-gradient-to-br from-yellow-400 to-amber-500" />
              El tuyo
            </div>
          </div>
        </div>
      )}

      {/* Botones de acción inferiores */}
      <div className="flex flex-col gap-2 mt-1">
        {clienteLocal.boletas_disponibles > 0 ? (
          <p className="text-center text-xs font-bold text-[#e06d2c] animate-pulse">
            👆 Toca un número naranja para asignarle tu boleta disponible
          </p>
        ) : (
          <button
            onClick={onIrACompra}
            className="btn-secondary flex items-center justify-center gap-2 py-3 text-sm"
          >
            <PlusCircle size={18} />
            ¿Compraste más presas? Validar otra compra
          </button>
        )}

        <button
          onClick={() => setModal({ tipo: 'confirmar_salir' })}
          className="btn-outline flex items-center justify-center gap-2 py-2.5 text-xs text-[#c38f7c] border-[#c38f7c]/40 hover:border-red-500 hover:text-red-600 hover:bg-red-50"
        >
          <LogOut size={15} />
          Finalizar y Salir
        </button>
      </div>

      {/* Modales */}
      {modal && (
        <div className="modal-overlay" onClick={() => !procesando && setModal(null)}>
          <div className="modal-content p-4 sm:p-6" onClick={(e) => e.stopPropagation()}>
            {/* Confirmar selección */}
            {modal.tipo === 'confirmar' && (
              <div className="flex flex-col items-center gap-4 text-center">
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#e06d2c] to-[#a3320e] flex items-center justify-center shadow-lg">
                  <span className="font-display font-black text-white text-3xl">#{modal.numero}</span>
                </div>
                <div>
                  <h3 className="font-display font-extrabold text-[#331c19] text-xl">¿Confirmas este número?</h3>
                  <p className="text-[#c38f7c] text-sm mt-1">
                    Al confirmar, reservarás el <strong>#{modal.numero}</strong> para la rifa de este mes y se descontará 1 boleta.
                  </p>
                </div>
                <div className="flex gap-3 w-full">
                  <button onClick={() => setModal(null)} className="btn-outline flex-1 py-3 text-sm">
                    Cancelar
                  </button>
                  <button onClick={confirmarSeleccion} className="btn-primary flex-1 py-3 text-sm">
                    ✅ Confirmar
                  </button>
                </div>
              </div>
            )}

            {/* Confirmar Salir */}
            {modal.tipo === 'confirmar_salir' && (
              <div className="flex flex-col items-center gap-4 text-center">
                <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center text-red-600">
                  <LogOut size={28} />
                </div>
                <div>
                  <h3 className="font-display font-extrabold text-[#331c19] text-xl">¿Deseas Salir?</h3>
                  <p className="text-[#c38f7c] text-sm mt-1">
                    Tus presas y boletas reservadas quedan guardadas de forma segura. Podrás ingresar de nuevo con tu número de WhatsApp.
                  </p>
                </div>
                <div className="flex gap-3 w-full">
                  <button onClick={() => setModal(null)} className="btn-outline flex-1 py-3 text-sm">
                    Continuar aquí
                  </button>
                  <button
                    onClick={() => {
                      setModal(null);
                      onSalir();
                    }}
                    className="bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-4 rounded-2xl transition-all flex-1 text-sm font-display shadow-md active:scale-95"
                  >
                    👋 Salir
                  </button>
                </div>
              </div>
            )}

            {/* Éxito */}
            {modal.tipo === 'exito' && (
              <div className="flex flex-col items-center gap-4 text-center">
                <div className="animate-bounce-in">
                  <Trophy size={56} className="text-yellow-500" />
                </div>
                <div>
                  <h3 className="font-display font-extrabold text-[#331c19] text-xl">¡Número Reservado!</h3>
                  <div className="mt-2 text-5xl font-black font-display text-[#a3320e]">#{modal.numero}</div>
                  <p className="text-[#c38f7c] text-sm mt-2">
                    ¡Mucha suerte en el sorteo mensual de Almi Pollo!
                  </p>
                  <p className="text-sm font-semibold text-[#a3320e] mt-1">
                    Boletas restantes: {clienteLocal.boletas_disponibles}
                  </p>
                </div>
                <button onClick={() => setModal(null)} className="btn-primary">
                  ¡Excelente! 🎉
                </button>
              </div>
            )}

            {/* Error o Colisión */}
            {(modal.tipo === 'error' || modal.tipo === 'colision') && (
              <div className="flex flex-col items-center gap-4 text-center">
                <div className="w-16 h-16 rounded-full bg-orange-100 flex items-center justify-center text-[#e06d2c]">
                  <X size={32} />
                </div>
                <div>
                  <h3 className="font-display font-extrabold text-[#331c19] text-lg">Aviso</h3>
                  <p className="text-[#c38f7c] text-sm mt-1 leading-relaxed">{modal.mensaje}</p>
                </div>
                <button onClick={() => setModal(null)} className="btn-secondary w-full">
                  Entendido
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Overlay procesando */}
      {procesando && (
        <div className="modal-overlay">
          <div className="flex flex-col items-center gap-3">
            <div className="w-14 h-14 border-4 border-[#e06d2c] border-t-transparent rounded-full animate-spin" />
            <p className="text-white font-bold">Reservando número...</p>
          </div>
        </div>
      )}
    </div>
  );
}
