import React, { useState } from 'react';
import { ClipboardList, Plus, Share2, Save, Trash2, FileText, Check, Loader2 } from 'lucide-react';

export const DesignLabRequest: React.FC = () => {
  const [items, setItems] = useState([
    { id: '1', name: 'Tortitas', qty: 3, stock: 4, isNew: false },
    { id: '2', name: 'Medialunas', qty: 2, stock: 2, isNew: false },
    { id: '3', name: 'Alfajores', qty: 12, stock: 5, isNew: false },
  ]);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [shareStatus, setShareStatus] = useState<'idle' | 'shared'>('idle');

  const handleAddItem = () => {
    const newId = String(Date.now());
    const newItem = { id: newId, name: 'Sándwiches de miga', qty: 6, stock: 0, isNew: true };
    setItems(prev => [newItem, ...prev]);
    setTimeout(() => {
      setItems(prev => prev.map(item => item.id === newId ? { ...item, isNew: false } : item));
    }, 250);
  };

  const handleSave = () => {
    if (saveStatus !== 'idle') return;
    setSaveStatus('saving');
    setTimeout(() => {
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2200);
    }, 550);
  };

  const handleShare = () => {
    if (shareStatus !== 'idle') return;
    setShareStatus('shared');
    setTimeout(() => setShareStatus('idle'), 2000);
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
            6. Solicitud de Productos
          </h3>
          <p className="text-xs" style={{ color: 'var(--dl-text-muted)' }}>
            Listado ágil de pedido a proveedores con microfeedback de guardado y exportación rápida
          </p>
        </div>
        <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded" style={{ backgroundColor: 'var(--dl-surface-subtle)', color: 'var(--dl-text-muted)' }}>
          Replenishment List
        </span>
      </div>

      <div className="max-w-md mx-auto">
        <div 
          className="border p-4 sm:p-5 space-y-4 shadow-xs"
          style={{
            backgroundColor: 'var(--dl-surface)',
            borderColor: 'var(--dl-border)',
            borderRadius: 'var(--dl-radius-md)'
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: 'var(--dl-border-subtle)' }}>
            <div className="flex items-center gap-2">
              <div 
                className="w-7 h-7 flex items-center justify-center font-bold"
                style={{
                  backgroundColor: 'var(--dl-primary-subtle)',
                  color: 'var(--dl-primary)',
                  borderRadius: 'var(--dl-radius-sm)'
                }}
              >
                <ClipboardList className="w-4 h-4" />
              </div>
              <h4 className="text-sm font-black" style={{ color: 'var(--dl-text)' }}>
                Nueva Solicitud
              </h4>
            </div>
            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded" style={{ backgroundColor: 'var(--dl-surface-subtle)', color: 'var(--dl-text-muted)' }}>
              SOL-00109
            </span>
          </div>

          {/* Supplier */}
          <div 
            className="p-3 border space-y-1"
            style={{
              backgroundColor: 'var(--dl-surface-subtle)',
              borderColor: 'var(--dl-border)',
              borderRadius: 'var(--dl-radius-sm)'
            }}
          >
            <span className="text-[10px] font-bold uppercase tracking-wider block" style={{ color: 'var(--dl-text-muted)' }}>
              Proveedor
            </span>
            <p className="text-sm font-black" style={{ color: 'var(--dl-text)' }}>
              Panadería López
            </p>
          </div>

          {/* Products List in Request */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--dl-text-muted)' }}>
                Productos a pedir
              </span>
              <button
                type="button"
                onClick={handleAddItem}
                className="text-xs font-bold flex items-center gap-1 cursor-pointer transition-transform active:scale-95"
                style={{ color: 'var(--dl-primary)' }}
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Agregar producto</span>
              </button>
            </div>

            <div className="space-y-1.5">
              {items.map((item) => (
                <div 
                  key={item.id}
                  className={`p-2.5 border flex items-center justify-between gap-2 transition-all ${item.isNew ? 'dl-anim-flash' : ''}`}
                  style={{
                    backgroundColor: item.isNew ? 'var(--dl-primary-subtle)' : 'var(--dl-surface)',
                    borderColor: item.isNew ? 'var(--dl-primary)' : 'var(--dl-border-subtle)',
                    borderRadius: 'var(--dl-radius-sm)'
                  }}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-black truncate" style={{ color: 'var(--dl-text)' }}>
                      {item.name}
                    </p>
                    <p className="text-[10px]" style={{ color: 'var(--dl-text-muted)' }}>
                      Stock actual: {item.stock} un
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span 
                      className="px-2.5 py-1 text-xs font-mono font-black border"
                      style={{
                        backgroundColor: 'var(--dl-surface-subtle)',
                        borderColor: 'var(--dl-border)',
                        color: 'var(--dl-text)',
                        borderRadius: 'var(--dl-radius-sm)'
                      }}
                    >
                      {item.qty} un
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Summary Box */}
          <div 
            className="p-3 border flex items-center justify-between"
            style={{
              backgroundColor: 'var(--dl-surface-subtle)',
              borderColor: 'var(--dl-border)',
              borderRadius: 'var(--dl-radius-sm)'
            }}
          >
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider block" style={{ color: 'var(--dl-text-muted)' }}>
                Resumen de Pedido
              </span>
              <span className="text-xs font-black" style={{ color: 'var(--dl-text)' }}>
                {items.length} productos · {items.reduce((acc, curr) => acc + curr.qty, 0)} unidades en total
              </span>
            </div>
            <span className="text-xs font-black px-2 py-0.5 rounded" style={{ backgroundColor: 'var(--dl-primary-subtle)', color: 'var(--dl-primary)' }}>
              Listo para enviar
            </span>
          </div>

          {/* Dual Action Buttons */}
          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              type="button"
              onClick={handleSave}
              disabled={saveStatus !== 'idle'}
              className="flex items-center justify-center gap-1.5 font-bold text-xs cursor-pointer border transition-all active:scale-95 disabled:cursor-not-allowed"
              style={{
                height: 'var(--dl-btn-height)',
                backgroundColor: saveStatus === 'saved' ? 'var(--dl-success-bg)' : 'var(--dl-secondary)',
                borderColor: saveStatus === 'saved' ? 'var(--dl-success-border)' : 'var(--dl-border)',
                color: saveStatus === 'saved' ? 'var(--dl-success-text)' : 'var(--dl-text)',
                borderRadius: 'var(--dl-radius-sm)'
              }}
            >
              {saveStatus === 'idle' && (
                <>
                  <Save className="w-3.5 h-3.5" />
                  <span>GUARDAR</span>
                </>
              )}
              {saveStatus === 'saving' && (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>GUARDANDO...</span>
                </>
              )}
              {saveStatus === 'saved' && (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>✓ GUARDADO</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleShare}
              className="flex items-center justify-center gap-1.5 font-black text-xs uppercase tracking-wide cursor-pointer transition-all shadow-sm active:scale-95"
              style={{
                height: 'var(--dl-btn-height)',
                backgroundColor: shareStatus === 'shared' ? 'var(--dl-success-bg)' : 'var(--dl-primary)',
                color: shareStatus === 'shared' ? 'var(--dl-success-text)' : 'var(--dl-primary-text)',
                border: shareStatus === 'shared' ? '1px solid var(--dl-success-border)' : 'none',
                borderRadius: 'var(--dl-radius-sm)'
              }}
            >
              {shareStatus === 'idle' ? (
                <>
                  <Share2 className="w-3.5 h-3.5" />
                  <span>COMPARTIR</span>
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>✓ ENVIADO</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

