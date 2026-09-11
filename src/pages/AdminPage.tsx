// src/pages/AdminPage.tsx
import { useState, useEffect } from 'react';
import {
  collection,
  onSnapshot,
  doc,
  updateDoc,
  writeBatch,
  addDoc,
  getDocs,
  serverTimestamp,
  query,
  where,
  getDoc,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import {
  CATEGORIAS_CODIGOS,
  generarCodigosDiarios,
  obtenerFechaHoy,
  obtenerSemanaId,
  formatearFecha,
  formatearNumero,
  calcularBoletas,
  validarWhatsApp,
  validarPreses,
} from '../utils/validaciones';
import { Boleta, Cliente, PinDiario, CodigosDiariosMap } from '../types';
import Footer from '../components/Footer';
import {
  LogOut, RefreshCw, Key, Search, Users, LayoutGrid,
  Trophy, X, Loader2, AlertTriangle, Copy, Check, MessageCircle, ExternalLink
} from 'lucide-react';

type Tab = 'tablero' | 'pin' | 'clientes' | 'cierre';

export default function AdminPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [tab, setTab] = useState<Tab>('tablero');
  const [boletas, setBoletas] = useState<Record<string, Boleta>>({});
  const [pinActivo, setPinActivo] = useState<PinDiario | null>(null);
  const [loadingTablero, setLoadingTablero] = useState(true);
  const [celdaDetalle, setCeldaDetalle] = useState<Boleta | null>(null);
  const [copiadoKey, setCopiadoKey] = useState<string | null>(null);

  // Carga manual de presas
  const [busquedaWA, setBusquedaWA] = useState('');
  const [clienteEncontrado, setClienteEncontrado] = useState<Cliente | null>(null);
  const [presasAgregar, setPresasAgregar] = useState('');
  const [loadingBusqueda, setLoadingBusqueda] = useState(false);
  const [loadingPresas, setLoadingPresas] = useState(false);
  const [msgPresas, setMsgPresas] = useState('');
  const [errBusqueda, setErrBusqueda] = useState('');

  // Cierre de rifa
  const [ganadorNumero, setGanadorNumero] = useState('');
  const [loadingCierre, setLoadingCierre] = useState(false);
  const [msgCierre, setMsgCierre] = useState('');
  const [confirmCierre, setConfirmCierre] = useState(false);
  const [ganadorNotificado, setGanadorNotificado] = useState<{
    nombre: string;
    whatsapp: string;
    numero: string;
    urlWhatsApp: string;
    mensaje: string;
  } | null>(null);

  // Listener tablero en tiempo real
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'boletas'), (snap) => {
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

  // Cargar Códigos / PIN del día
  useEffect(() => {
    const hoy = obtenerFechaHoy();
    const unsub = onSnapshot(
      query(collection(db, 'pines_diarios'), where('fecha', '==', hoy), where('activo', '==', true)),
      (snap) => {
        if (!snap.empty) {
          const d = snap.docs[0].data();
          setPinActivo({
            fecha: d.fecha,
            pin: d.pin,
            codigos: d.codigos,
            activo: d.activo,
          });
        } else {
          setPinActivo(null);
        }
      }
    );
    return unsub;
  }, []);

  // ─── HANDLERS ───────────────────────────────────────────────────────────────

  const handleLogout = async () => {
    await logout();
    navigate('/admin/login', { replace: true });
  };

  // Generar nuevo set de Códigos Diarios por categoría
  const generarCodigos = async () => {
    const hoy = obtenerFechaHoy();
    const nuevosCodigos = generarCodigosDiarios();

    // Desactivar códigos anteriores del día
    const q = query(collection(db, 'pines_diarios'), where('fecha', '==', hoy));
    const snap = await getDocs(q);
    const batch = writeBatch(db);
    snap.forEach((d) => batch.update(d.ref, { activo: false }));
    await batch.commit();

    // Crear nuevo set de códigos activos
    await addDoc(collection(db, 'pines_diarios'), {
      fecha: hoy,
      codigos: nuevosCodigos,
      pin: nuevosCodigos.codigo_pollo_8, // Compatibilidad
      activo: true,
      creado_en: serverTimestamp(),
      creado_por: user?.email,
    });
  };

  const copiarCodigo = (codigo: string, key: string) => {
    navigator.clipboard.writeText(codigo);
    setCopiadoKey(key);
    setTimeout(() => setCopiadoKey(null), 1500);
  };

  // Buscar cliente por WhatsApp
  const buscarCliente = async () => {
    setErrBusqueda('');
    setClienteEncontrado(null);
    setMsgPresas('');

    const val = validarWhatsApp(busquedaWA);
    if (!val.valido) {
      setErrBusqueda(val.error!);
      return;
    }

    setLoadingBusqueda(true);
    try {
      const snap = await getDoc(doc(db, 'clientes', val.limpio));
      if (snap.exists()) {
        const d = snap.data();
        setClienteEncontrado({
          whatsapp: val.limpio,
          nombre: d.nombre,
          presas_saldo: d.presas_saldo ?? 0,
          boletas_disponibles: d.boletas_disponibles ?? 0,
          creado_en: d.creado_en?.toDate() ?? new Date(),
        });
      } else {
        setErrBusqueda('Cliente no encontrado. Verifica el número.');
      }
    } catch {
      setErrBusqueda('Error al buscar cliente.');
    } finally {
      setLoadingBusqueda(false);
    }
  };

  // Agregar presas manualmente
  const agregarPresas = async () => {
    if (!clienteEncontrado) return;
    setMsgPresas('');

    const num = parseInt(presasAgregar, 10);
    const val = validarPreses(num);
    if (!val.valido) {
      setMsgPresas('⚠ ' + val.error);
      return;
    }

    setLoadingPresas(true);
    try {
      const { boletasGanadas, nuevoSaldo } = calcularBoletas(clienteEncontrado.presas_saldo, num);
      const nuevasBoletas = clienteEncontrado.boletas_disponibles + boletasGanadas;

      await updateDoc(doc(db, 'clientes', clienteEncontrado.whatsapp), {
        presas_saldo: nuevoSaldo,
        boletas_disponibles: nuevasBoletas,
      });

      await addDoc(collection(db, 'transacciones'), {
        whatsapp: clienteEncontrado.whatsapp,
        nombre: clienteEncontrado.nombre,
        presas_sumadas: num,
        categoria: 'Carga Manual en Caja',
        pin_usado: 'MANUAL_ADMIN',
        boletas_ganadas: boletasGanadas,
        fecha: serverTimestamp(),
        admin_email: user?.email,
      });

      setClienteEncontrado({
        ...clienteEncontrado,
        presas_saldo: nuevoSaldo,
        boletas_disponibles: nuevasBoletas,
      });
      setMsgPresas(`✅ Agregadas ${num} presas. Ganó ${boletasGanadas} boleta(s). Saldo: ${nuevoSaldo} presas.`);
      setPresasAgregar('');
    } catch {
      setMsgPresas('⚠ Error al actualizar presas.');
    } finally {
      setLoadingPresas(false);
    }
  };

  // Celular oficial del negocio
  const CELULAR_NEGOCIO = '313 831 2412';

  // Generar mensaje limpio 100% compatible para WhatsApp (evita que los emoticones se rompan en rombos con signos de interrogación)
  const generarMensajeGanadorNetflix = (nombre: string, numero: string) => {
    return `*FELICITACIONES, ${nombre.toUpperCase()}!*

Tenemos una noticia maravillosa y muy emocionante para ti!

En *Almi Pollo* queremos agradecerte de todo corazón por tu fidelidad, por tu confianza y por acompañarnos siempre en tu mesa.

*Eres el gran y feliz GANADOR de nuestra rifa con la boleta #${numero}!*
*Tu premio:* Pantalla de Netflix

En el transcurso del día de hoy te estaremos entregando tus credenciales de acceso por este mismo medio para que puedas activarla y comenzar a disfrutar de tus mejores películas y series favoritas.

Cualquier consulta o detalle de tu premio, esta es la línea oficial de atención de *Almi Pollo.*

Muchas felicidades y un sincero abrazo de parte de toda la familia Almi Pollo!`;
  };

  // Cerrar rifa y reiniciar tablero
  const cerrarRifa = async () => {
    const num = parseInt(ganadorNumero, 10);
    if (isNaN(num) || num < 0 || num > 99) {
      setMsgCierre('⚠ Ingresa un número ganador válido (00-99).');
      return;
    }

    const numeroStr = formatearNumero(num);
    const boletaGanadora = boletas[numeroStr];

    setLoadingCierre(true);
    setMsgCierre('');
    setGanadorNotificado(null);

    try {
      // 1. Guardar historial de la semana
      await addDoc(collection(db, 'rifas_semanales'), {
        semana_id: obtenerSemanaId(),
        fecha_cierre: serverTimestamp(),
        ganador_numero: numeroStr,
        ganador_nombre: boletaGanadora?.cliente_nombre ?? 'Sin asignar',
        ganador_whatsapp: boletaGanadora?.cliente_whatsapp ?? '',
        cerrado_por: user?.email,
      });

      // 2. Batch reset: restablecer las 100 boletas a "disponible"
      const BATCH_SIZE = 500;
      const numeros = Array.from({ length: 100 }, (_, i) => formatearNumero(i));

      for (let i = 0; i < numeros.length; i += BATCH_SIZE) {
        const batch = writeBatch(db);
        const chunk = numeros.slice(i, i + BATCH_SIZE);
        chunk.forEach((n) => {
          const ref = doc(db, 'boletas', n);
          batch.set(ref, { numero: n, estado: 'disponible' });
        });
        await batch.commit();
      }

      // 3. Preparar mensaje emotivo y disparar WhatsApp automáticamente
      if (boletaGanadora?.cliente_whatsapp) {
        const digits = boletaGanadora.cliente_whatsapp.replace(/\D/g, '');
        const tel = digits.startsWith('57') ? digits : `57${digits}`;
        const nombreGanador = boletaGanadora.cliente_nombre || 'Estimado(a) Cliente';
        const texto = generarMensajeGanadorNetflix(nombreGanador, numeroStr);
        const waUrl = `https://wa.me/${tel}?text=${encodeURIComponent(texto)}`;

        setGanadorNotificado({
          nombre: nombreGanador,
          whatsapp: boletaGanadora.cliente_whatsapp,
          numero: numeroStr,
          urlWhatsApp: waUrl,
          mensaje: texto,
        });

        // Abrir WhatsApp automáticamente
        try {
          window.open(waUrl, '_blank');
        } catch (e) {
          if (import.meta.env.DEV) console.warn('Bloqueo de ventana emergente al abrir WhatsApp:', e);
        }

        setMsgCierre(
          `✅ ¡Rifa cerrada! Ganador: #${numeroStr} — ${nombreGanador}. Se abrió WhatsApp para enviar la notificación del premio.`
        );
      } else {
        setMsgCierre(
          `✅ ¡Rifa cerrada! Ganador: #${numeroStr} (Sin cliente asignado). Tablero reiniciado.`
        );
      }

      setGanadorNumero('');
      setConfirmCierre(false);
    } catch (err) {
      if (import.meta.env.DEV) console.error(err);
      setMsgCierre('⚠ Error al cerrar la rifa. Intenta de nuevo.');
    } finally {
      setLoadingCierre(false);
    }
  };

  // ─── ESTADÍSTICAS ────────────────────────────────────────────────────────────
  const ocupados = Object.values(boletas).filter((b) => b.estado === 'ocupado').length;
  const disponibles = 100 - ocupados;

  // ─── RENDER ──────────────────────────────────────────────────────────────────
  const tabs: { id: Tab; icon: React.ReactNode; label: string }[] = [
    { id: 'tablero', icon: <LayoutGrid size={15} />, label: 'Tablero' },
    { id: 'pin', icon: <Key size={15} />, label: 'Códigos' },
    { id: 'clientes', icon: <Users size={15} />, label: 'Clientes' },
    { id: 'cierre', icon: <Trophy size={15} />, label: 'Cierre' },
  ];

  return (
    <div className="h-dvh max-h-dvh overflow-hidden flex flex-col bg-[#fbf8f5] max-w-3xl mx-auto shadow-2xl">
      {/* Header Admin con Logo Oficial compacto */}
      <header className="bg-gradient-to-r from-[#331c19] via-[#a3320e] to-[#331c19] text-white px-3.5 py-1.5 flex items-center justify-between shadow-sm shrink-0">
        <div className="flex items-center gap-2.5">
          <img
            src="/logo.png"
            alt="Almi Pollo Logo"
            className="h-8 sm:h-9 w-auto object-contain drop-shadow"
            onError={(e) => {
              (e.currentTarget as HTMLElement).style.display = 'none';
            }}
          />
          <div className="leading-tight">
            <span className="text-yellow-300 text-[11px] font-bold uppercase tracking-wider block">
              Panel Admin
            </span>
            <span className="text-[#e6d3d2] text-[10px] truncate max-w-[150px] sm:max-w-none block">
              {user?.email}
            </span>
          </div>
        </div>

        <button
          onClick={handleLogout}
          className="flex items-center gap-1 bg-white/10 hover:bg-red-600 text-white px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors active:scale-95 shadow-sm"
        >
          <LogOut size={13} />
          <span>Salir</span>
        </button>
      </header>

      {/* Tabs compactos */}
      <nav className="flex border-b border-[#e6d3d2] bg-white shrink-0 z-10">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-bold transition-colors ${tab === t.id
                ? 'text-[#a3320e] border-b-2 border-[#a3320e] bg-orange-50/70'
                : 'text-[#c38f7c] hover:text-[#a3320e]'
              }`}
          >
            {t.icon}
            <span className="text-[11px]">{t.label}</span>
          </button>
        ))}
      </nav>

      {/* Contenedor del contenido */}
      <div className="flex-1 p-2 sm:p-2.5 flex flex-col justify-between overflow-y-auto min-h-0">

        {/* ── TAB: TABLERO ─────────────────────────────────────────────── */}
        {tab === 'tablero' && (
          <div className="flex-1 flex flex-col justify-between gap-1.5 overflow-hidden">
            {/* Barra de estadísticas horizontal y ultra compacta */}
            <div className="flex items-center justify-between bg-white px-3 py-1 rounded-xl border border-[#e6d3d2] shadow-2xs text-xs shrink-0">
              <div className="flex items-center gap-3">
                <span className="font-bold text-[#e06d2c] flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-[#e06d2c] inline-block" />
                  {disponibles} libres
                </span>
                <span className="font-bold text-[#331c19] flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-[#331c19] inline-block" />
                  {ocupados} ocupados
                </span>
              </div>
              <span className="text-[11px] text-[#c38f7c] font-medium hidden sm:inline">
                💡 Clic en número ocupado para ver cliente
              </span>
            </div>

            {/* Tablero admin con botones alargados horizontalmente */}
            {loadingTablero ? (
              <div className="flex-1 flex items-center justify-center">
                <Loader2 size={28} className="animate-spin text-[#e06d2c]" />
              </div>
            ) : (
              <div className="card p-2 flex-1 flex flex-col justify-between shadow-sm overflow-hidden">
                <div className="grid grid-cols-10 gap-1 flex-1 items-stretch">
                  {Array.from({ length: 100 }, (_, i) => {
                    const numero = formatearNumero(i);
                    const boleta = boletas[numero];
                    const ocupado = boleta?.estado === 'ocupado';
                    return (
                      <button
                        key={numero}
                        onClick={() => ocupado && setCeldaDetalle(boleta)}
                        className={`w-full h-full min-h-[24px] sm:min-h-[26px] max-h-[36px] flex items-center justify-center rounded-md font-display font-black text-[10px] sm:text-xs transition-all select-none ${ocupado
                            ? 'bg-[#331c19] text-[#e6d3d2] cursor-pointer hover:bg-[#a3320e] hover:text-white shadow-2xs'
                            : 'bg-gradient-to-br from-[#e06d2c] to-[#a3320e] text-white cursor-default opacity-95'
                          }`}
                        title={ocupado ? `${boleta.cliente_nombre} - Clic para ver` : `Número ${numero} disponible`}
                      >
                        {numero}
                      </button>
                    );
                  })}
                </div>

                {/* Leyenda compacta */}
                <div className="flex justify-center items-center gap-4 pt-1.5 mt-1 border-t border-[#e6d3d2]/70 text-[11px] text-[#c38f7c] shrink-0">
                  <div className="flex items-center gap-1">
                    <span className="w-3 h-2 rounded bg-gradient-to-br from-[#e06d2c] to-[#a3320e] inline-block" /> Disponible
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="w-3 h-2 rounded bg-[#331c19] inline-block" /> Ocupado
                  </div>
                  <span className="text-[10px] sm:hidden">· Clic en ocupado para ver</span>
                </div>
              </div>
            )}

            {/* Modal detalle celda */}
            {celdaDetalle && (
              <div className="modal-overlay" onClick={() => setCeldaDetalle(null)}>
                <div className="modal-content p-4" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-start justify-between mb-2.5">
                    <h3 className="font-display font-extrabold text-[#331c19] text-base">
                      Número <span className="text-[#a3320e]">#{celdaDetalle.numero}</span>
                    </h3>
                    <button onClick={() => setCeldaDetalle(null)} className="text-[#c38f7c] hover:text-[#331c19] p-1">
                      <X size={18} />
                    </button>
                  </div>
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2.5 p-2.5 bg-[#fbf8f5] rounded-xl border border-[#e6d3d2]/60">
                      <div className="w-9 h-9 rounded-full bg-[#a3320e] flex items-center justify-center text-white font-black font-display text-sm shrink-0">
                        {celdaDetalle.cliente_nombre?.charAt(0).toUpperCase()}
                      </div>
                      <div className="overflow-hidden">
                        <p className="font-bold text-[#331c19] text-sm truncate">{celdaDetalle.cliente_nombre}</p>
                        <a
                          href={`https://wa.me/57${celdaDetalle.cliente_whatsapp}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[#e06d2c] text-xs font-semibold hover:underline flex items-center gap-1 mt-0.5"
                        >
                          📱 {celdaDetalle.cliente_whatsapp}
                        </a>
                      </div>
                    </div>
                    {celdaDetalle.fecha_seleccion && (
                      <p className="text-[#c38f7c] text-[11px]">
                        🕐 Reservado: {formatearFecha(celdaDetalle.fecha_seleccion)}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── TAB: CÓDIGOS DE CATEGORÍA ────────────────────────────────── */}
        {tab === 'pin' && (
          <div className="flex-1 flex flex-col justify-between overflow-hidden gap-2">
            <div className="card p-3 shadow-sm flex flex-col gap-2 flex-1 overflow-hidden justify-between">
              <div className="flex items-center justify-between border-b border-[#e6d3d2]/60 pb-1.5">
                <div>
                  <h2 className="font-display font-extrabold text-[#331c19] text-sm sm:text-base flex items-center gap-1.5">
                    <Key size={17} className="text-[#e06d2c]" />
                    Códigos de Compra del Día
                  </h2>
                  <p className="text-[#c38f7c] text-[11px]">
                    Fecha activa: <strong>{obtenerFechaHoy()}</strong> · La cantidad de presas se asigna automáticamente.
                  </p>
                </div>

                <button
                  onClick={generarCodigos}
                  className="btn-primary py-1.5 px-3 text-xs w-auto flex items-center gap-1.5 shadow-sm"
                >
                  <RefreshCw size={13} />
                  <span>{pinActivo ? 'Renovar Códigos' : 'Generar Códigos'}</span>
                </button>
              </div>

              {/* Grid de las 7 categorías con códigos */}
              {pinActivo?.codigos ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5 flex-1 items-stretch overflow-y-auto">
                  {(Object.keys(CATEGORIAS_CODIGOS) as (keyof CodigosDiariosMap)[]).map((key) => {
                    const cat = CATEGORIAS_CODIGOS[key];
                    const code = pinActivo.codigos?.[key] || '----';
                    const esCopiado = copiadoKey === key;

                    return (
                      <div
                        key={key}
                        className="bg-gradient-to-r from-orange-50 to-amber-50/60 border border-[#e06d2c]/25 rounded-xl p-2 flex items-center justify-between shadow-2xs hover:border-[#e06d2c]/60 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-xl shrink-0">🍗</span>
                          <div className="leading-tight">
                            <p className="font-bold text-[#331c19] text-xs">
                              {cat.label}
                            </p>
                            <span className="inline-block bg-[#a3320e] text-white text-[9px] font-black uppercase px-1.5 py-0.2 rounded-md">
                              +{cat.presas} presas
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <span className="font-display font-black text-lg text-[#a3320e] tracking-widest bg-white px-2.5 py-1 rounded-lg border border-[#e06d2c]/30 shadow-inner">
                            {code}
                          </span>
                          <button
                            onClick={() => copiarCodigo(code, key)}
                            title="Copiar código para la factura"
                            className={`p-1.5 rounded-lg border transition-all active:scale-90 ${esCopiado
                                ? 'bg-green-600 text-white border-green-600'
                                : 'bg-white hover:bg-orange-100 text-[#e06d2c] border-[#e06d2c]/30'
                              }`}
                          >
                            {esCopiado ? <Check size={14} /> : <Copy size={14} />}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : pinActivo?.pin ? (
                /* Fallback PIN único anterior si no tiene codigos todavía */
                <div className="bg-gradient-to-r from-[#a3320e]/10 to-[#e06d2c]/10 border border-[#e06d2c]/30 rounded-2xl p-4 text-center my-auto">
                  <p className="text-xs text-[#c38f7c] font-semibold mb-0.5">PIN LEGACY DETECTADO</p>
                  <p className="font-display font-black text-4xl text-[#a3320e] tracking-widest mb-2">
                    {pinActivo.pin}
                  </p>
                  <p className="text-[#c38f7c] text-xs mb-3">
                    Presiona "Renovar Códigos" para generar el nuevo conjunto con las 7 categorías antifraude.
                  </p>
                </div>
              ) : (
                <div className="bg-[#fbf8f5] border border-[#e6d3d2] rounded-2xl p-6 text-center my-auto">
                  <p className="text-[#c38f7c] text-sm font-semibold mb-3">
                    No hay códigos activos para la jornada de hoy ({obtenerFechaHoy()}).
                  </p>
                  <button
                    onClick={generarCodigos}
                    className="btn-primary max-w-xs mx-auto py-2.5 px-4 text-sm"
                  >
                    Generar Códigos del Día
                  </button>
                </div>
              )}

              <p className="text-[10px] text-[#c38f7c] text-center border-t border-[#e6d3d2]/60 pt-1">
                🛡️ Cada código acredita automáticamente las presas exactas según el producto vendido, evitando cualquier alteración manual.
              </p>
            </div>
          </div>
        )}

        {/* ── TAB: CLIENTES ─────────────────────────────────────────────── */}
        {tab === 'clientes' && (
          <div className="flex-1 flex flex-col justify-center max-w-md mx-auto w-full my-auto py-1 sm:py-2">
            <div className="card flex flex-col gap-3 p-4 shadow-sm">
              <div>
                <h2 className="font-display font-extrabold text-[#331c19] text-base flex items-center gap-2">
                  <Users size={18} className="text-[#e06d2c]" />
                  Carga Manual de Presas
                </h2>
                <p className="text-[#c38f7c] text-xs mt-0.5">
                  Para clientes que compran en caja sin smartphone.
                </p>
              </div>

              {/* Búsqueda */}
              <div className="flex gap-2">
                <div className="flex-1">
                  <input
                    type="tel"
                    className={`input-base py-2 px-3 text-sm ${errBusqueda ? 'border-red-400' : ''}`}
                    placeholder="WhatsApp (10 dígitos)"
                    value={busquedaWA}
                    onChange={(e) => {
                      setBusquedaWA(e.target.value.replace(/\D/g, '').slice(0, 12));
                      setErrBusqueda('');
                    }}
                    inputMode="numeric"
                  />
                  {errBusqueda && <p className="text-red-500 text-[11px] mt-1">⚠ {errBusqueda}</p>}
                </div>
                <button
                  onClick={buscarCliente}
                  disabled={loadingBusqueda}
                  className="btn-secondary px-3.5 py-2 text-xs flex items-center gap-1.5 whitespace-nowrap"
                >
                  {loadingBusqueda ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
                  Buscar
                </button>
              </div>

              {/* Cliente encontrado */}
              {clienteEncontrado && (
                <div className="flex flex-col gap-2.5 animate-slide-up">
                  <div className="bg-[#fbf8f5] border border-[#e6d3d2] rounded-xl p-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-[#e06d2c] flex items-center justify-center text-white font-black font-display text-xs">
                        {clienteEncontrado.nombre.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-bold text-[#331c19] text-sm">{clienteEncontrado.nombre}</p>
                        <p className="text-[#c38f7c] text-xs">📱 {clienteEncontrado.whatsapp}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-[#e6d3d2]/60">
                      <div className="text-center">
                        <p className="font-black text-[#a3320e] text-base font-display">{clienteEncontrado.presas_saldo}</p>
                        <p className="text-[10px] text-[#c38f7c]">Presas saldo</p>
                      </div>
                      <div className="text-center">
                        <p className="font-black text-[#e06d2c] text-base font-display">{clienteEncontrado.boletas_disponibles}</p>
                        <p className="text-[10px] text-[#c38f7c]">Boletas disponibles</p>
                      </div>
                    </div>
                  </div>

                  {/* Agregar presas */}
                  <div className="flex gap-2">
                    <input
                      type="number"
                      className="input-base py-2 px-3 text-sm flex-1"
                      placeholder="Presas a agregar"
                      value={presasAgregar}
                      onChange={(e) => setPresasAgregar(e.target.value.replace(/\D/g, ''))}
                      min={1}
                      max={100}
                      inputMode="numeric"
                    />
                    <button
                      onClick={agregarPresas}
                      disabled={loadingPresas || !presasAgregar}
                      className="btn-secondary px-3.5 py-2 text-xs whitespace-nowrap flex items-center gap-1.5"
                    >
                      {loadingPresas ? <Loader2 size={14} className="animate-spin" /> : null}
                      Agregar
                    </button>
                  </div>

                  {msgPresas && (
                    <div className={`rounded-xl px-3 py-2 text-xs font-medium ${msgPresas.startsWith('✅')
                        ? 'bg-green-50 border border-green-200 text-green-700'
                        : 'bg-red-50 border border-red-200 text-red-600'
                      }`}>
                      {msgPresas}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── TAB: CIERRE ───────────────────────────────────────────────── */}
        {tab === 'cierre' && (
          <div className="flex-1 flex flex-col justify-center max-w-md mx-auto w-full my-auto py-1 sm:py-2">
            <div className="card border-red-200 flex flex-col gap-3 p-4 shadow-sm">
              <div className="flex items-center gap-2">
                <AlertTriangle size={18} className="text-red-500" />
                <h2 className="font-display font-extrabold text-[#331c19] text-base">
                  Cierre y Reinicio de Rifa
                </h2>
              </div>

              <div className="bg-red-50 border border-red-200 rounded-xl p-2 text-xs text-red-700">
                <p className="font-bold mb-0.5">⚠ Esta acción:</p>
                <ul className="list-disc list-inside space-y-0.5 text-[11px]">
                  <li>Registra el número ganador en el historial.</li>
                  <li>Restablece las 100 boletas a "disponible".</li>
                  <li>Los saldos de presas de los clientes se CONSERVAN.</li>
                </ul>
              </div>

              {/* Número ganador */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-[#331c19]">
                  🏆 Número Ganador (00-99)
                </label>
                <div className="flex gap-2 items-center">
                  <input
                    type="text"
                    className="input-base text-center text-xl font-black font-display w-20 py-1.5"
                    placeholder="42"
                    value={ganadorNumero}
                    onChange={(e) => {
                      const v = e.target.value.replace(/\D/g, '').slice(0, 2);
                      setGanadorNumero(v);
                      setMsgCierre('');
                    }}
                    maxLength={2}
                    inputMode="numeric"
                  />
                  {ganadorNumero !== '' && boletas[formatearNumero(parseInt(ganadorNumero, 10))]?.cliente_nombre && (
                    <div className="flex-1 bg-yellow-50 border border-yellow-200 rounded-xl p-2 text-xs">
                      <p className="font-bold text-yellow-700 truncate">
                        🏆 {boletas[formatearNumero(parseInt(ganadorNumero, 10))]?.cliente_nombre}
                      </p>
                      <p className="text-yellow-600 text-[11px]">
                        📱 {boletas[formatearNumero(parseInt(ganadorNumero, 10))]?.cliente_whatsapp}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {msgCierre && (
                <div className={`rounded-xl px-3 py-2 text-xs font-medium ${msgCierre.startsWith('✅')
                    ? 'bg-green-50 border border-green-200 text-green-700'
                    : 'bg-red-50 border border-red-200 text-red-600'
                  }`}>
                  {msgCierre}
                </div>
              )}

              {/* Tarjeta de Confirmación y Reenvío de WhatsApp */}
              {ganadorNotificado && (
                <div className="bg-gradient-to-br from-emerald-50 to-green-50 border border-emerald-300 rounded-2xl p-3 shadow-sm flex flex-col gap-2.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">🏆</span>
                    <div>
                      <h4 className="font-bold text-xs text-emerald-900 font-display">
                        ¡Ganador Notificado: {ganadorNotificado.nombre}!
                      </h4>
                      <p className="text-[11px] text-emerald-700">
                        Boleta #{ganadorNotificado.numero} • Premio: Pantalla Netflix 🍿 • Cel negocio: 313 831 2412
                      </p>
                    </div>
                  </div>

                  {/* Opciones de envío: Botón directo o QR para el celular */}
                  <div className="flex flex-col sm:flex-row items-center gap-3 bg-white/90 p-2.5 rounded-xl border border-emerald-200">
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=110x110&data=${encodeURIComponent(ganadorNotificado.urlWhatsApp)}`}
                      alt="QR WhatsApp"
                      className="w-22 h-22 rounded-lg border border-emerald-300 shadow-sm shrink-0"
                    />
                    <div className="flex flex-col gap-1 text-center sm:text-left">
                      <p className="text-xs font-bold text-emerald-900">
                        📱 Escanear con celular (313 831 2412)
                      </p>
                      <p className="text-[10.5px] text-emerald-700 leading-tight">
                        Si no tienes WhatsApp en la PC, apunta la cámara de tu celular a este QR y se abrirá el mensaje listo para enviar.
                      </p>
                      <a
                        href={ganadorNotificado.urlWhatsApp}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="bg-[#25D366] hover:bg-[#20ba59] text-white font-bold py-1.5 px-3 rounded-lg 
                                   shadow hover:shadow-md transition-all active:scale-95 inline-flex items-center justify-center gap-1.5 text-xs mt-1"
                      >
                        <MessageCircle size={14} />
                        <span>Abrir en este dispositivo</span>
                        <ExternalLink size={12} className="opacity-80" />
                      </a>
                    </div>
                  </div>

                  <div className="bg-white/90 border border-emerald-200 rounded-xl p-2.5 text-[11px] flex flex-col gap-1">
                    <div className="flex justify-between items-center text-[#7a4f42] text-[10px] font-bold">
                      <span>MENSAJE ENVIADO:</span>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(ganadorNotificado.mensaje);
                          setCopiadoKey('ganador_msg');
                          setTimeout(() => setCopiadoKey(null), 2000);
                        }}
                        className="text-[#e06d2c] hover:underline flex items-center gap-1"
                      >
                        {copiadoKey === 'ganador_msg' ? (
                          <>
                            <Check size={11} className="text-green-600" /> Copiado
                          </>
                        ) : (
                          <>
                            <Copy size={11} /> Copiar texto
                          </>
                        )}
                      </button>
                    </div>
                    <p className="whitespace-pre-line text-[#442c26] text-[10.5px] leading-relaxed bg-[#fbf8f5] p-2 rounded-lg border border-dashed border-emerald-200">
                      {ganadorNotificado.mensaje}
                    </p>
                  </div>
                </div>
              )}

              {!confirmCierre ? (
                <button
                  onClick={() => setConfirmCierre(true)}
                  className="bg-red-600 hover:bg-red-700 text-white font-bold py-2.5 px-4 rounded-xl 
                             transition-all duration-200 shadow-md active:scale-95 w-full text-xs font-display
                             flex items-center justify-center gap-2"
                  disabled={loadingCierre}
                >
                  <Trophy size={16} />
                  Cerrar Rifa y Reiniciar Tablero
                </button>
              ) : (
                <div className="flex flex-col gap-2.5 bg-red-50/70 border border-red-200 p-3 rounded-xl">
                  <p className="text-center font-bold text-[#331c19] text-xs">
                    ¿Confirmas el cierre con el número <strong className="text-[#a3320e]">
                      {ganadorNumero !== '' ? formatearNumero(parseInt(ganadorNumero, 10)) : '??'}
                    </strong> como ganador?
                  </p>

                  {ganadorNumero !== '' && boletas[formatearNumero(parseInt(ganadorNumero, 10))]?.cliente_nombre && (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-2.5 text-center text-xs text-emerald-800 flex flex-col gap-1">
                      <p className="font-bold flex items-center justify-center gap-1.5 text-xs text-emerald-900">
                        <MessageCircle size={14} className="text-[#25D366]" />
                        Se enviará WhatsApp desde la línea del negocio (313 831 2412):
                      </p>
                      <p className="text-xs font-semibold text-emerald-800">
                        Destinatario: {boletas[formatearNumero(parseInt(ganadorNumero, 10))]?.cliente_nombre} (📱 {boletas[formatearNumero(parseInt(ganadorNumero, 10))]?.cliente_whatsapp})
                      </p>
                      <p className="text-[11px] text-emerald-700">
                        🍿 Premio: <strong>Pantalla de Netflix</strong> (se notifica entrega de credenciales en el día)
                      </p>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <button onClick={() => setConfirmCierre(false)} className="btn-outline flex-1 py-2 text-xs">
                      Cancelar
                    </button>
                    <button
                      onClick={cerrarRifa}
                      disabled={loadingCierre}
                      className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-3 rounded-xl 
                                 transition-all duration-200 shadow-md active:scale-95 flex items-center justify-center gap-1.5 text-xs"
                    >
                      {loadingCierre ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        '✅ Confirmar y Enviar'
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <Footer compact />
    </div>
  );
}
