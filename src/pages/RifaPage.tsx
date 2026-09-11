// src/pages/RifaPage.tsx
import { useState } from 'react';
import Header from '../components/Header';
import StepIndicator from '../components/StepIndicator';
import Paso1Registro from '../components/Paso1Registro';
import Paso2ValidarCompra from '../components/Paso2ValidarCompra';
import Paso3Tablero from '../components/Paso3Tablero';
import Footer from '../components/Footer';
import { Cliente } from '../types';

export default function RifaPage() {
  const [paso, setPaso] = useState<1 | 2 | 3>(1);
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [nuevasBoletas, setNuevasBoletas] = useState(0);

  const handleClienteIdentificado = (c: Cliente) => {
    setCliente(c);
    // Si ya tiene boletas disponibles, saltar al tablero directamente
    if (c.boletas_disponibles > 0) {
      setPaso(3);
    } else {
      setPaso(2);
    }
  };

  const handleCompraValidada = (clienteActualizado: Cliente, boletas: number) => {
    setCliente(clienteActualizado);
    setNuevasBoletas(boletas);
    setPaso(3);
  };

  const handleBoletaReservada = (clienteActualizado: Cliente) => {
    setCliente(clienteActualizado);
  };

  const handleSalir = () => {
    setCliente(null);
    setNuevasBoletas(0);
    setPaso(1);
  };

  const handleIrACompra = () => {
    setNuevasBoletas(0);
    setPaso(2);
  };

  return (
    <div
      className={`bg-[#fbf8f5] max-w-md mx-auto flex flex-col ${
        paso === 1
          ? 'h-dvh max-h-dvh overflow-hidden justify-between'
          : 'min-h-dvh'
      }`}
    >
      <div className={`flex flex-col flex-1 ${paso === 1 ? 'overflow-y-auto sm:overflow-hidden min-h-0' : ''}`}>
        <Header />
        <StepIndicator paso={paso} />

        {paso === 1 && (
          <Paso1Registro onClienteIdentificado={handleClienteIdentificado} />
        )}

        {paso === 2 && cliente && (
          <Paso2ValidarCompra
            cliente={cliente}
            onCompraValidada={handleCompraValidada}
            onVolver={() => setPaso(1)}
            onVerTablero={() => setPaso(3)}
          />
        )}

        {paso === 3 && cliente && (
          <>
            {/* Banner de boletas nuevas */}
            {nuevasBoletas > 0 && (
              <div className="mx-3 mb-2 bg-gradient-to-r from-[#a3320e] to-[#e06d2c] text-white rounded-2xl px-4 py-3 text-center shadow-md animate-bounce-in">
                <p className="font-display font-extrabold text-base">
                  🎟️ ¡Ganaste {nuevasBoletas} boleta{nuevasBoletas !== 1 ? 's' : ''}!
                </p>
                <p className="text-xs text-[#e6d3d2] mt-0.5">
                  Toca un número naranja para reservarlo.
                </p>
              </div>
            )}
            <Paso3Tablero
              cliente={cliente}
              onBoletaReservada={handleBoletaReservada}
              onSalir={handleSalir}
              onIrACompra={handleIrACompra}
            />
          </>
        )}
      </div>

      {/* Footer limpio y sin fondo */}
      <Footer compact={paso === 1} className={paso === 1 ? '' : 'py-3 mt-auto'} />
    </div>
  );
}
