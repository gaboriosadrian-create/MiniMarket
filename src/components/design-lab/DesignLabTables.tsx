import React from 'react';
import { useTheme } from '../../lib/themeContext';
import { getThemeVariant, getThemeDescriptor } from '../../lib/themeVariant';
import { DataTableVariant, Column } from '../common/DataTableVariant';

interface ProductRow {
  id: string;
  name: string;
  category: string;
  stock: number;
  price: number;
  status: string;
  statusType: 'success' | 'warning' | 'danger';
}

export const DesignLabTables: React.FC = () => {
  const { activeTheme } = useTheme();
  const variant = getThemeVariant(activeTheme?.id, activeTheme?.layoutStyle);
  const descriptor = getThemeDescriptor(variant);

  const products: ProductRow[] = [
    { id: '1', name: 'Tortitas de Manteca', category: 'Panificados', stock: 24, price: 1500, status: 'Normal', statusType: 'success' },
    { id: '2', name: 'Medialunas de Grasa', category: 'Panificados', stock: 2, price: 1200, status: 'Crítico', statusType: 'danger' },
    { id: '3', name: 'Alfajor Triple Chocolate', category: 'Golosinas', stock: 5, price: 950, status: 'Bajo', statusType: 'warning' },
    { id: '4', name: 'Galletas de Agua 300g', category: 'Almacén', stock: 38, price: 1100, status: 'Normal', statusType: 'success' },
  ];

  const columns: Column<ProductRow>[] = [
    {
      key: 'name',
      header: 'Producto',
      render: (item) => (
        <div>
          <span className="font-bold block">{item.name}</span>
          <span className="text-[10px] text-stone-400 font-sans sm:hidden">{item.category}</span>
        </div>
      )
    },
    {
      key: 'category',
      header: 'Categoría',
      render: (item) => <span className="text-stone-500">{item.category}</span>
    },
    {
      key: 'stock',
      header: 'Stock',
      align: 'center',
      render: (item) => (
        <span className={`font-mono font-bold ${item.statusType === 'danger' ? 'text-red-600' : 'text-stone-800'}`}>
          {item.stock} un.
        </span>
      )
    },
    {
      key: 'price',
      header: 'Precio',
      align: 'right',
      render: (item) => (
        <span className="font-mono font-bold">
          ${item.price.toLocaleString('es-AR')}
        </span>
      )
    },
    {
      key: 'status',
      header: 'Estado',
      align: 'center',
      render: (item) => {
        let badgeStyle = 'bg-emerald-50 text-emerald-700 border-emerald-200';
        if (item.statusType === 'warning') badgeStyle = 'bg-amber-50 text-amber-800 border-amber-200';
        if (item.statusType === 'danger') badgeStyle = 'bg-red-50 text-red-800 border-red-200';

        return (
          <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${badgeStyle}`}>
            {item.status}
          </span>
        );
      }
    }
  ];

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
              11. Tablas y Listados de Datos
            </h3>
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded uppercase" style={{ backgroundColor: 'var(--dl-primary-subtle)', color: 'var(--dl-primary)' }}>
              {descriptor.name}
            </span>
          </div>
          <p className="text-xs mt-0.5" style={{ color: 'var(--dl-text-muted)' }}>
            Renderizado estructural según la dirección de diseño seleccionada
          </p>
        </div>
        <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded" style={{ backgroundColor: 'var(--dl-surface-subtle)', color: 'var(--dl-text-muted)' }}>
          4 Registros
        </span>
      </div>

      <DataTableVariant
        columns={columns}
        data={products}
        keyExtractor={(p) => p.id}
      />
    </div>
  );
};
