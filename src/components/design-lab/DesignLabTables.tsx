import React from 'react';
import { Package, Edit3, CheckCircle2, AlertCircle, Flame, MoreVertical, Eye } from 'lucide-react';

export const DesignLabTables: React.FC = () => {
  const products = [
    { id: '1', name: 'Tortitas', category: 'Panificados', stock: 24, price: 1500, status: 'Normal', statusType: 'success' },
    { id: '2', name: 'Medialunas', category: 'Panificados', stock: 2, price: 1200, status: 'Crítico', statusType: 'danger' },
    { id: '3', name: 'Alfajores Chocolate', category: 'Golosinas', stock: 5, price: 950, status: 'Bajo', statusType: 'warning' },
    { id: '4', name: 'Galletas de Agua', category: 'Almacén', stock: 38, price: 1100, status: 'Normal', statusType: 'success' },
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
          <h3 className="text-sm font-black" style={{ color: 'var(--dl-text)' }}>
            11. Tablas Desktop y Listados Mobile Equivalentes
          </h3>
          <p className="text-xs" style={{ color: 'var(--dl-text-muted)' }}>
            Comparación: tabla densa para pantallas amplias vs listado en tarjetas apiladas para mobile sin scroll horizontal
          </p>
        </div>
        <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded" style={{ backgroundColor: 'var(--dl-surface-subtle)', color: 'var(--dl-text-muted)' }}>
          Data Tables
        </span>
      </div>

      <div className="space-y-6">
        {/* Desktop View Table */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-black uppercase tracking-wider" style={{ color: 'var(--dl-text-muted)' }}>
              💻 Vista Desktop (Tabla estándar)
            </h4>
            <span className="text-[11px] text-stone-400 font-mono">4 registros</span>
          </div>

          <div 
            className="border overflow-x-auto"
            style={{
              backgroundColor: 'var(--dl-surface)',
              borderColor: 'var(--dl-border)',
              borderRadius: 'var(--dl-radius-md)'
            }}
          >
            <table className="min-w-full divide-y" style={{ borderColor: 'var(--dl-border-subtle)' }}>
              <thead style={{ backgroundColor: 'var(--dl-surface-subtle)' }}>
                <tr>
                  <th className="px-4 py-2.5 text-left text-[11px] font-black uppercase tracking-wider" style={{ color: 'var(--dl-text-muted)' }}>
                    Producto
                  </th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-black uppercase tracking-wider" style={{ color: 'var(--dl-text-muted)' }}>
                    Categoría
                  </th>
                  <th className="px-4 py-2.5 text-center text-[11px] font-black uppercase tracking-wider" style={{ color: 'var(--dl-text-muted)' }}>
                    Stock
                  </th>
                  <th className="px-4 py-2.5 text-right text-[11px] font-black uppercase tracking-wider" style={{ color: 'var(--dl-text-muted)' }}>
                    Precio
                  </th>
                  <th className="px-4 py-2.5 text-center text-[11px] font-black uppercase tracking-wider" style={{ color: 'var(--dl-text-muted)' }}>
                    Estado
                  </th>
                  <th className="px-4 py-2.5 text-right text-[11px] font-black uppercase tracking-wider" style={{ color: 'var(--dl-text-muted)' }}>
                    Acción
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: 'var(--dl-border-subtle)' }}>
                {products.map((p) => {
                  let statusBg = 'var(--dl-success-bg)';
                  let statusBorder = 'var(--dl-success-border)';
                  let statusText = 'var(--dl-success-text)';

                  if (p.statusType === 'warning') {
                    statusBg = 'var(--dl-warning-bg)';
                    statusBorder = 'var(--dl-warning-border)';
                    statusText = 'var(--dl-warning-text)';
                  } else if (p.statusType === 'danger') {
                    statusBg = 'var(--dl-danger-bg)';
                    statusBorder = 'var(--dl-danger-border)';
                    statusText = 'var(--dl-danger-text)';
                  }

                  return (
                    <tr key={p.id} className="transition-colors hover:bg-black/2">
                      <td className="px-4 py-3 whitespace-nowrap text-xs font-black" style={{ color: 'var(--dl-text)' }}>
                        {p.name}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-xs" style={{ color: 'var(--dl-text-muted)' }}>
                        {p.category}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-center text-xs font-mono font-black" style={{ color: 'var(--dl-text)' }}>
                        {p.stock} un
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-right text-xs font-mono font-black" style={{ color: 'var(--dl-primary)' }}>
                        ${p.price.toLocaleString('es-AR')}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-center">
                        <span 
                          className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 border"
                          style={{
                            backgroundColor: statusBg,
                            borderColor: statusBorder,
                            color: statusText,
                            borderRadius: 'var(--dl-radius-full)'
                          }}
                        >
                          {p.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-right text-xs">
                        <button
                          type="button"
                          className="px-2.5 py-1 text-xs font-bold border cursor-pointer inline-flex items-center gap-1"
                          style={{
                            backgroundColor: 'var(--dl-secondary)',
                            borderColor: 'var(--dl-border)',
                            color: 'var(--dl-text)',
                            borderRadius: 'var(--dl-radius-sm)'
                          }}
                        >
                          <Edit3 className="w-3 h-3" />
                          <span>Editar</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Mobile View List Equivalent */}
        <div className="space-y-2">
          <h4 className="text-xs font-black uppercase tracking-wider" style={{ color: 'var(--dl-text-muted)' }}>
            📱 Vista Mobile (Tarjetas apiladas sin scroll horizontal)
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-w-2xl">
            {products.map((p) => {
              let statusBg = 'var(--dl-success-bg)';
              let statusBorder = 'var(--dl-success-border)';
              let statusText = 'var(--dl-success-text)';

              if (p.statusType === 'warning') {
                statusBg = 'var(--dl-warning-bg)';
                statusBorder = 'var(--dl-warning-border)';
                statusText = 'var(--dl-warning-text)';
              } else if (p.statusType === 'danger') {
                statusBg = 'var(--dl-danger-bg)';
                statusBorder = 'var(--dl-danger-border)';
                statusText = 'var(--dl-danger-text)';
              }

              return (
                <div
                  key={`m-${p.id}`}
                  className="p-3 border flex items-center justify-between gap-3 shadow-xs"
                  style={{
                    backgroundColor: 'var(--dl-surface)',
                    borderColor: 'var(--dl-border)',
                    borderRadius: 'var(--dl-radius-md)'
                  }}
                >
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <h5 className="text-xs font-black truncate" style={{ color: 'var(--dl-text)' }}>
                        {p.name}
                      </h5>
                      <span 
                        className="text-[9px] font-black uppercase px-1.5 py-0.2 border"
                        style={{
                          backgroundColor: statusBg,
                          borderColor: statusBorder,
                          color: statusText,
                          borderRadius: 'var(--dl-radius-full)'
                        }}
                      >
                        {p.status}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-[11px]">
                      <span style={{ color: 'var(--dl-text-muted)' }}>Stock: <strong style={{ color: 'var(--dl-text)' }}>{p.stock} un</strong></span>
                      <span style={{ color: 'var(--dl-border)' }}>•</span>
                      <span className="font-mono font-black" style={{ color: 'var(--dl-primary)' }}>
                        ${p.price.toLocaleString('es-AR')}
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="p-2 border cursor-pointer shrink-0"
                    style={{
                      backgroundColor: 'var(--dl-secondary)',
                      borderColor: 'var(--dl-border)',
                      color: 'var(--dl-text)',
                      borderRadius: 'var(--dl-radius-sm)'
                    }}
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
