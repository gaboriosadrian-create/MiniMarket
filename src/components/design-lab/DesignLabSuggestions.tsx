import React, { useState } from 'react';
import { Sparkles, Plus, AlertCircle, TrendingDown, Check } from 'lucide-react';

export const DesignLabSuggestions: React.FC = () => {
  const [addedItems, setAddedItems] = useState<Record<string, boolean>>({});

  const suggestions = [
    { id: '1', name: 'Tortitas', stock: 4, reorderPoint: 10, suggested: 8, status: 'Bajo' },
    { id: '2', name: 'Medialunas', stock: 2, reorderPoint: 10, suggested: 10, status: 'Crítico' },
    { id: '3', name: 'Alfajores', stock: 5, reorderPoint: 15, suggested: 12, status: 'Bajo' },
  ];

  const handleToggleAdd = (id: string) => {
    setAddedItems(prev => ({ ...prev, [id]: true }));
    setTimeout(() => {
      // Keep it added or toggle
    }, 200);
  };

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
            7. Sugerencias Automáticas de Reposición
          </h3>
          <p className="text-xs" style={{ color: 'var(--dl-text-muted)' }}>
            Cálculo algorítmico cuando Stock &lt; Punto de Reposición con microfeedback de agregado instantáneo
          </p>
        </div>
        <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded" style={{ backgroundColor: 'var(--dl-surface-subtle)', color: 'var(--dl-text-muted)' }}>
          Auto-Replenish
        </span>
      </div>

      <div className="max-w-2xl mx-auto space-y-3">
        <div 
          className="border overflow-hidden"
          style={{
            backgroundColor: 'var(--dl-surface)',
            borderColor: 'var(--dl-border)',
            borderRadius: 'var(--dl-radius-md)'
          }}
        >
          {/* Table Header */}
          <div 
            className="grid grid-cols-12 gap-2 p-3 text-[11px] font-black uppercase tracking-wider border-b"
            style={{
              backgroundColor: 'var(--dl-surface-subtle)',
              borderColor: 'var(--dl-border-subtle)',
              color: 'var(--dl-text-muted)'
            }}
          >
            <div className="col-span-5">Producto</div>
            <div className="col-span-2 text-center">Stock Actual</div>
            <div className="col-span-2 text-center">Sugerido</div>
            <div className="col-span-3 text-right">Acción</div>
          </div>

          {/* Rows */}
          <div className="divide-y" style={{ borderColor: 'var(--dl-border-subtle)' }}>
            {suggestions.map((item) => {
              const isAdded = !!addedItems[item.id];

              return (
                <div 
                  key={item.id}
                  className={`grid grid-cols-12 gap-2 p-3 items-center text-xs font-bold transition-all ${isAdded ? 'dl-anim-flash' : ''}`}
                  style={{
                    backgroundColor: isAdded ? 'var(--dl-primary-subtle)' : 'var(--dl-surface)',
                    color: 'var(--dl-text)'
                  }}
                >
                  <div className="col-span-5 min-w-0">
                    <p className="truncate font-black" style={{ color: 'var(--dl-text)' }}>
                      {item.name}
                    </p>
                    <span 
                      className="inline-block text-[10px] px-1.5 py-0.2 rounded font-black mt-0.5"
                      style={{
                        backgroundColor: item.status === 'Crítico' ? 'var(--dl-danger-bg)' : 'var(--dl-warning-bg)',
                        color: item.status === 'Crítico' ? 'var(--dl-danger-text)' : 'var(--dl-warning-text)',
                        border: `1px solid ${item.status === 'Crítico' ? 'var(--dl-danger-border)' : 'var(--dl-warning-border)'}`
                      }}
                    >
                      Stock {item.status}
                    </span>
                  </div>

                  <div className="col-span-2 text-center font-mono font-black" style={{ color: 'var(--dl-text-muted)' }}>
                    {item.stock} un
                  </div>

                  <div className="col-span-2 text-center font-mono font-black text-sm" style={{ color: 'var(--dl-primary)' }}>
                    +{item.suggested}
                  </div>

                  <div className="col-span-3 flex justify-end">
                    <button
                      type="button"
                      onClick={() => handleToggleAdd(item.id)}
                      className="px-3 py-1.5 text-xs font-bold flex items-center gap-1 border cursor-pointer transition-all active:scale-95"
                      style={{
                        backgroundColor: isAdded ? 'var(--dl-success-bg)' : 'var(--dl-secondary)',
                        borderColor: isAdded ? 'var(--dl-success-border)' : 'var(--dl-border)',
                        color: isAdded ? 'var(--dl-success-text)' : 'var(--dl-text)',
                        borderRadius: 'var(--dl-radius-sm)'
                      }}
                    >
                      {isAdded ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-700" />
                          <span>Agregado</span>
                        </>
                      ) : (
                        <>
                          <Plus className="w-3.5 h-3.5" style={{ color: 'var(--dl-primary)' }} />
                          <span>Agregar</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

