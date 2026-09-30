import React, { useState } from 'react';
import { 
  Store, 
  LayoutDashboard, 
  ShoppingCart, 
  Package, 
  Truck, 
  ClipboardList, 
  History, 
  Settings, 
  ChevronRight,
  User,
  LogOut,
  Sparkles,
  Terminal as TerminalIcon
} from 'lucide-react';
import { useTheme } from '../../lib/themeContext';
import { getThemeVariant, getThemeDescriptor, ThemeVariantType } from '../../lib/themeVariant';
import { Sidebar } from '../Sidebar';

export const DesignLabNavigation: React.FC = () => {
  const { activeTheme } = useTheme();
  const currentVariant = getThemeVariant(activeTheme?.id, activeTheme?.layoutStyle);
  const descriptor = getThemeDescriptor(currentVariant);

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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 mb-4 border-b gap-2" style={{ borderColor: 'var(--dl-border-subtle)' }}>
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-black" style={{ color: 'var(--dl-text)' }}>
              1. Navegación Lateral (Sidebar Estructural)
            </h3>
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded uppercase" style={{ backgroundColor: 'var(--dl-primary-subtle)', color: 'var(--dl-primary)' }}>
              {descriptor.name}
            </span>
          </div>
          <p className="text-xs mt-0.5" style={{ color: 'var(--dl-text-muted)' }}>
            Estructura nativa: <strong>{descriptor.vibe}</strong>
          </p>
        </div>
        <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded" style={{ backgroundColor: 'var(--dl-surface-subtle)', color: 'var(--dl-text-muted)' }}>
          Variante Activa
        </span>
      </div>

      <div className="flex justify-center md:justify-start">
        <div className="w-full max-w-sm rounded-2xl overflow-hidden border shadow-lg" style={{ borderColor: 'var(--dl-border)' }}>
          <Sidebar variant="drawer" />
        </div>
      </div>
    </div>
  );
};
