import React from 'react';
import { Star, CheckCircle, Award, Sliders, ThumbsUp } from 'lucide-react';
import { DesignVariant, DESIGN_VARIANTS } from './types';

interface Props {
  currentVariant: DesignVariant;
}

export const DesignLabEvaluation: React.FC<Props> = ({ currentVariant }) => {
  const currentMeta = DESIGN_VARIANTS[currentVariant];

  const criteria = [
    { name: 'Legibilidad mobile', rating: 5, note: 'Tipografía nítida, contrastes legibles a luz natural' },
    { name: 'Velocidad de operación', rating: 5, note: 'Mínimos clics para completar cobro o remito' },
    { name: 'POS / Terminal táctil', rating: 5, note: 'Botones grandes (+44px), teclado numérico y totales claros' },
    { name: 'Recepción de productos', rating: 5, note: 'Cotejo ágil entre solicitado y recibido con alerta de faltantes' },
    { name: 'Solicitud a proveedores', rating: 5, note: 'Listado compacto y exportación rápida por WhatsApp / Link' },
    { name: 'Dashboard & Métricas', rating: 5, note: 'Jerarquía inmediata de ventas y alertas de stock' },
    { name: 'Densidad de información', rating: 5, note: 'Balance entre comodidad visual y concentración de datos' },
    { name: 'Claridad de estados', rating: 5, note: 'Identificación multi-sensorial con icono, color, texto y contraste' },
    { name: 'Apariencia profesional', rating: 5, note: 'Sensación de software comercial robusto y moderno' },
  ];

  return (
    <div 
      className="p-4 sm:p-6 border transition-all"
      style={{
        backgroundColor: 'var(--dl-surface)',
        borderColor: 'var(--dl-border)',
        borderRadius: 'var(--dl-radius-lg)',
        boxShadow: 'var(--dl-shadow-sm)'
      }}
    >
      <div className="flex items-center justify-between pb-3 mb-4 border-b" style={{ borderColor: 'var(--dl-border-subtle)' }}>
        <div>
          <h3 className="text-sm font-black flex items-center gap-2" style={{ color: 'var(--dl-text)' }}>
            <Award className="w-4 h-4 text-amber-500" />
            <span>15. Criterios de Evaluación Visual</span>
          </h3>
          <p className="text-xs" style={{ color: 'var(--dl-text-muted)' }}>
            Rúbrica de evaluación para la selección definitiva del Design System de uwi
          </p>
        </div>
        <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded" style={{ backgroundColor: 'var(--dl-surface-subtle)', color: 'var(--dl-text-muted)' }}>
          Rúbrica de Decisión
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {criteria.map((c, i) => (
          <div 
            key={i}
            className="p-3.5 border space-y-1.5"
            style={{
              backgroundColor: 'var(--dl-surface)',
              borderColor: 'var(--dl-border)',
              borderRadius: 'var(--dl-radius-md)'
            }}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-black" style={{ color: 'var(--dl-text)' }}>
                {c.name}
              </span>
              <div className="flex items-center text-amber-400">
                {[...Array(c.rating)].map((_, idx) => (
                  <Star key={idx} className="w-3.5 h-3.5 fill-amber-400" />
                ))}
              </div>
            </div>
            <p className="text-[11px] leading-relaxed" style={{ color: 'var(--dl-text-muted)' }}>
              {c.note}
            </p>
          </div>
        ))}
      </div>

      <div 
        className="mt-4 p-4 border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs"
        style={{
          backgroundColor: 'var(--dl-surface-subtle)',
          borderColor: 'var(--dl-border-subtle)',
          borderRadius: 'var(--dl-radius-md)'
        }}
      >
        <div className="flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
          <span className="font-bold" style={{ color: 'var(--dl-text)' }}>
            Evaluando propuesta: <strong>{currentMeta.name}</strong> ({currentMeta.subtitle})
          </span>
        </div>
        <span className="text-[11px] font-mono" style={{ color: 'var(--dl-text-muted)' }}>
          Todas las pantallas de uwi permanecen intactas en producción.
        </span>
      </div>
    </div>
  );
};
