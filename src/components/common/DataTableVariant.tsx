import React from 'react';
import { useTheme } from '../../lib/themeContext';
import { getThemeVariant, ThemeVariantType } from '../../lib/themeVariant';

export interface Column<T> {
  key: string;
  header: string;
  render?: (item: T) => React.ReactNode;
  align?: 'left' | 'center' | 'right';
  className?: string;
}

interface Props<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (item: T) => string;
  variantOverride?: ThemeVariantType;
  emptyMessage?: string;
  className?: string;
}

export function DataTableVariant<T>({
  columns,
  data,
  keyExtractor,
  variantOverride,
  emptyMessage = 'No hay registros para mostrar',
  className = ''
}: Props<T>) {
  const { activeTheme } = useTheme();
  const variant = variantOverride || getThemeVariant(activeTheme?.id, activeTheme?.layoutStyle);

  if (data.length === 0) {
    return (
      <div className="p-8 text-center text-sm text-stone-400 bg-stone-50/50 rounded-xl border border-dashed border-stone-200">
        {emptyMessage}
      </div>
    );
  }

  // 1. EDITORIAL VARIANT: Magazine style, hairline dividers, serif headers, generous spacing
  if (variant === 'editorial') {
    return (
      <div className={`overflow-x-auto font-serif ${className}`}>
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b-2 border-stone-900 text-stone-900 font-sans text-[11px] font-black tracking-widest uppercase">
              {columns.map((col) => (
                <th key={col.key} className={`py-3 px-3 ${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'} ${col.className || ''}`}>
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-200 text-sm">
            {data.map((item) => (
              <tr key={keyExtractor(item)} className="hover:bg-stone-50 transition-colors">
                {columns.map((col) => (
                  <td key={col.key} className={`py-4 px-3 font-serif ${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'} ${col.className || ''}`}>
                    {col.render ? col.render(item) : (item as any)[col.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  // 2. SWISS VARIANT: 0px radius, stark black borders, strictly aligned grotesque monospace data
  if (variant === 'swiss') {
    return (
      <div className={`overflow-x-auto bg-white border-2 border-black rounded-none ${className}`}>
        <table className="w-full text-left border-collapse font-sans">
          <thead>
            <tr className="bg-black text-white text-[10px] font-black tracking-widest uppercase">
              {columns.map((col) => (
                <th key={col.key} className={`py-2.5 px-3 border-r border-stone-800 last:border-r-0 ${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'} ${col.className || ''}`}>
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-black text-xs font-bold text-black">
            {data.map((item, idx) => (
              <tr key={keyExtractor(item)} className={idx % 2 === 0 ? 'bg-white' : 'bg-stone-50'}>
                {columns.map((col) => (
                  <td key={col.key} className={`py-3 px-3 border-r border-black/20 last:border-r-0 ${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'} ${col.className || ''}`}>
                    {col.render ? col.render(item) : (item as any)[col.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  // 3. TERMINAL VARIANT: Monospace ASCII console table with telemetry borders
  if (variant === 'terminal') {
    return (
      <div className={`overflow-x-auto bg-[#0B0F19] border border-[#1F2937] text-stone-200 font-mono text-xs rounded-none ${className}`}>
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-[#111827] text-sky-400 border-b border-[#1F2937] text-[10px] uppercase tracking-wider">
              {columns.map((col) => (
                <th key={col.key} className={`py-2 px-3 border-r border-[#1F2937] last:border-r-0 ${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'} ${col.className || ''}`}>
                  [ {col.header} ]
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1F2937]/80 text-[11px]">
            {data.map((item) => (
              <tr key={keyExtractor(item)} className="hover:bg-[#1F2937]/50 transition-colors">
                {columns.map((col) => (
                  <td key={col.key} className={`py-2.5 px-3 border-r border-[#1F2937]/50 last:border-r-0 ${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'} ${col.className || ''}`}>
                    {col.render ? col.render(item) : (item as any)[col.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  // 4. BENTO VARIANT: Rounded modular Bento table with pill row highlights
  if (variant === 'bento') {
    return (
      <div className={`overflow-x-auto bg-white rounded-3xl border border-stone-200 p-2 shadow-xs ${className}`}>
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="text-stone-400 text-xs font-bold uppercase tracking-wider border-b border-stone-100">
              {columns.map((col) => (
                <th key={col.key} className={`py-3 px-4 ${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'} ${col.className || ''}`}>
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="text-xs text-stone-800 font-medium">
            {data.map((item) => (
              <tr key={keyExtractor(item)} className="hover:bg-sky-50/60 rounded-2xl transition-all">
                {columns.map((col) => (
                  <td key={col.key} className={`py-3.5 px-4 first:rounded-l-2xl last:rounded-r-2xl ${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'} ${col.className || ''}`}>
                    {col.render ? col.render(item) : (item as any)[col.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  // 5. AURORA VARIANT: Glassmorphism table with glowing rows
  if (variant === 'aurora') {
    return (
      <div className={`overflow-x-auto bg-[#161B22]/90 backdrop-blur-md rounded-2xl border border-[#30363D] shadow-lg ${className}`}>
        <table className="w-full text-left border-collapse text-white">
          <thead>
            <tr className="border-b border-[#30363D] text-violet-300 text-xs font-bold uppercase tracking-wider bg-[#21262D]/50">
              {columns.map((col) => (
                <th key={col.key} className={`py-3 px-4 ${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'} ${col.className || ''}`}>
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#30363D] text-xs text-stone-200">
            {data.map((item) => (
              <tr key={keyExtractor(item)} className="hover:bg-violet-900/20 transition-colors">
                {columns.map((col) => (
                  <td key={col.key} className={`py-3 px-4 ${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'} ${col.className || ''}`}>
                    {col.render ? col.render(item) : (item as any)[col.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  // 6. NEO VARIANT: Cyber platform table with neon highlights
  if (variant === 'neo') {
    return (
      <div className={`overflow-x-auto bg-[#12151C] rounded-xl border border-[#1F2737] shadow-md ${className}`}>
        <table className="w-full text-left border-collapse text-stone-200 font-mono text-xs">
          <thead>
            <tr className="border-b border-[#1F2737] text-[#00F59B] text-[10px] uppercase tracking-widest bg-[#181D27]">
              {columns.map((col) => (
                <th key={col.key} className={`py-2.5 px-3 ${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'} ${col.className || ''}`}>
                  [ {col.header} ]
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1F2937]">
            {data.map((item) => (
              <tr key={keyExtractor(item)} className="hover:bg-[#181D27] hover:border-l-2 hover:border-l-[#00F59B] transition-colors">
                {columns.map((col) => (
                  <td key={col.key} className={`py-3 px-3 ${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'} ${col.className || ''}`}>
                    {col.render ? col.render(item) : (item as any)[col.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  // 7. COMMAND VARIANT: High density operational table
  if (variant === 'command') {
    return (
      <div className={`overflow-x-auto bg-white rounded-md border border-stone-300 shadow-2xs ${className}`}>
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-stone-100 text-stone-700 font-bold uppercase tracking-wider text-[10px] border-b border-stone-300">
              {columns.map((col) => (
                <th key={col.key} className={`py-2 px-3 border-r border-stone-200 last:border-r-0 ${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'} ${col.className || ''}`}>
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-200 text-stone-800">
            {data.map((item) => (
              <tr key={keyExtractor(item)} className="hover:bg-stone-50 transition-colors">
                {columns.map((col) => (
                  <td key={col.key} className={`py-2 px-3 border-r border-stone-100 last:border-r-0 ${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'} ${col.className || ''}`}>
                    {col.render ? col.render(item) : (item as any)[col.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  // 8. STANDARD CLEAN / EMERALD / SOFT (Default)
  return (
    <div className={`overflow-x-auto bg-white rounded-xl border border-stone-200 shadow-2xs ${className}`}>
      <table className="w-full text-left border-collapse text-xs">
        <thead>
          <tr className="bg-stone-50 text-stone-500 font-bold uppercase tracking-wider text-[10px] border-b border-stone-200">
            {columns.map((col) => (
              <th key={col.key} className={`py-3 px-4 ${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'} ${col.className || ''}`}>
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-stone-100 text-stone-800">
          {data.map((item) => (
            <tr key={keyExtractor(item)} className="hover:bg-stone-50/80 transition-colors">
              {columns.map((col) => (
                <td key={col.key} className={`py-3.5 px-4 ${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'} ${col.className || ''}`}>
                  {col.render ? col.render(item) : (item as any)[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
