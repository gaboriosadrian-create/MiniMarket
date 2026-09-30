import React, { useState } from 'react';
import { PackagePlus, Eye, Check } from 'lucide-react';
import { useTheme } from '../../lib/themeContext';
import { getThemeVariant, getThemeDescriptor } from '../../lib/themeVariant';
import { ThemeModalVariant } from '../common/ThemeModalVariant';
import { ThemeButtonVariant } from '../common/ThemeButtonVariant';

export const DesignLabModal: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { activeTheme } = useTheme();
  const variant = getThemeVariant(activeTheme?.id, activeTheme?.layoutStyle);
  const descriptor = getThemeDescriptor(variant);

  return (
    <div 
      className="p-4 sm:p-6 border transition-all space-y-4"
      style={{
        backgroundColor: 'var(--dl-surface)',
        borderColor: 'var(--dl-border)',
        borderRadius: 'var(--dl-radius-lg)',
        boxShadow: 'var(--dl-shadow-sm)'
      }}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b gap-2" style={{ borderColor: 'var(--dl-border-subtle)' }}>
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-black" style={{ color: 'var(--dl-text)' }}>
              12. Modales y Diálogos Operativos
            </h3>
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded uppercase" style={{ backgroundColor: 'var(--dl-primary-subtle)', color: 'var(--dl-primary)' }}>
              {descriptor.name}
            </span>
          </div>
          <p className="text-xs mt-0.5" style={{ color: 'var(--dl-text-muted)' }}>
            Estructura modal interactiva con estética de la variante activa
          </p>
        </div>
        <ThemeButtonVariant variantType="primary" size="sm" onClick={() => setIsOpen(true)}>
          <Eye className="w-3.5 h-3.5 inline mr-1" /> Abrir Modal Real
        </ThemeButtonVariant>
      </div>

      <div className="max-w-md mx-auto p-4 border rounded-xl" style={{ borderColor: 'var(--dl-border)', backgroundColor: 'var(--dl-surface-subtle)' }}>
        <p className="text-xs text-stone-600 mb-3 text-center">
          Haz clic en el botón superior o inferior para abrir el modal renderizado con la geometría y tipografía nativa de <strong>{descriptor.name}</strong>.
        </p>
        <div className="flex justify-center">
          <ThemeButtonVariant variantType="primary" onClick={() => setIsOpen(true)}>
            Probar Modal {descriptor.name}
          </ThemeButtonVariant>
        </div>
      </div>

      {/* Real Theme Modal Variant */}
      <ThemeModalVariant
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="Confirmar Recepción de Mercadería"
        subtitle="Ingreso directo a stock general"
        footer={
          <>
            <ThemeButtonVariant variantType="secondary" onClick={() => setIsOpen(false)}>
              Cancelar
            </ThemeButtonVariant>
            <ThemeButtonVariant variantType="primary" onClick={() => setIsOpen(false)}>
              Confirmar Ingreso
            </ThemeButtonVariant>
          </>
        }
      >
        <div className="space-y-3">
          <p className="font-medium">
            ¿Deseas confirmar la recepción de <strong>24 unidades</strong> de <em>Tortitas de Manteca</em> al stock del local?
          </p>
          <div className="p-3 bg-black/5 rounded text-xs space-y-1 font-mono">
            <div>Proveedor: Panadería López</div>
            <div>Comprobante: FC-0001-00012345</div>
            <div>Monto Total: $36.000</div>
          </div>
        </div>
      </ThemeModalVariant>
    </div>
  );
};
