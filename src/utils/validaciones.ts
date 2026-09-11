// src/utils/validaciones.ts
import { CodigosDiariosMap } from '../types';

/**
 * Mapeo de categorías con presas y etiquetas oficiales
 */
export const CATEGORIAS_CODIGOS: Record<
  keyof CodigosDiariosMap,
  { label: string; presas: number; descripcion: string }
> = {
  codigo_pollo_8: { label: '1 Pollo Entero', presas: 8, descripcion: '8 presas' },
  codigo_medio_4: { label: '1/2 Pollo', presas: 4, descripcion: '4 presas' },
  codigo_cuarto_2: { label: '1/4 Pollo', presas: 2, descripcion: '2 presas' },
  codigo_presa_1: { label: '1 Presa Suelta', presas: 1, descripcion: '1 presa' },
  codigo_presa_3: { label: '3 Presas Sueltas', presas: 3, descripcion: '3 presas' },
  codigo_presa_5: { label: '5 Presas Sueltas', presas: 5, descripcion: '5 presas' },
  codigo_presa_7: { label: '7 Presas Sueltas', presas: 7, descripcion: '7 presas' },
};

/**
 * Genera un conjunto de 7 códigos únicos de 4 dígitos para cada categoría del día
 */
export function generarCodigosDiarios(): CodigosDiariosMap {
  const usados = new Set<string>();

  const generarUnico = (): string => {
    let code: string;
    do {
      code = Math.floor(1000 + Math.random() * 9000).toString();
    } while (usados.has(code));
    usados.add(code);
    return code;
  };

  return {
    codigo_pollo_8: generarUnico(),
    codigo_medio_4: generarUnico(),
    codigo_cuarto_2: generarUnico(),
    codigo_presa_1: generarUnico(),
    codigo_presa_3: generarUnico(),
    codigo_presa_5: generarUnico(),
    codigo_presa_7: generarUnico(),
  };
}

/**
 * Resuelve el código ingresado contra los códigos activos de Firestore
 * Retorna la información de la categoría y presas asignadas, o null si no coincide
 */
export function resolverCodigo(
  codigos: CodigosDiariosMap | undefined,
  pinLegacy: string | undefined,
  codigoIngresado: string
): { valido: boolean; presas: number; categoria: string } | null {
  const code = codigoIngresado.trim();

  // 1. Validar contra el mapa de códigos por categoría
  if (codigos) {
    for (const [key, value] of Object.entries(codigos)) {
      if (value === code && key in CATEGORIAS_CODIGOS) {
        const cat = CATEGORIAS_CODIGOS[key as keyof CodigosDiariosMap];
        return {
          valido: true,
          presas: cat.presas,
          categoria: cat.label,
        };
      }
    }
  }

  // 2. Fallback de compatibilidad con PIN legacy simple (8 presas por defecto)
  if (pinLegacy && pinLegacy === code) {
    return {
      valido: true,
      presas: 8,
      categoria: 'Compra General (1 Pollo)',
    };
  }

  return null;
}

/**
 * Sanitiza el número de WhatsApp para Colombia
 * Elimina espacios, guiones, paréntesis y código de país (+57 / 57)
 * Valida formato colombiano: empieza en 3 y tiene 10 dígitos
 */
export function sanitizarWhatsApp(raw: string): string {
  let digits = raw.replace(/\D/g, '');

  if (digits.startsWith('57') && digits.length === 12) {
    digits = digits.slice(2);
  }

  return digits;
}

export function validarWhatsApp(raw: string): { valido: boolean; limpio: string; error?: string } {
  const limpio = sanitizarWhatsApp(raw);
  const regex = /^3\d{9}$/;

  if (!limpio) {
    return { valido: false, limpio, error: 'El número de WhatsApp es obligatorio.' };
  }
  if (!regex.test(limpio)) {
    return {
      valido: false,
      limpio,
      error: 'Ingresa un número válido de Colombia (10 dígitos, comenzando por 3).',
    };
  }
  return { valido: true, limpio };
}

/**
 * Sanitiza el nombre eliminando etiquetas HTML y scripts (prevención XSS)
 */
export function sanitizarNombre(raw: string): string {
  return raw
    .replace(/<[^>]*>/g, '')
    .replace(/[<>&"'`]/g, '')
    .replace(/javascript:/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 50);
}

export function validarNombre(raw: string): { valido: boolean; limpio: string; error?: string } {
  const limpio = sanitizarNombre(raw);

  if (!limpio || limpio.length < 2) {
    return { valido: false, limpio, error: 'El nombre debe tener al menos 2 caracteres.' };
  }
  if (limpio.length > 50) {
    return { valido: false, limpio, error: 'El nombre no puede superar los 50 caracteres.' };
  }
  return { valido: true, limpio };
}

/**
 * Valida el código: exactamente 4 dígitos numéricos
 */
export function validarPin(pin: string): { valido: boolean; error?: string } {
  const regex = /^\d{4}$/;
  if (!pin) {
    return { valido: false, error: 'El código de compra es obligatorio.' };
  }
  if (!regex.test(pin)) {
    return { valido: false, error: 'El código debe ser exactamente de 4 dígitos numéricos.' };
  }
  return { valido: true };
}

/**
 * Valida la cantidad de presas: entero positivo entre 1 y 100
 */
export function validarPreses(cantidad: number): { valido: boolean; error?: string } {
  if (!Number.isInteger(cantidad) || cantidad < 1) {
    return { valido: false, error: 'Debes ingresar al menos 1 presa.' };
  }
  if (cantidad > 100) {
    return { valido: false, error: 'La cantidad máxima permitida es 100 presas.' };
  }
  return { valido: true };
}

/**
 * Cálculo matemático de boletas y saldo restante
 */
export function calcularBoletas(saldoAnterior: number, presasCompradas: number) {
  const presasTotales = saldoAnterior + presasCompradas;
  const boletasGanadas = Math.floor(presasTotales / 8);
  const nuevoSaldo = presasTotales % 8;
  return { presasTotales, boletasGanadas, nuevoSaldo };
}

/**
 * Formatea número como string de 2 dígitos: 0 → "00", 5 → "05", 99 → "99"
 */
export function formatearNumero(n: number): string {
  return n.toString().padStart(2, '0');
}

/**
 * Formatea timestamp para mostrar en UI
 */
export function formatearFecha(date: Date): string {
  return date.toLocaleString('es-CO', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Genera un PIN aleatorio de 4 dígitos (compatibilidad)
 */
export function generarPinAleatorio(): string {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

/**
 * Obtiene la fecha actual como string YYYY-MM-DD (hora Colombia)
 */
export function obtenerFechaHoy(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
}

/**
 * Obtiene el ID del mes o periodo actual para la rifa
 */
export function obtenerMesId(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  return `${year}_m${month}`;
}

export function obtenerSemanaId(): string {
  return obtenerMesId();
}
