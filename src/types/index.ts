// src/types/index.ts

export interface Cliente {
  whatsapp: string;
  nombre: string;
  presas_saldo: number;
  boletas_disponibles: number;
  creado_en: Date;
}

export interface Boleta {
  numero: string; // "00" a "99"
  estado: 'disponible' | 'ocupado';
  cliente_whatsapp?: string;
  cliente_nombre?: string;
  fecha_seleccion?: Date;
}

export interface CodigosDiariosMap {
  codigo_pollo_8: string;  // 8 presas
  codigo_medio_4: string;  // 4 presas
  codigo_cuarto_2: string; // 2 presas
  codigo_presa_1: string;  // 1 presa
  codigo_presa_3: string;  // 3 presas
  codigo_presa_5: string;  // 5 presas
  codigo_presa_7: string;  // 7 presas
}

export interface PinDiario {
  fecha: string; // "YYYY-MM-DD"
  pin?: string;  // Legacy single pin fallback
  codigos?: CodigosDiariosMap;
  activo: boolean;
}

export interface Transaccion {
  whatsapp: string;
  nombre: string;
  presas_sumadas: number;
  pin_usado: string;
  categoria?: string;
  fecha: Date;
  boletas_ganadas: number;
}

export interface RifaSemanal {
  semana_id: string;
  fecha_cierre: Date;
  ganador_numero: string;
  ganador_nombre: string;
  ganador_whatsapp: string;
}

export interface RateLimitState {
  intentos: number;
  bloqueadoHasta: number | null;
}

export type PasoRifa = 1 | 2 | 3;

export interface SesionCliente {
  cliente: Cliente;
  paso: PasoRifa;
  pinValidado: boolean;
  nuevasBoletas: number;
}
