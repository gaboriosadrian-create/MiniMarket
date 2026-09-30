import React, { useState } from 'react';
import { 
  Building2, 
  Package, 
  Calendar, 
  FileText, 
  Hash, 
  AlertCircle, 
  Check, 
  Plus, 
  Minus,
  ChevronDown
} from 'lucide-react';

export const DesignLabForms: React.FC = () => {
  const [stepperVal, setStepperVal] = useState(3);
  const [isChecked, setIsChecked] = useState(true);
  const [radioVal, setRadioVal] = useState('efectivo');

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
            9. Formularios y Controles de Entrada
          </h3>
          <p className="text-xs" style={{ color: 'var(--dl-text-muted)' }}>
            Inputs de texto, selector, estados (normal, focus, error, disabled), checkboxes, radios y steppers
          </p>
        </div>
        <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded" style={{ backgroundColor: 'var(--dl-surface-subtle)', color: 'var(--dl-text-muted)' }}>
          Form Controls
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Form Column 1: Field Mockups */}
        <div 
          className="p-4 border space-y-3.5"
          style={{
            backgroundColor: 'var(--dl-surface)',
            borderColor: 'var(--dl-border)',
            borderRadius: 'var(--dl-radius-md)'
          }}
        >
          <h4 className="text-xs font-black uppercase tracking-wider" style={{ color: 'var(--dl-text-muted)' }}>
            Formulario de Entrada / Recepción
          </h4>

          {/* Field: Proveedor */}
          <div className="space-y-1">
            <label className="text-xs font-bold block" style={{ color: 'var(--dl-text)' }}>
              Proveedor
            </label>
            <div className="relative">
              <select
                defaultValue="Panadería López"
                className="w-full pl-3 pr-8 text-xs font-bold border outline-none appearance-none cursor-pointer"
                style={{
                  height: 'var(--dl-input-height)',
                  backgroundColor: 'var(--dl-surface)',
                  borderColor: 'var(--dl-border)',
                  color: 'var(--dl-text)',
                  borderRadius: 'var(--dl-radius-sm)'
                }}
              >
                <option>Panadería López</option>
                <option>Distribuidora Cuyo</option>
                <option>Lácteos La Serenísima</option>
              </select>
              <ChevronDown className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--dl-text-muted)' }} />
            </div>
          </div>

          {/* Field: Producto */}
          <div className="space-y-1">
            <label className="text-xs font-bold block" style={{ color: 'var(--dl-text)' }}>
              Producto
            </label>
            <input
              type="text"
              readOnly
              defaultValue="Tortitas"
              className="w-full px-3 text-xs font-bold border outline-none"
              style={{
                height: 'var(--dl-input-height)',
                backgroundColor: 'var(--dl-surface)',
                borderColor: 'var(--dl-border)',
                color: 'var(--dl-text)',
                borderRadius: 'var(--dl-radius-sm)'
              }}
            />
          </div>

          {/* Field: Cantidad Numeric Stepper */}
          <div className="space-y-1">
            <label className="text-xs font-bold block" style={{ color: 'var(--dl-text)' }}>
              Cantidad
            </label>
            <div className="flex items-center gap-2">
              <div className="flex items-center border" style={{ borderColor: 'var(--dl-border)', borderRadius: 'var(--dl-radius-sm)', backgroundColor: 'var(--dl-surface)' }}>
                <button
                  type="button"
                  onClick={() => setStepperVal(prev => Math.max(1, prev - 1))}
                  className="w-9 flex items-center justify-center font-bold cursor-pointer"
                  style={{ height: 'var(--dl-input-height)', color: 'var(--dl-text)' }}
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <span className="w-12 text-center text-xs font-mono font-black" style={{ color: 'var(--dl-text)' }}>
                  {stepperVal}
                </span>
                <button
                  type="button"
                  onClick={() => setStepperVal(prev => prev + 1)}
                  className="w-9 flex items-center justify-center font-bold cursor-pointer"
                  style={{ height: 'var(--dl-input-height)', color: 'var(--dl-text)' }}
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
              <span className="text-xs" style={{ color: 'var(--dl-text-muted)' }}>unidades</span>
            </div>
          </div>

          {/* Field: Fecha */}
          <div className="space-y-1">
            <label className="text-xs font-bold block" style={{ color: 'var(--dl-text)' }}>
              Fecha
            </label>
            <input
              type="text"
              readOnly
              defaultValue="16/08/2026"
              className="w-full px-3 text-xs font-mono font-bold border outline-none"
              style={{
                height: 'var(--dl-input-height)',
                backgroundColor: 'var(--dl-surface)',
                borderColor: 'var(--dl-border)',
                color: 'var(--dl-text)',
                borderRadius: 'var(--dl-radius-sm)'
              }}
            />
          </div>

          {/* Field: Comprobante */}
          <div className="space-y-1">
            <label className="text-xs font-bold block" style={{ color: 'var(--dl-text)' }}>
              Comprobante / Remito
            </label>
            <input
              type="text"
              readOnly
              defaultValue="FC-0001-00012345"
              className="w-full px-3 text-xs font-mono font-bold border outline-none"
              style={{
                height: 'var(--dl-input-height)',
                backgroundColor: 'var(--dl-surface)',
                borderColor: 'var(--dl-border)',
                color: 'var(--dl-text)',
                borderRadius: 'var(--dl-radius-sm)'
              }}
            />
          </div>
        </div>

        {/* Form Column 2: State Demonstrators (Focus, Error, Disabled, Checkboxes, Radios) */}
        <div 
          className="p-4 border space-y-3.5"
          style={{
            backgroundColor: 'var(--dl-surface)',
            borderColor: 'var(--dl-border)',
            borderRadius: 'var(--dl-radius-md)'
          }}
        >
          <h4 className="text-xs font-black uppercase tracking-wider" style={{ color: 'var(--dl-text-muted)' }}>
            Estados de Inputs y Selección
          </h4>

          {/* Focus State */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold" style={{ color: 'var(--dl-text)' }}>Estado Focus</label>
              <span className="text-[10px] font-bold" style={{ color: 'var(--dl-primary)' }}>ring activo</span>
            </div>
            <input
              type="text"
              readOnly
              defaultValue="Input seleccionado en foco..."
              className="w-full px-3 text-xs font-bold border outline-none ring-2"
              style={{
                height: 'var(--dl-input-height)',
                backgroundColor: 'var(--dl-surface)',
                borderColor: 'var(--dl-primary)',
                color: 'var(--dl-text)',
                borderRadius: 'var(--dl-radius-sm)'
              }}
            />
          </div>

          {/* Error State */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold" style={{ color: 'var(--dl-danger)' }}>Estado Error</label>
              <span className="text-[10px] font-bold" style={{ color: 'var(--dl-danger)' }}>requerido</span>
            </div>
            <input
              type="text"
              readOnly
              defaultValue="Precio inválido"
              className="w-full px-3 text-xs font-bold border outline-none"
              style={{
                height: 'var(--dl-input-height)',
                backgroundColor: 'var(--dl-danger-bg)',
                borderColor: 'var(--dl-danger-border)',
                color: 'var(--dl-danger-text)',
                borderRadius: 'var(--dl-radius-sm)'
              }}
            />
            <p className="text-[11px] font-bold flex items-center gap-1" style={{ color: 'var(--dl-danger)' }}>
              <AlertCircle className="w-3.5 h-3.5" />
              <span>El campo no puede estar vacío</span>
            </p>
          </div>

          {/* Disabled State */}
          <div className="space-y-1">
            <label className="text-xs font-bold block opacity-60" style={{ color: 'var(--dl-text)' }}>
              Estado Disabled
            </label>
            <input
              type="text"
              disabled
              defaultValue="Campo deshabilitado / solo lectura"
              className="w-full px-3 text-xs font-bold border opacity-60 cursor-not-allowed"
              style={{
                height: 'var(--dl-input-height)',
                backgroundColor: 'var(--dl-surface-subtle)',
                borderColor: 'var(--dl-border-subtle)',
                color: 'var(--dl-text-muted)',
                borderRadius: 'var(--dl-radius-sm)'
              }}
            />
          </div>

          {/* Checkbox & Radio Controls */}
          <div className="pt-2 border-t space-y-3" style={{ borderColor: 'var(--dl-border-subtle)' }}>
            <label className="flex items-center gap-2 text-xs font-bold cursor-pointer" style={{ color: 'var(--dl-text)' }}>
              <input
                type="checkbox"
                checked={isChecked}
                onChange={(e) => setIsChecked(e.target.checked)}
                className="w-4 h-4 cursor-pointer accent-[#008060]"
              />
              <span>Actualizar stock inmediatamente en góndola</span>
            </label>

            <div className="flex items-center gap-4 text-xs font-bold" style={{ color: 'var(--dl-text)' }}>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="payment_test"
                  value="efectivo"
                  checked={radioVal === 'efectivo'}
                  onChange={() => setRadioVal('efectivo')}
                  className="cursor-pointer"
                />
                <span>Efectivo</span>
              </label>

              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="payment_test"
                  value="transferencia"
                  checked={radioVal === 'transferencia'}
                  onChange={() => setRadioVal('transferencia')}
                  className="cursor-pointer"
                />
                <span>Transferencia / QR</span>
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
