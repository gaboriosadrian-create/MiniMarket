import React from 'react';
import { Plus, Check, Trash2, X, Eye, ArrowRight, Sparkles, RefreshCw } from 'lucide-react';
import { useTheme } from '../../lib/themeContext';
import { getThemeVariant, getThemeDescriptor } from '../../lib/themeVariant';
import { ThemeButtonVariant } from '../common/ThemeButtonVariant';

export const DesignLabButtons: React.FC = () => {
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
              10. Jerarquía de Botones y Acciones
            </h3>
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded uppercase" style={{ backgroundColor: 'var(--dl-primary-subtle)', color: 'var(--dl-primary)' }}>
              {descriptor.name}
            </span>
          </div>
          <p className="text-xs mt-0.5" style={{ color: 'var(--dl-text-muted)' }}>
            Botones renderizados con la geometría y tipografía específica de la variante
          </p>
        </div>
        <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded" style={{ backgroundColor: 'var(--dl-surface-subtle)', color: 'var(--dl-text-muted)' }}>
          Variante: {variant}
        </span>
      </div>

      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <ThemeButtonVariant variantType="primary" size="md">
            + Nueva Operación
          </ThemeButtonVariant>

          <ThemeButtonVariant variantType="secondary" size="md">
            Cancelar
          </ThemeButtonVariant>

          <ThemeButtonVariant variantType="danger" size="md">
            Eliminar Registro
          </ThemeButtonVariant>

          <ThemeButtonVariant variantType="ghost" size="md">
            Ver Detalle →
          </ThemeButtonVariant>
        </div>

        <div className="pt-3 border-t flex flex-wrap items-center gap-3" style={{ borderColor: 'var(--dl-border-subtle)' }}>
          <ThemeButtonVariant variantType="primary" size="sm">
            Compacto (sm)
          </ThemeButtonVariant>
          <ThemeButtonVariant variantType="primary" size="md">
            Estándar (md)
          </ThemeButtonVariant>
          <ThemeButtonVariant variantType="primary" size="lg">
            Prominente (lg)
          </ThemeButtonVariant>
        </div>
      </div>
    </div>
  );
};
