// src/components/StepIndicator.tsx

interface StepIndicatorProps {
  paso: 1 | 2 | 3;
}

const pasos = [
  { num: 1, label: 'Identificación' },
  { num: 2, label: 'Validar Compra' },
  { num: 3, label: 'Tu Número' },
];

export default function StepIndicator({ paso }: StepIndicatorProps) {
  return (
    <div className="flex items-center justify-center gap-0.5 sm:gap-1 px-2 sm:px-4 py-1 sm:py-2 shrink-0">
      {pasos.map((p, i) => {
        const activo = p.num === paso;
        const completado = p.num < paso;
        return (
          <div key={p.num} className="flex items-center">
            <div className="flex flex-col items-center gap-0.5">
              <div
                className={`w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center text-[11px] sm:text-xs font-bold transition-all duration-300 ${
                  completado
                    ? 'bg-[#a3320e] text-white'
                    : activo
                    ? 'bg-[#e06d2c] text-white shadow-md ring-2 ring-[#e06d2c]/40'
                    : 'bg-[#e6d3d2] text-[#c38f7c]'
                }`}
              >
                {completado ? '✓' : p.num}
              </div>
              <span
                className={`text-[9px] sm:text-[10px] font-semibold whitespace-nowrap transition-colors ${
                  activo ? 'text-[#a3320e]' : completado ? 'text-[#a3320e]/70' : 'text-[#c38f7c]'
                }`}
              >
                {p.label}
              </span>
            </div>
            {i < pasos.length - 1 && (
              <div
                className={`w-5 sm:w-8 h-0.5 mx-0.5 sm:mx-1 mb-3.5 sm:mb-4 transition-colors duration-300 ${
                  p.num < paso ? 'bg-[#a3320e]' : 'bg-[#e6d3d2]'
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
