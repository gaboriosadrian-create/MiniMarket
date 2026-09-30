import React from 'react';
import { HelpCircle } from 'lucide-react';

export interface SectionGuideTriggerProps {
  onClick: () => void;
  label?: string;
  className?: string;
  variant?: 'default' | 'subtle' | 'compact';
}

export const SectionGuideTrigger: React.FC<SectionGuideTriggerProps> = ({
  onClick,
  label = '¿Qué puedo hacer aquí?',
  className = '',
  variant = 'default'
}) => {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Ver explicación de esta sección"
      title="Ver explicación de esta sección"
      className={`inline-flex items-center justify-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer select-none active:scale-95 ${
        variant === 'subtle'
          ? 'bg-stone-100 hover:bg-stone-200 text-stone-700 border border-stone-200/80 shadow-2xs'
          : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200/90 shadow-2xs'
      } ${className}`}
    >
      <HelpCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-600 shrink-0" />
      <span className="hidden sm:inline font-semibold">{label}</span>
      <span className="sm:hidden text-xs font-bold">?</span>
    </button>
  );
};
